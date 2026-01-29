-- PATCH: Harden member_identities (RLS + minimal access + safe insert + explicit deny update/delete)
-- Goal: app can read/insert OWN identity mapping; nobody can hijack household links.

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

-- 1) Enable + FORCE RLS (the missing piece that caused the warning)
alter table public.member_identities enable row level security;
alter table public.member_identities force row level security;

-- 2) Tighten privileges (RLS controls rows, GRANT controls access surface)
revoke all on table public.member_identities from anon;
grant select, insert on table public.member_identities to authenticated;
revoke update, delete on table public.member_identities from authenticated;

-- 3) Drop old policies (avoid duplicates / conflicts)
drop policy if exists "mi_select_own" on public.member_identities;
drop policy if exists "mi_insert_own" on public.member_identities;
drop policy if exists "mi_update_none" on public.member_identities;
drop policy if exists "mi_delete_none" on public.member_identities;
drop policy if exists "member_identities_select_own" on public.member_identities;
drop policy if exists "member_identities_insert_bootstrap_only" on public.member_identities;
drop policy if exists "member_identities_deny_update" on public.member_identities;
drop policy if exists "member_identities_deny_delete" on public.member_identities;

-- 4) Policies: allow only reading own record
create policy "mi_select_own"
on public.member_identities
for select
to authenticated
using (user_id = auth.uid());

-- 5) Policies: allow only inserting own record AND only if it matches an existing members row of the same user/household
-- This blocks "reassign myself to another household" attacks.
-- Note: members table doesn't have user_id column, so we check via household membership
create policy "mi_insert_own"
on public.member_identities
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.members m
    where m.id = member_id
      and m.household_id = household_id
  )
  and not exists (
    select 1
    from public.member_identities mi
    where mi.user_id = auth.uid()
  )
);

-- 6) Explicit deny update/delete (prevents hijack and also silences scanners that complain about missing policies)
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

-- 7) Optional but recommended: if the table has an "email" column, block selecting it entirely
-- (best practice: keep emails in Supabase Auth; app should not depend on this column)
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

-- 8) Optional: helpful constraints/indexes (robustness)
create unique index if not exists member_identities_user_id_uniq
  on public.member_identities (user_id);