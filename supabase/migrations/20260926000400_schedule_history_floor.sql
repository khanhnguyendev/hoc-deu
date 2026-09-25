-- Task 4.12: schedule-history floor and first-version lock (platform design §4.1, §5.9,
-- ADR-0017; M2 deferred finding, triaged to M4). Merged migrations are never edited: the history
-- guard from 20260925000100 is replaced here (`create or replace` keeps its owner, privileges and
-- trigger). Its update and delete rules are unchanged.
--
-- 000100 let a later version start up to 5 minutes in the past, so a direct apply_event call
-- could start one at now() instead of at the next day start and move the learner's own local day
-- back; the first version could be backdated at any point in the account's life, and two
-- concurrent first inserts were not serialised (each could count as the first). Insert rules now:
-- - Every check runs under the per-user advisory lock the R14 cap takes
--   (hashtextextended('schedule_versions:' || user_id, 0); schedule_versions_limit_pending takes
--   it again), so of two concurrent inserts the second sees the first once it commits and only
--   one can count as the first. A learner's row for another user is left to RLS, which rejects it
--   after this trigger: a learner never takes another user's lock.
-- - The first version of a user (no row yet) may take effect at any time while the profile's
--   onboarded_at is null: there is no past day to protect yet.
-- - Any other version takes effect no more than 5 minutes in the past (clock skew; unchanged).
-- - Once onboarded_at is set, a version inserted by `authenticated` (directly or through the
--   SECURITY INVOKER apply_event) also takes effect no earlier than the next day start of the
--   version in force at now() — the default schedule when none is — minus 65 minutes: 5 minutes of
--   clock skew plus one hour for a day start inside a DST gap or overlap, where Postgres (the
--   instant below) and nextDayStart (the earliest instant of the next local day) can differ by
--   the DST shift. A zone whose shift exceeds an hour (Antarctica/Troll, 2 hours) can see the
--   settings flow's value rejected on its fall-back day; the change then succeeds the next day.
-- - Before onboarding a later version keeps the 5-minute rule only: onboarding retried from a
--   fresh page (new event ids) sends another version "from a minute ago" (task 4.12 decision).
-- - service_role and SECURITY DEFINER functions (current_user is their owner) keep the pre-4.12
--   rules: the first version at any time, any other no more than 5 minutes in the past.
create or replace function public.schedule_versions_guard_history() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_first boolean;
  v_onboarded boolean;
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
    v_onboarded := current_user = 'authenticated' and exists (
      select 1 from public.profiles p where p.id = new.user_id and p.onboarded_at is not null
    );
    if v_first and not v_onboarded then
      return new;
    end if;
    if new.effective_at < now() - interval '5 minutes' then
      raise exception 'schedule_backdated';
    end if;
    if v_onboarded then
      select s.timezone, s.day_starts_at into v_timezone, v_day_starts_at
      from public.schedule_versions s
      where s.user_id = new.user_id and s.effective_at <= now()
      order by s.effective_at desc
      limit 1;
      if not found then
        v_timezone := 'Asia/Ho_Chi_Minh';
        v_day_starts_at := time '04:00';
      end if;
      if new.effective_at < (
        ((public.user_local_day(new.user_id, now()) + 1) + v_day_starts_at)
          at time zone v_timezone
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
