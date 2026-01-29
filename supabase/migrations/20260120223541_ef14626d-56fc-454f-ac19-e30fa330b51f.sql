-- =========================================
-- PATCH DEFINITIVO: household_invites + member_identities (Supabase)
-- =========================================

-- 0) Extensão para hash + random bytes
create extension if not exists pgcrypto;

-- 1) Função: hash do token (sha256 hex) - recreate to ensure consistent behavior
create or replace function public.hash_invite_token(p_token text)
returns text
language sql
immutable
set search_path = public
as $$
  select encode(extensions.digest(trim(p_token), 'sha256'), 'hex');
$$;

-- 2) UPGRADE schema household_invites (colunas "padrão robusto")
-- Note: Most columns already exist, adding any missing ones
alter table if exists public.household_invites
  add column if not exists token_hash text,
  add column if not exists invited_email text,
  add column if not exists role text,
  add column if not exists expires_at timestamptz,
  add column if not exists accepted_at timestamptz,
  add column if not exists accepted_by uuid,
  add column if not exists created_at timestamptz;

do $$
begin
  -- defaults seguros
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='household_invites' and column_name='created_at'
  ) then
    execute 'alter table public.household_invites alter column created_at set default now()';
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='household_invites' and column_name='expires_at'
  ) then
    execute 'alter table public.household_invites alter column expires_at set default (now() + interval ''7 days'')';
  end if;
  -- MIGRAÇÃO: se existir coluna token (texto puro), converte para hash e APAGA o token
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='household_invites' and column_name='token'
  ) then
    execute $m$
      update public.household_invites
      set token_hash = coalesce(token_hash, public.hash_invite_token(token))
      where token is not null and (token_hash is null or token_hash = '');
    $m$;
    -- apaga token em texto puro (evita vazamento mesmo com falha futura de RLS)
    execute $m$
      update public.household_invites
      set token = null
      where token is not null;
    $m$;
  end if;
  -- compat: se existir used_at, copia para accepted_at (se ainda não preenchido)
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='household_invites' and column_name='used_at'
  ) then
    execute $m$
      update public.household_invites
      set accepted_at = coalesce(accepted_at, used_at)
      where used_at is not null;
    $m$;
  end if;
end $$;

-- índice único (token_hash é o segredo real)
create unique index if not exists household_invites_token_hash_uq
on public.household_invites (token_hash);

-- 3) member_identities: garantir RLS ON + policies corretas
alter table if exists public.member_identities enable row level security;

drop policy if exists "mi_select_own" on public.member_identities;
drop policy if exists "mi_insert_via_rpc_only" on public.member_identities;
drop policy if exists "mi_update_none" on public.member_identities;
drop policy if exists "mi_delete_none" on public.member_identities;
drop policy if exists "member_identities_select_own" on public.member_identities;
drop policy if exists "member_identities_insert_via_rpc" on public.member_identities;
drop policy if exists "member_identities_update_block" on public.member_identities;
drop policy if exists "member_identities_delete_block" on public.member_identities;

create policy "member_identities_select_own"
on public.member_identities
for select
to authenticated
using (user_id = auth.uid());

create policy "member_identities_insert_via_rpc"
on public.member_identities
for insert
to authenticated
with check (
  user_id = auth.uid()
  and coalesce(current_setting('app.member_identities_insert', true), '') = 'true'
);

create policy "member_identities_update_block"
on public.member_identities
for update
to authenticated
using (false);

create policy "member_identities_delete_block"
on public.member_identities
for delete
to authenticated
using (false);

-- 4) household_invites: RLS ON + sem leitura de tokens por membros
alter table if exists public.household_invites enable row level security;

-- Drop all existing policies
drop policy if exists "invites_select_admin" on public.household_invites;
drop policy if exists "invites_insert_admin" on public.household_invites;
drop policy if exists "invites_update_accept_via_rpc" on public.household_invites;
drop policy if exists "invites_delete_none" on public.household_invites;
drop policy if exists "household_invites_select_creator" on public.household_invites;
drop policy if exists "household_invites_insert_via_rpc" on public.household_invites;
drop policy if exists "household_invites_update_via_rpc" on public.household_invites;
drop policy if exists "household_invites_delete_via_rpc" on public.household_invites;

-- SELECT: só quem criou (evita roubo de tokens por outros membros)
create policy "household_invites_select_creator"
on public.household_invites
for select
to authenticated
using (created_by_user_id = auth.uid());

-- INSERT/UPDATE/DELETE: somente via RPC (context flags)
create policy "household_invites_insert_via_rpc"
on public.household_invites
for insert
to authenticated
with check (
  created_by_user_id = auth.uid()
  and coalesce(current_setting('app.household_invites_insert', true), '') = 'true'
);

