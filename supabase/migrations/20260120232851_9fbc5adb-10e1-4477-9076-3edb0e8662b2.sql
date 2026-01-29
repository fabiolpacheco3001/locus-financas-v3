
-- =========================================
-- PATCH: household_invites header-based token access
-- =========================================

-- 1) Helper: get request headers
create or replace function public._request_headers()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(nullif(current_setting('request.headers', true), '')::jsonb, '{}'::jsonb);
$$;

-- 2) Helper: get specific header
create or replace function public._get_header(name text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select nullif(public._request_headers() ->> lower(name), '');
$$;

-- 3) Add RLS policy for token-based access via header
drop policy if exists invites_select_by_token on public.household_invites;
create policy invites_select_by_token
on public.household_invites
for select
to authenticated
using (
  token_hash = public.hash_invite_token(public._get_header('x-invite-token'))
  and accepted_at is null
  and (expires_at is null or expires_at > now())
);

-- 4) RPC: Preview invite by token (doesn't require SELECT policy)
create or replace function public.get_household_invite_preview(p_token text)
returns table(household_id uuid, expires_at timestamptz, is_valid boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text;
  v_row public.household_invites%rowtype;
begin
  v_hash := public.hash_invite_token(p_token);

  select *
  into v_row
  from public.household_invites
  where token_hash = v_hash
  limit 1;

  if not found then
    household_id := null;
    expires_at := null;
    is_valid := false;
    return next;
    return;
  end if;

  household_id := v_row.household_id;
  expires_at := v_row.expires_at;

  is_valid := (v_row.accepted_at is null)
             and (v_row.expires_at is null or v_row.expires_at > now());

  return next;
end;
$$;

grant execute on function public.get_household_invite_preview(text) to authenticated;
