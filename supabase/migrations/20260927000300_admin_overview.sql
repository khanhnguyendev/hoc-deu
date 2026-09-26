-- Task 5.6: the /admin readers and the expected-status check (platform design §2.4 /admin and
-- /admin/content, §4.3, §4.5, §8.4 item 5; implementation plan Part B-M5 decision 25; the M2 2.8
-- minor "stale Duyệt / Kích hoạt lại").
-- 1. admin_overview(): accounts by status, learners who completed a day in the last 7 days, plans
--    created in the last 7 days.
-- 2. admin_track_positions(): per track and variant, how many active learners are in each roadmap
--    week (their latest plan of the last 14 days) — the content-coverage horizon of decision 25.
-- 3. admin_set_status gains p_expected_from (a new signature replaces the old function).
-- Both readers are SECURITY DEFINER (admins have no direct read access to other users' rows,
-- §4.5), check is_admin() first and return counts only — no learner row, no note. Errors are
-- `raise exception '<code>'` like the other admin functions (20260925000300). Every function
-- revokes EXECUTE from PUBLIC explicitly and grants exactly its callers (see 20260925000100);
-- schema-invariants (001), 041 and 051 check it.

-- ---------------------------------------------------------------------------------------------
-- 1. admin_overview() → { users: { pending, active, suspended, rejected }, learners_completed_7d,
--    plans_created_7d }. "The last 7 days" of a local day: the database's date and the six days
--    before it (plus a learner's local day ahead of the database's, east of UTC).
-- ---------------------------------------------------------------------------------------------

create function public.admin_overview() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_users jsonb;
  v_learners integer;
  v_plans integer;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'pending', count(*) filter (where p.status = 'pending'),
    'active', count(*) filter (where p.status = 'active'),
    'suspended', count(*) filter (where p.status = 'suspended'),
    'rejected', count(*) filter (where p.status = 'rejected')
  )
  into v_users
  from public.profiles p;

  select count(distinct a.user_id)::integer
  into v_learners
  from public.daily_activity a
  where a.completed and a.local_day > current_date - 7;

  select count(*)::integer
  into v_plans
  from public.day_plans d
  where d.created_at > now() - interval '7 days';

  return jsonb_build_object(
    'users', v_users,
    'learners_completed_7d', v_learners,
    'plans_created_7d', v_plans
  );
end $$;

-- ---------------------------------------------------------------------------------------------
-- 2. admin_track_positions() (decision 25): for each active profile and each `active` enrollment,
-- the roadmap week of that track in the learner's latest plan dated within the last 14 days that
-- holds the track (`roadmap_weeks -> track_id`, the plan-time snapshot: its variant and week),
-- counted per (track, variant, week). A plan without the track (e.g. today's plan of the other
-- track only) does not hide an earlier one that has it — the warning errs towards showing. A
-- week that is not a whole number counts nowhere (the column is jsonb, written by the server).
-- The (user_id, plan_date) unique index serves the per-learner range.
-- ---------------------------------------------------------------------------------------------

create function public.admin_track_positions()
returns table (track_id text, variant text, week integer, learners integer)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
    with latest as (
      select distinct on (ut.user_id, ut.track_id)
        ut.track_id as track,
        coalesce(d.roadmap_weeks -> ut.track_id ->> 'variant', ut.roadmap_variant) as roadmap,
        -- CASE, so the cast only ever sees a whole number.
        case when d.roadmap_weeks -> ut.track_id ->> 'week' ~ '^[1-9][0-9]{0,3}$'
          then (d.roadmap_weeks -> ut.track_id ->> 'week')::integer
        end as roadmap_week
      from public.user_tracks ut
      join public.profiles p on p.id = ut.user_id and p.status = 'active'
      join public.day_plans d
        on d.user_id = ut.user_id
        and d.plan_date >= current_date - 14
        and d.roadmap_weeks ? ut.track_id
      where ut.status = 'active'
      order by ut.user_id, ut.track_id, d.plan_date desc
    )
    select l.track, l.roadmap, l.roadmap_week, count(*)::integer
    from latest l
    where l.roadmap_week is not null
    group by l.track, l.roadmap, l.roadmap_week
    order by 1, 2, 3;
end $$;

-- ---------------------------------------------------------------------------------------------
-- 3. admin_set_status(p_user_id, p_status, p_expected_from) — the M2 2.8 minor: the queue passes
-- the status its row was rendered with, so a stale "Duyệt" / "Kích hoạt lại" can no longer
-- re-activate an account another admin has just rejected or suspended (status_changed). Without
-- p_expected_from (or with null) it behaves as before. A new signature: the old function is
-- dropped, so exactly one admin_set_status remains (001 lists one). Otherwise unchanged from
-- 20260925000300: is_admin() first, never the acting admin, the transitions of decision 17, one
-- audit event per change.
-- ---------------------------------------------------------------------------------------------

drop function public.admin_set_status(uuid, text);

create function public.admin_set_status(
  p_user_id uuid, p_status text, p_expected_from text default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_admin constant uuid := auth.uid();
  v_from text;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_user_id = v_admin then
    raise exception 'cannot_change_self';
  end if;
  select p.status into v_from from public.profiles p where p.id = p_user_id for update;
  if not found then
    raise exception 'not_found';
  end if;
  -- The row the admin acted on showed another status: someone decided first.
  if p_expected_from is not null and p_expected_from is distinct from v_from then
    raise exception 'status_changed';
  end if;
  -- pending -> active | rejected, active -> suspended, suspended | rejected -> active.
  if not coalesce(
    (v_from = 'pending' and p_status in ('active', 'rejected'))
      or (v_from = 'active' and p_status = 'suspended')
      or (v_from in ('suspended', 'rejected') and p_status = 'active'),
    false
  ) then
    raise exception 'invalid_transition';
  end if;

  update public.profiles p set
    status = p_status,
    approved_by = case when p_status = 'active' then v_admin else p.approved_by end,
    approved_at = case when p_status = 'active' then now() else p.approved_at end
  where p.id = p_user_id;

  insert into public.events (id, user_id, actor_id, source, type, payload)
  values (
    gen_random_uuid(), p_user_id, v_admin, 'admin',
    case p_status
      when 'active' then 'admin.user_approved'
      when 'rejected' then 'admin.user_rejected'
      else 'admin.user_suspended'
    end,
    jsonb_build_object('targetUserId', p_user_id, 'from', v_from, 'to', p_status)
  );

  return jsonb_build_object('from', v_from, 'to', p_status);
end $$;

-- ---------------------------------------------------------------------------------------------
-- Function privileges (controller ruling R5): PUBLIC's default EXECUTE and Supabase's default
-- grants are revoked, then only signed-in users may call them (each checks is_admin() itself).
-- ---------------------------------------------------------------------------------------------

revoke execute on function
  public.admin_overview(),
  public.admin_track_positions(),
  public.admin_set_status(uuid, text, text)
from public, anon, authenticated, service_role;

grant execute on function
  public.admin_overview(),
  public.admin_track_positions(),
  public.admin_set_status(uuid, text, text)
to authenticated;
