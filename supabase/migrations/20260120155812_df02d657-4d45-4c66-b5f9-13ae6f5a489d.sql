-- =========================================
-- MIGRAÇÃO COMPLETA: Separação de dados sensíveis em member_identities
-- =========================================

-- 0) Garantir RLS em members
alter table public.members enable row level security;

-- 1) Dropar policies que dependem de members.user_id ANTES de criar a nova tabela
drop policy if exists "Users can insert household during signup" on public.households;
drop policy if exists "Allow first member creation during signup" on public.members;
drop policy if exists "members_select_self" on public.members;
drop policy if exists "members_select_admin" on public.members;
drop policy if exists "members_select_same_household" on public.members;
drop policy if exists "Members can view members in same household" on public.members;
drop policy if exists "members_select_own_only" on public.members;
drop policy if exists "Admins can insert members" on public.members;
drop policy if exists "Admins can update members" on public.members;
drop policy if exists "Admins can delete members" on public.members;

-- 2) Criar tabela privada para identidade (sensível)
create table if not exists public.member_identities (
  member_id uuid primary key references public.members(id) on delete cascade,
  user_id uuid unique not null,
  email text,
  created_at timestamptz not null default now()
);

alter table public.member_identities enable row level security;

-- 3) Migrar dados sensíveis para member_identities
insert into public.member_identities (member_id, user_id, email)
select m.id, m.user_id, null
from public.members m
where m.user_id is not null
on conflict (member_id) do nothing;

-- 4) Dropar coluna user_id de members (agora sem dependências)
alter table public.members drop column if exists user_id;

-- 5) Funções utilitárias (recriar para usar member_identities)
create or replace function public.get_user_household_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select m.household_id
  from public.member_identities mi
  join public.members m on m.id = mi.member_id
  where mi.user_id = auth.uid()
  limit 1;
$$;

create or replace function public.is_household_admin(p_user uuid, p_household uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.member_identities mi
    join public.members m on m.id = mi.member_id
    where mi.user_id = p_user
      and m.household_id = p_household
      and m.role = 'ADMIN'
  );
$$;

create or replace function public.is_household_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.member_identities mi
    join public.members m on m.id = mi.member_id
    where mi.user_id = auth.uid()
      and m.role = 'ADMIN'
  );
$$;

-- 6) Policies: members (colaborativo) - pode ver todos do household
create policy members_select_household
on public.members
for select
to authenticated
using (household_id = public.get_user_household_id());

create policy "Admins can insert members"
on public.members
for insert
to authenticated
with check (
  household_id = public.get_user_household_id() 
  and public.is_household_admin()
);

create policy "Admins can update members"
on public.members
for update
to authenticated
using (
  household_id = public.get_user_household_id() 
  and public.is_household_admin()
);

create policy "Admins can delete members"
on public.members
for delete
to authenticated
using (
  household_id = public.get_user_household_id() 
  and public.is_household_admin()
);

-- 7) Policies: member_identities (sensível) - self only
create policy member_identities_select_self
on public.member_identities
for select
to authenticated
using (user_id = auth.uid());

create policy member_identities_insert_self
on public.member_identities
for insert
to authenticated
with check (user_id = auth.uid());

-- 8) Policy de households usando member_identities
create policy "Users can insert household during signup"
on public.households
for insert
to authenticated
with check (
  not exists (
    select 1 from public.member_identities
    where user_id = auth.uid()
  )
);

-- 9) RPC segura para listagem
drop function if exists public.get_members_visible(uuid);
drop function if exists public.get_members_visible();

create or replace function public.get_members_visible(p_household_id uuid)
returns table (
  id uuid,
  household_id uuid,
  name text,
  role text,
  email text,
  user_id uuid,
  is_you boolean,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_household uuid;
  v_caller_email text;
begin
  v_household := public.get_user_household_id();
  if v_household is null or v_household <> p_household_id then
    raise exception 'Access denied: not a member of this household';
  end if;
  
  v_caller_email := auth.jwt() ->> 'email';

  return query
  select
    m.id,
    m.household_id,
    m.name,
    m.role::text,
    case
      when mi.user_id = auth.uid() then coalesce(mi.email, v_caller_email)
      else null
    end as email,
    case
      when mi.user_id = auth.uid() then mi.user_id
      else null
    end as user_id,
    (mi.user_id = auth.uid()) as is_you,
    m.created_at,
    m.updated_at
  from public.members m
  left join public.member_identities mi on mi.member_id = m.id
  where m.household_id = p_household_id
  order by m.created_at;
end;
$$;

create or replace function public.get_members_visible()
returns table (
  id uuid,
  household_id uuid,
  name text,
  role text,
  email text,
  user_id uuid,
  is_you boolean,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_household uuid;
  v_caller_email text;
begin
  v_household := public.get_user_household_id();
  if v_household is null then
    return;
  end if;
  
  v_caller_email := auth.jwt() ->> 'email';
  
  return query
  select
    m.id,
    m.household_id,
    m.name,
    m.role::text,
    case
      when mi.user_id = auth.uid() then coalesce(mi.email, v_caller_email)
      else null
    end as email,
    case
      when mi.user_id = auth.uid() then mi.user_id
      else null
    end as user_id,
    (mi.user_id = auth.uid()) as is_you,
    m.created_at,
    m.updated_at
  from public.members m
  left join public.member_identities mi on mi.member_id = m.id
  where m.household_id = v_household
  order by m.name;
end;
$$;

revoke all on function public.get_members_visible(uuid) from public;
grant execute on function public.get_members_visible(uuid) to authenticated;
revoke all on function public.get_members_visible() from public;
grant execute on function public.get_members_visible() to authenticated;

-- 10) Atualizar create_household_with_admin para usar member_identities
create or replace function public.create_household_with_admin(
  p_household_name text,
  p_user_id uuid,
  p_member_name text,
  p_member_email text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_household_id uuid;
  v_member_id uuid;
begin
  -- Create household
  insert into public.households (name) 
  values (p_household_name) 
  returning id into v_household_id;

  -- Create admin member (without user_id/email - those go to identities)
  insert into public.members (household_id, name, role)
  values (v_household_id, p_member_name, 'ADMIN')
  returning id into v_member_id;
  
  -- Create identity record with sensitive data
  insert into public.member_identities (member_id, user_id, email)
  values (v_member_id, p_user_id, p_member_email);

  -- Seed initial data
  perform public.seed_household_data(v_household_id);

  return v_household_id;
end;
$$;