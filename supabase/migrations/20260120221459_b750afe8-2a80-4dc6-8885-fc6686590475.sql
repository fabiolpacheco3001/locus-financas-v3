-- PATCH: Complete member_identities + household_invites hardening
-- Revokes INSERT privilege (not just RLS) and enforces RPC-only creation

begin;

-- 0) Garantias básicas
alter table if exists public.member_identities enable row level security;
alter table if exists public.member_identities force row level security;

-- 1) Remover/neutralizar INSERT direto pelo client (criação via RPC)
revoke insert on table public.member_identities from authenticated;

-- Remover policy antiga de insert (se existir) e negar insert explicitamente
drop policy if exists "mi_insert_own" on public.member_identities;
drop policy if exists "mi_insert_rpc_only" on public.member_identities;
drop policy if exists "member_identities_insert_bootstrap_only" on public.member_identities;

create policy "mi_insert_none"
on public.member_identities
for insert
to authenticated
with check (false);

-- 2) Manter SELECT apenas do próprio vínculo
drop policy if exists "mi_select_own" on public.member_identities;
create policy "mi_select_own"
on public.member_identities
for select
to authenticated
using (user_id = auth.uid());

-- 3) UPDATE/DELETE proibidos (reforço)
drop policy if exists "mi_update_none" on public.member_identities;
drop policy if exists "mi_delete_none" on public.member_identities;

create policy "mi_update_none"
on public.member_identities
for update
to authenticated
using (false)
with check (false);

create policy "mi_delete_none"
on public.member_identities
for delete
to authenticated
using (false);

-- 4) Ensure pgcrypto extension exists
create extension if not exists pgcrypto;

-- 5) Add invited_email_lower column if not exists (for case-insensitive matching)
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'household_invites'
      and column_name = 'invited_email_lower'
  ) then
    alter table public.household_invites 
    add column invited_email_lower text;
    
    -- Backfill existing rows
    update public.household_invites 
    set invited_email_lower = lower(invited_email)
    where invited_email_lower is null and invited_email is not null;
  end if;
end $$;

-- 6) Revoke direct access to household_invites
revoke all on table public.household_invites from anon, authenticated;

-- 7) Updated create_household_invite with new signature
create or replace function public.create_household_invite(
  p_household_id uuid,
  p_email text,
  p_role text default 'MEMBER',
  p_days_valid int default 7
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
  v_hash text;
  v_member_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  -- exige admin do household
  if not public.is_household_admin(auth.uid(), p_household_id) then
    raise exception 'admin_required';
  end if;

  -- Get caller's member_id for created_by
  select mi.member_id into v_member_id
  from public.member_identities mi
  where mi.user_id = auth.uid();

  v_token := encode(gen_random_bytes(32), 'hex');
  v_hash := public.hash_invite_token(v_token);

  insert into public.household_invites (
    household_id, 
    invited_email, 
    invited_email_lower, 
    role,
    token, 
    token_hash, 
    expires_at, 
    created_by,
    created_by_user_id
  ) values (
    p_household_id, 
    p_email, 
    lower(p_email), 
    coalesce(p_role, 'MEMBER'),
    v_token, 
    v_hash, 
    now() + make_interval(days => p_days_valid), 
    v_member_id,
    auth.uid()
  );

  return v_token;
end;
$$;

-- 8) Updated accept_household_invite with email validation
create or replace function public.accept_household_invite(
  p_token text,
  p_name text default null
)
returns table(household_id uuid, member_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text;
  v_inv public.household_invites%rowtype;
  v_email text;
  v_new_member_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  -- usuário não pode ter vínculo prévio
  if exists (select 1 from public.member_identities where user_id = auth.uid()) then
    raise exception 'identity_already_exists';
  end if;

  v_hash := public.hash_invite_token(p_token);

  select * into v_inv
  from public.household_invites hi
  where hi.token_hash = v_hash
    and hi.accepted_at is null
    and hi.expires_at > now()
  limit 1;

  if v_inv.id is null then
    raise exception 'invite_invalid_or_expired';
  end if;

  v_email := lower((auth.jwt() ->> 'email')::text);
  
  -- If invite has target email, validate it matches
  if v_inv.invited_email is not null and v_inv.invited_email_lower is not null then
    if v_email is null or v_email <> v_inv.invited_email_lower then
      raise exception 'invite_email_mismatch';
    end if;
  end if;

  -- cria o member colaborativo
  insert into public.members (household_id, name, role)
  values (
    v_inv.household_id,
    coalesce(p_name, split_part(coalesce(v_inv.invited_email, v_email), '@', 1), 'Novo Membro'),
    coalesce(v_inv.role, 'MEMBER')::member_role
  )
  returning id into v_new_member_id;

  -- cria o vínculo crítico (SECURITY DEFINER bypasses RLS)
  insert into public.member_identities (user_id, household_id, member_id)
  values (auth.uid(), v_inv.household_id, v_new_member_id);

  -- marca convite como aceito
  update public.household_invites
    set accepted_at = now(), accepted_by_user_id = auth.uid()
  where id = v_inv.id;

  return query select v_inv.household_id, v_new_member_id;
end;
$$;

-- 9) Hardening do bootstrap: create_member_identity só para household NOVO
create or replace function public.create_member_identity(
  p_household_id uuid,
  p_member_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if exists (select 1 from public.member_identities where user_id = auth.uid()) then
    raise exception 'identity_already_exists';
  end if;

  if not exists (select 1 from public.households h where h.id = p_household_id) then
    raise exception 'household_not_found';
  end if;

  if not exists (
    select 1
    from public.members m
    where m.id = p_member_id
      and m.household_id = p_household_id
  ) then
    raise exception 'member_not_found_or_mismatch';
  end if;

  -- se já existe qualquer identidade nesse household, exige convite
  if exists (select 1 from public.member_identities where household_id = p_household_id) then
    raise exception 'household_requires_invite';
  end if;

  -- SECURITY DEFINER bypasses RLS
  insert into public.member_identities (user_id, household_id, member_id)
  values (auth.uid(), p_household_id, p_member_id);
end;
$$;

-- 10) Grant execute on RPCs
revoke all on function public.create_household_invite(uuid, text, text, int) from public;
grant execute on function public.create_household_invite(uuid, text, text, int) to authenticated;

revoke all on function public.accept_household_invite(text, text) from public;
grant execute on function public.accept_household_invite(text, text) to authenticated;

revoke all on function public.create_member_identity(uuid, uuid) from public;
grant execute on function public.create_member_identity(uuid, uuid) to authenticated;

commit;