create policy "household_invites_update_via_rpc"
on public.household_invites
for update
to authenticated
using (
  coalesce(current_setting('app.household_invites_update', true), '') = 'true'
)
with check (
  coalesce(current_setting('app.household_invites_update', true), '') = 'true'
);

create policy "household_invites_delete_via_rpc"
on public.household_invites
for delete
to authenticated
using (
  created_by_user_id = auth.uid()
  and coalesce(current_setting('app.household_invites_delete', true), '') = 'true'
);

-- 5) Drop existing RPCs with conflicting signatures
drop function if exists public.create_household_invite();
drop function if exists public.create_household_invite(text, text);
drop function if exists public.create_household_invite(uuid, text, text, integer);
drop function if exists public.create_household_invite(text, text, integer);
drop function if exists public.accept_household_invite(text);
drop function if exists public.accept_household_invite(text, text);

-- 6) RPC: criar convite (retorna token UMA ÚNICA VEZ)
create or replace function public.create_household_invite(
  p_invited_email text default null,
  p_role text default 'MEMBER',
  p_expires_in_days int default 7
)
returns table (invite_id uuid, token text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
  v_token_hash text;
  v_household_id uuid;
  v_member_id uuid;
  v_expires_at timestamptz;
  v_invite_id uuid;
begin
  -- Household atual do usuário (usa member_identities como fonte de verdade)
  select mi.household_id, mi.member_id into v_household_id, v_member_id
  from public.member_identities mi
  where mi.user_id = auth.uid()
  limit 1;

  if v_household_id is null then
    raise exception 'NO_HOUSEHOLD';
  end if;

  -- Check if user is admin
  if not public.is_household_admin(auth.uid(), v_household_id) then
    raise exception 'ADMIN_REQUIRED';
  end if;

  v_token := encode(gen_random_bytes(32), 'hex');
  v_token_hash := public.hash_invite_token(v_token);
  v_expires_at := now() + make_interval(days => greatest(p_expires_in_days, 1));

  perform set_config('app.household_invites_insert', 'true', true);

  insert into public.household_invites (
    household_id, created_by, created_by_user_id, token_hash, invited_email, 
    invited_email_lower, role, expires_at, created_at
  ) values (
    v_household_id, v_member_id, auth.uid(), v_token_hash, p_invited_email,
    lower(p_invited_email), coalesce(p_role, 'MEMBER'), v_expires_at, now()
  )
  returning id into v_invite_id;

  invite_id := v_invite_id;
  token := v_token;         -- só sai aqui
  expires_at := v_expires_at;
  return next;
end $$;

revoke all on function public.create_household_invite(text, text, integer) from public;
grant execute on function public.create_household_invite(text, text, integer) to authenticated;

-- 7) RPC: aceitar convite (token -> hash -> valida -> vincula usuário ao household)
create or replace function public.accept_household_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token_hash text;
  v_invite record;
  v_member_id uuid;
  v_email text;
begin
  if p_token is null or length(trim(p_token)) < 20 then
    raise exception 'INVALID_TOKEN';
  end if;

  if exists (select 1 from public.member_identities where user_id = auth.uid()) then
    raise exception 'identity_already_exists';
  end if;

  v_token_hash := public.hash_invite_token(p_token);

  select * into v_invite
  from public.household_invites hi
  where hi.token_hash = v_token_hash
  limit 1;

  if v_invite is null then
    raise exception 'invite_invalid_or_expired';
  end if;

  if v_invite.expires_at is not null and v_invite.expires_at < now() then
    raise exception 'invite_invalid_or_expired';
  end if;

  if v_invite.accepted_at is not null then
    raise exception 'invite_invalid_or_expired';
  end if;

  -- Check email if specified
  v_email := lower((auth.jwt() ->> 'email')::text);
  if v_invite.invited_email_lower is not null and v_email <> v_invite.invited_email_lower then
    raise exception 'invite_email_mismatch';
  end if;

  -- Create member
  insert into public.members (household_id, name, role)
  values (
    v_invite.household_id,
    coalesce(split_part(coalesce(v_invite.invited_email, v_email), '@', 1), 'Novo Membro'),
    coalesce(v_invite.role, 'MEMBER')::member_role
  )
  returning id into v_member_id;

  -- marca como aceito
  perform set_config('app.household_invites_update', 'true', true);
  update public.household_invites
  set accepted_at = now(),
      accepted_by_user_id = auth.uid()
  where id = v_invite.id;

  -- cria o vínculo (somente via policy com flag)
  perform set_config('app.member_identities_insert', 'true', true);
  insert into public.member_identities (user_id, household_id, member_id)
  values (auth.uid(), v_invite.household_id, v_member_id);

  return v_invite.household_id;
end $$;

revoke all on function public.accept_household_invite(text) from public;
grant execute on function public.accept_household_invite(text) to authenticated;