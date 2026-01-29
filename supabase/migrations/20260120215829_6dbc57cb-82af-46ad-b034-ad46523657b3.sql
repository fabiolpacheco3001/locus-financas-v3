
-- PATCH: Harden member_identities (RLS + minimal access + safe insert + explicit deny update/delete)

-- 0) Ensure table exists
do $$
begin
  if not exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'member_identities'
  ) then
    raise exception 'public.member_identities does not exist';
  end if;
end $$;

-- 1) Enable + FORCE RLS
alter table public.member_identities enable row level security;
alter table public.member_identities force row level security;

-- 2) Tighten privileges
revoke all on table public.member_identities from anon;
grant select, insert on table public.member_identities to authenticated;
revoke update, delete on table public.member_identities from authenticated;

-- 3) Drop old policies
drop policy if exists "mi_select_own" on public.member_identities;
drop policy if exists "mi_insert_own" on public.member_identities;
drop policy if exists "mi_update_none" on public.member_identities;
drop policy if exists "mi_delete_none" on public.member_identities;
drop policy if exists "member_identities_select_own" on public.member_identities;
drop policy if exists "member_identities_insert_bootstrap_only" on public.member_identities;
drop policy if exists "member_identities_deny_update" on public.member_identities;
drop policy if exists "member_identities_deny_delete" on public.member_identities;
drop policy if exists "mi_insert_via_rpc_only" on public.member_identities;

-- 4) SELECT: user can only see their own record
create policy "mi_select_own"
on public.member_identities
for select
to authenticated
using (user_id = auth.uid());

-- 5) INSERT: user can insert only if:
--    a) user_id matches auth.uid()
--    b) user doesn't already have an identity
--    c) member_id exists in members table and belongs to the specified household
--    d) household is empty (no existing identities) - bootstrap only
-- For existing households, use accept_household_invite RPC (SECURITY DEFINER)
create policy "mi_insert_own"
on public.member_identities
for insert
to authenticated
with check (
  user_id = auth.uid()
  and not exists (
    select 1 from public.member_identities mi
    where mi.user_id = auth.uid()
  )
  and exists (
    select 1 from public.members m
    where m.id = member_identities.member_id
      and m.household_id = member_identities.household_id
  )
  and not exists (
    select 1 from public.member_identities mi2
    where mi2.household_id = member_identities.household_id
  )
);

-- 6) Explicit deny update/delete
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

-- 7) Block email column if it exists
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'member_identities'
      and column_name = 'email'
  ) then
    revoke select (email) on table public.member_identities from authenticated;
    revoke select (email) on table public.member_identities from anon;
  end if;
end $$;

-- 8) Ensure unique constraint on user_id
create unique index if not exists member_identities_user_id_uniq
  on public.member_identities (user_id);
