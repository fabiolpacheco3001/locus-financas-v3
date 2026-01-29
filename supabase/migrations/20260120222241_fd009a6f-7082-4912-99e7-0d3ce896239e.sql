-- 1) Garantir RLS ligado e forçado
alter table if exists public.household_invites enable row level security;
alter table if exists public.household_invites force row level security;

-- 2) Remover acesso direto do client (principal correção)
revoke all on table public.household_invites from anon, authenticated;

-- 3) Dropar policies antigas e negar SELECT/INSERT/UPDATE/DELETE via client
do $$
declare r record;
begin
  for r in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'household_invites'
  loop
    execute format('drop policy if exists %I on public.household_invites;', r.policyname);
  end loop;
end $$;

create policy invites_select_none
on public.household_invites
for select
to authenticated
using (false);

create policy invites_insert_none
on public.household_invites
for insert
to authenticated
with check (false);

create policy invites_update_none
on public.household_invites
for update
to authenticated
using (false)
with check (false);

create policy invites_delete_none
on public.household_invites
for delete
to authenticated
using (false);

-- 4) RPC para LISTAR convites (sem token_hash), só admin
create or replace function public.list_household_invites(p_household_id uuid)
returns table (
  id uuid,
  invited_email text,
  role text,
  expires_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    hi.id,
    hi.invited_email,
    hi.role,
    hi.expires_at,
    hi.accepted_at,
    hi.created_at
  from public.household_invites hi
  where hi.household_id = p_household_id
    and public.is_household_admin(auth.uid(), p_household_id)
  order by hi.created_at desc;
$$;

revoke all on function public.list_household_invites(uuid) from public;
grant execute on function public.list_household_invites(uuid) to authenticated;