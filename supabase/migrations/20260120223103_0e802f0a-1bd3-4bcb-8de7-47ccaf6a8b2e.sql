-- Drop existing function with old return type first
drop function if exists public.accept_household_invite(text, text);

-- accept_household_invite: seta flags para UPDATE invite + INSERT identity
create or replace function public.accept_household_invite(
  p_token text,
  p_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text;
  v_inv public.household_invites%rowtype;
  v_email text;
  v_member_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if exists (select 1 from public.member_identities where user_id = auth.uid()) then
    raise exception 'identity_already_exists';
  end if;

  v_hash := public.hash_invite_token(p_token);

  select * into v_inv
  from public.household_invites
  where token_hash = v_hash
    and accepted_at is null
    and expires_at > now()
  limit 1;

  if v_inv.id is null then
    raise exception 'invite_invalid_or_expired';
  end if;

  v_email := lower((auth.jwt() ->> 'email')::text);
  if v_email is null or v_email <> v_inv.invited_email_lower then
    raise exception 'invite_email_mismatch';
  end if;

  insert into public.members (household_id, name, role)
  values (
    v_inv.household_id,
    coalesce(p_name, split_part(v_inv.invited_email, '@', 1)),
    v_inv.role
  )
  returning id into v_member_id;

  perform set_config('app.identity_write', 'invite', true);
  insert into public.member_identities (user_id, household_id, member_id)
  values (auth.uid(), v_inv.household_id, v_member_id);

  perform set_config('app.invite_accept', '1', true);
  update public.household_invites
    set accepted_at = now(), accepted_by_user_id = auth.uid()
  where id = v_inv.id;

  return v_inv.household_id;
end;
$$;

revoke all on function public.accept_household_invite(text, text) from public;
grant execute on function public.accept_household_invite(text, text) to authenticated;