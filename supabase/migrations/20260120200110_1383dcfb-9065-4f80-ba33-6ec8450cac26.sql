-- RPC para deletar convite (admin only)
create or replace function public.delete_household_invite(p_invite_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_household_id uuid;
begin
  -- Get household_id from invite
  select household_id into v_household_id
  from public.household_invites
  where id = p_invite_id;
  
  if v_household_id is null then
    return false;
  end if;
  
  -- Check if user is admin of this household
  if not public.is_household_admin(auth.uid(), v_household_id) then
    return false;
  end if;
  
  -- Delete the invite
  delete from public.household_invites where id = p_invite_id;
  
  return true;
end;
$$;

revoke all on function public.delete_household_invite(uuid) from public;
grant execute on function public.delete_household_invite(uuid) to authenticated;