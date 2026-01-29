
-- 3) Limpar policies antigas (corrigido: policyname, não polname)
do $$
declare r record;
begin
  for r in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'member_identities'
  loop
    execute format('drop policy if exists %I on public.member_identities;', r.policyname);
  end loop;
end $$;

-- 4) Privilégios mínimos
revoke all on table public.member_identities from anon, authenticated;
grant select on table public.member_identities to authenticated;

-- 5) Policies seguras

-- 5.1) Usuário só enxerga o próprio vínculo
create policy member_identities_select_own
on public.member_identities
for select
to authenticated
using (user_id = auth.uid());

-- 5.2) INSERT: somente bootstrap seguro (household vazio)
-- Para households existentes, o RPC accept_household_invite (SECURITY DEFINER) faz o insert
create policy member_identities_insert_bootstrap_only
on public.member_identities
for insert
to authenticated
with check (
  user_id = auth.uid()
  and not exists (
    select 1 from public.member_identities mi
    where mi.user_id = auth.uid()
  )
  and not exists (
    select 1 from public.member_identities mi2
    where mi2.household_id = member_identities.household_id
  )
);

-- 5.3) UPDATE/DELETE: proibidos
create policy member_identities_deny_update
on public.member_identities
for update
to authenticated
using (false)
with check (false);

create policy member_identities_deny_delete
on public.member_identities
for delete
to authenticated
using (false);
