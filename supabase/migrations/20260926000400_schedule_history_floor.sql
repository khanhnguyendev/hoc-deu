-- Task 4.12: schedule-history floor and first-version lock (platform design §4.1, §5.9,
-- ADR-0017; M2 deferred finding, triaged to M4; rulings M4-R16, M4-R17). Merged migrations are
-- never edited: the history guard from 20260925000100 is replaced here (`create or replace` keeps
-- its owner, privileges and trigger). Its delete rule is unchanged.
--
-- 000100 let a later version start up to 5 minutes in the past, so a direct apply_event call
-- could start one at now() instead of at the next day start and move the learner's own local day
-- back; the first version could be backdated at any point in the account's life, and two
-- concurrent first inserts were not serialised (each could count as the first). Now, on insert:
-- - Every check runs under the per-user advisory lock the R14 cap takes
--   (hashtextextended('schedule_versions:' || user_id, 0); schedule_versions_limit_pending takes
--   it again), so of two concurrent inserts the second sees the first once it commits and only
--   one can count as the first. A learner's row for another user is left to RLS, which rejects it
--   after this trigger: a learner never takes another user's lock.
-- - The first version of a user (no row yet) may take effect at any time in the past while the
--   profile's onboarded_at is null: there is no past day to protect yet.
-- - Any other version takes effect no more than 5 minutes in the past (unchanged): slack for a
--   version written just before it takes effect. A request that crosses a day start (computed
--   before it, stored after it) is rejected with schedule_backdated, which the settings form
--   treats as stale: re-rendered, a retry targets the next day start.
-- - Before onboarding (onboarded_at null), a learner's version (`authenticated`) takes effect no
--   later than 5 minutes from now — onboarding sends now − 1 minute — so no version placed then
--   can take effect after onboarding at an arbitrary instant (M4-R17). A later version keeps the
--   5-minute rule only: onboarding retried from a fresh page (new event ids) sends another
--   version "from a minute ago" (M4-R16).
-- - Once onboarded_at is set, a learner's version (`authenticated`, directly or through the
--   SECURITY INVOKER apply_event), pending ones included (M4-R17):
--   - never lands before an existing pending version (other than the one an upsert replaces):
--     the app always targets the earliest pending version's effective_at;
--   - takes effect no earlier than the next day start of its predecessor — the latest version
--     with an earlier effective_at, pending or not; the default schedule when none — after
--     greatest(now(), the predecessor's effective_at), minus 65 minutes: the 5 minutes above plus
--     one hour for a day start inside a DST gap or overlap, where Postgres (the instant below) and
--     nextDayStart (the earliest instant of the next local day) can differ by the DST shift. For
--     the version in force that is the next day start the settings flow computes. A zone whose
--     shift exceeds an hour, Antarctica/Troll (2 hours), sees the settings flow's value rejected
--     on the day before its spring-forward day (last Sunday of March; day start 02:30, 90
--     minutes) and before its fall-back day (last Sunday of October; day starts 01:00-02:30, 120
--     minutes); the change succeeds the next day.
-- - service_role and SECURITY DEFINER functions (current_user is their owner) keep the pre-4.12
--   rules: the first version at any time, any other no more than 5 minutes in the past.
-- On update the 000100 rules stay (only a pending version, never moved into the past), and an
-- onboarded learner may change a pending version only while no later version is pending: the
-- later one's floor was measured from it (task 4.12 fix round 1).
create or replace function public.schedule_versions_guard_history() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_first boolean;
  v_floor_applies boolean;
  v_pred_at timestamptz;
  v_timezone text;
  v_day_starts_at time;
begin
  if tg_op = 'INSERT' then
    if current_user = 'authenticated' and new.user_id is distinct from (select auth.uid()) then
      return new;
    end if;
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('schedule_versions:' || new.user_id::text, 0)
    );
    v_first := not exists (
      select 1 from public.schedule_versions v where v.user_id = new.user_id
    );
    v_floor_applies := current_user = 'authenticated' and exists (
      select 1 from public.profiles p where p.id = new.user_id and p.onboarded_at is not null
    );
    if current_user = 'authenticated' and not v_floor_applies
      and new.effective_at > now() + interval '5 minutes'
    then
      raise exception 'schedule_backdated';
    end if;
    if v_first and not v_floor_applies then
      return new;
    end if;
    if new.effective_at < now() - interval '5 minutes' then
      raise exception 'schedule_backdated';
    end if;
    if v_floor_applies then
      if exists (
        select 1 from public.schedule_versions v
        where v.user_id = new.user_id and v.effective_at > now()
          and v.effective_at > new.effective_at
      ) then
        raise exception 'schedule_backdated';
      end if;
      select s.effective_at, s.timezone, s.day_starts_at
      into v_pred_at, v_timezone, v_day_starts_at
      from public.schedule_versions s
      where s.user_id = new.user_id and s.effective_at < new.effective_at
      order by s.effective_at desc
      limit 1;
      if not found then
        v_pred_at := null;  -- greatest() ignores it: now()
        v_timezone := 'Asia/Ho_Chi_Minh';
        v_day_starts_at := time '04:00';
      end if;
      if new.effective_at < (
        (
          (public.local_day(greatest(now(), v_pred_at), v_timezone, v_day_starts_at) + 1)
          + v_day_starts_at
        ) at time zone v_timezone
      ) - interval '65 minutes' then
        raise exception 'schedule_backdated';
      end if;
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if old.effective_at <= now() then
      raise exception 'schedule_in_force';
    end if;
    if new.effective_at < now() - interval '5 minutes' then
      raise exception 'schedule_backdated';
    end if;
    if current_user = 'authenticated'
      and exists (
        select 1 from public.profiles p where p.id = old.user_id and p.onboarded_at is not null
      )
      and exists (
        select 1 from public.schedule_versions v
        where v.user_id = old.user_id and v.effective_at > old.effective_at
      )
    then
      raise exception 'schedule_backdated';
    end if;
    return new;
  end if;

  if old.effective_at <= now()
    and exists (select 1 from public.profiles p where p.id = old.user_id)
  then
    raise exception 'schedule_in_force';
  end if;
  return old;
end $$;

-- A trigger function: no caller needs EXECUTE (the 20260925000100 revoke, restated).
revoke execute on function public.schedule_versions_guard_history()
from public, anon, authenticated;
