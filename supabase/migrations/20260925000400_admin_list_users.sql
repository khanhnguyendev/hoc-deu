-- Task 2.8: the approval queue's reader (platform design §2.4 /admin/users, §4.3, §4.5;
-- decision 19). Admins have no direct read access to other users' profiles or to auth.users, so
-- /admin/users reads them through this SECURITY DEFINER function, which checks is_admin() first.
-- It returns account fields only — no notes, no events (§4.5). Errors are
-- `raise exception '<code>'`, like the other admin functions (20260925000300).

create function public.admin_list_users()
returns table (
  id uuid,
  email text,
  display_name text,
  avatar_url text,
  role text,
  status text,
  created_at timestamptz,
  approved_at timestamptz,
  onboarded_at timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- The queue first: pending accounts, oldest sign-up first (first come, first served); then
  -- everyone else, newest first. The id breaks ties, so the order is stable.
  return query
    select p.id, u.email::text, p.display_name, p.avatar_url, p.role, p.status, p.created_at,
      p.approved_at, p.onboarded_at
    from public.profiles p
    join auth.users u on u.id = p.id
    order by
      p.status = 'pending' desc,
      case when p.status = 'pending' then p.created_at end asc,
      p.created_at desc,
      p.id;
end $$;

-- Function privileges (controller ruling R5): PUBLIC's default EXECUTE and Supabase's default
-- grants are revoked, then only signed-in users may call it (the function checks is_admin()).
-- schema-invariants (001) lists it in the authenticated allowlist; 050 checks the grants.
revoke execute on function public.admin_list_users()
from public, anon, authenticated, service_role;

grant execute on function public.admin_list_users() to authenticated;
