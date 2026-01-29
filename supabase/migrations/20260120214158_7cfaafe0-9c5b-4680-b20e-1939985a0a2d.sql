
-- =========================================================
-- A) member_identities: permitir insert somente via RPC autorizada
-- =========================================================

-- Mantém superfície mínima
revoke all on table public.member_identities from anon;
grant select on table public.member_identities to authenticated;
revoke insert, update, delete on table public.member_identities from authenticated;

-- Remove policies antigas conflitantes
drop policy if exists "mi_insert_none" on public.member_identities;
drop policy if exists "mi_insert_own" on public.member_identities;
drop policy if exists "member_identities_insert_bootstrap_only" on public.member_identities;
drop policy if exists "mi_insert_via_rpc_only" on public.member_identities;

-- SELECT próprio vínculo
drop policy if exists "mi_select_own" on public.member_identities;
create policy "mi_select_own"
on public.member_identities
for select
to authenticated
using (user_id = auth.uid());

-- UPDATE/DELETE sempre proibidos
drop policy if exists "mi_update_none" on public.member_identities;
create policy "mi_update_none"
on public.member_identities
for update
to authenticated
using (false)
with check (false);

drop policy if exists "mi_delete_none" on public.member_identities;
create policy "mi_delete_none"
on public.member_identities
for delete
to authenticated
using (false);

-- INSERT: só passa se um RPC tiver marcado o contexto de escrita
create policy "mi_insert_via_rpc_only"
on public.member_identities
for insert
to public
with check (
  user_id = auth.uid()
  and not exists (select 1 from public.member_identities mi where mi.user_id = auth.uid())
  and current_setting('app.identity_write', true) in ('bootstrap','invite')
);

-- Reforço de integridade
create unique index if not exists member_identities_user_id_uniq
  on public.member_identities(user_id);


-- =========================================================
-- B) household_invites: policies admin-only + tabela inacessível pelo client
-- =========================================================

-- Zero acesso direto pelo client
revoke all on table public.household_invites from anon, authenticated;

-- Limpa policies antigas
drop policy if exists "invites_select_admin" on public.household_invites;
drop policy if exists "invites_insert_admin" on public.household_invites;
drop policy if exists "invites_update_accept_via_rpc" on public.household_invites;
drop policy if exists "invites_delete_none" on public.household_invites;

-- 1) Admin pode ver convites do próprio household
create policy "invites_select_admin"
on public.household_invites
for select
to authenticated
using (
  public.is_household_admin(auth.uid(), household_id)
);

-- 2) Admin pode criar convite (RPC)
create policy "invites_insert_admin"
on public.household_invites
for insert
to public
with check (
  public.is_household_admin(auth.uid(), household_id)
  and created_by_user_id = auth.uid()
);

-- 3) Aceite de convite (update) — permitido somente se o RPC marcou contexto
create policy "invites_update_accept_via_rpc"
on public.household_invites
for update
to public
using (
  current_setting('app.invite_accept', true) = '1'
)
with check (
  current_setting('app.invite_accept', true) = '1'
);

-- DELETE: proibido via client
create policy "invites_delete_none"
on public.household_invites
for delete
to authenticated
using (false);


-- =========================================================
-- C) Ajustar RPCs para setar flags de contexto antes de inserir/atualizar
-- =========================================================

-- create_member_identity: bootstrap only
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

  -- household com identidade existente exige convite
  if exists (select 1 from public.member_identities where household_id = p_household_id) then
    raise exception 'household_requires_invite';
  end if;

  perform set_config('app.identity_write', 'bootstrap', true);

  insert into public.member_identities (user_id, household_id, member_id)
  values (auth.uid(), p_household_id, p_member_id);
end;
$$;

revoke all on function public.create_member_identity(uuid, uuid) from public;
grant execute on function public.create_member_identity(uuid, uuid) to authenticated;


-- accept_household_invite: seta flags para UPDATE invite + INSERT identity
-- Using token_hash lookup and lower(invited_email) for comparison
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

  -- Get user email from JWT
  v_email := lower((auth.jwt() ->> 'email')::text);

  -- If invite has target email, validate it matches
  if v_inv.invited_email is not null and lower(v_inv.invited_email) <> v_email then
    raise exception 'invite_email_mismatch';
  end if;

  -- Create member for this user
  insert into public.members (household_id, name, role)
  values (
    v_inv.household_id,
    coalesce(p_name, split_part(v_email, '@', 1), 'Novo Membro'),
    coalesce(v_inv.role, 'MEMBER')::member_role
  )
  returning id into v_new_member_id;

  -- Set context flag to allow INSERT
  perform set_config('app.identity_write', 'invite', true);

  -- Create identity link
  insert into public.member_identities (user_id, household_id, member_id)
  values (auth.uid(), v_inv.household_id, v_new_member_id);

  -- Set context flag for invite update
  perform set_config('app.invite_accept', '1', true);

  -- Mark invite as accepted
  update public.household_invites
  set accepted_at = now(), accepted_by_user_id = auth.uid()
  where id = v_inv.id;

  return query select v_inv.household_id, v_new_member_id;
end;
$$;

revoke all on function public.accept_household_invite(text, text) from public;
grant execute on function public.accept_household_invite(text, text) to authenticated;
