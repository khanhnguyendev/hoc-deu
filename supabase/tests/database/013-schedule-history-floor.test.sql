-- Task 4.12: schedule-history floor and first-version lock (platform design §4.1, §5.9,
-- ADR-0017). Once a learner has onboarded, a version they insert (directly or through
-- apply_event) takes effect no earlier than the next day start of the schedule in force at now(),
-- minus 65 minutes (5 minutes of clock skew, plus one hour for a day start inside a DST gap or
-- overlap, where Postgres and nextDayStart pick different instants), and never more than 5
-- minutes in the past. Before onboarding the pre-4.12 rules stay (the first version at any time,
-- later ones up to 5 minutes back), under the per-user advisory lock. service_role and definer
-- functions keep the pre-4.12 rules.
-- now() is the transaction's start: every statement below sees the same instant.
begin;
set client_min_messages = warning;
create extension if not exists pgtap with schema extensions;
\ir _helpers.psql

select plan(37);

select tests.create_user('floor@hocdeu.test') as floor \gset
select tests.create_user('near@hocdeu.test') as near \gset
select tests.create_user('late-first@hocdeu.test') as late_first \gset
select tests.create_user('onboarding-floor@hocdeu.test') as onboarding \gset
select tests.create_user('pair@hocdeu.test') as pair \gset
select tests.create_user('vn-floor@hocdeu.test') as vn \gset
select tests.create_user('ny-floor@hocdeu.test') as ny \gset
select tests.create_user('seeded-floor@hocdeu.test') as seeded \gset

-- A schedule whose next day start is at least 6 hours away, whatever time the suite runs:
-- Asia/Ho_Chi_Minh and America/Panama are 12 hours apart and neither has DST, so their 04:00 day
-- starts are 12 hours apart — when Vietnam's is under 6 hours away, Panama's is 12–18 hours away.
select case
  when ((public.local_day(now(), 'Asia/Ho_Chi_Minh', time '04:00') + 1) + time '04:00')
    at time zone 'Asia/Ho_Chi_Minh' - now() >= interval '6 hours'
  then 'Asia/Ho_Chi_Minh' else 'America/Panama'
end as zone \gset

-- A schedule whose next day start is at most 30 minutes away: of the same two zones, the one whose
-- wall clock reads before noon, with the next 30-minute day start after it (at most 12:00).
select v.zone as near_zone,
  (date_trunc('hour', v.local)
    + interval '30 minutes' * (floor(extract(minute from v.local) / 30) + 1))::time as near_ds
from (values ('Asia/Ho_Chi_Minh'), ('America/Panama')) as z (zone)
cross join lateral (select z.zone, now() at time zone z.zone as local) as v
where v.local::time < time '12:00' \gset

-- Onboarded learners whose schedule has been in force for 30 days (seeded as postgres; the first
-- version may lie in the past), and one onboarded learner without a version.
insert into public.schedule_versions (user_id, effective_at, timezone, day_starts_at) values
  (:'floor', now() - interval '30 days', :'zone', '04:00'),
  (:'near', now() - interval '30 days', :'near_zone', :'near_ds'),
  (:'vn', now() - interval '30 days', 'Asia/Ho_Chi_Minh', '04:00'),
  (:'ny', now() - interval '30 days', 'America/New_York', '02:30');
update public.profiles set onboarded_at = now() - interval '29 days'
where id in (:'floor', :'near', :'late_first', :'vn', :'ny', :'seeded');

-- The next day start of the schedule in force, with the rule's own expression (the brief's):
-- ((user_local_day(user, now()) + 1) + <in-force day_starts_at>) at time zone <in-force timezone>.
select ((public.user_local_day(:'floor', now()) + 1) + time '04:00') at time zone :'zone'
  as nds \gset
select ((public.local_day(now(), 'Asia/Ho_Chi_Minh', time '04:00') + 1) + time '04:00')
  at time zone 'Asia/Ho_Chi_Minh' as default_nds \gset
select ((public.user_local_day(:'vn', now()) + 1) + time '04:00') at time zone 'Asia/Ho_Chi_Minh'
  as vn_nds \gset
select ((public.user_local_day(:'ny', now()) + 1) + time '02:30') at time zone 'America/New_York'
  as ny_nds \gset

-- 1. After onboarding, a later version takes effect no earlier than the next day start − 65
--    minutes (the M2 finding: a direct apply_event call could start one now()).
select tests.authenticate_as(:'floor');
select throws_ok(
  $$insert into public.schedule_versions (user_id, effective_at) values (auth.uid(), now())$$,
  'P0001', 'schedule_backdated', 'a later version effective now() raises schedule_backdated'
);
select throws_ok(
  $$select public.apply_event(jsonb_build_object(
      'id', '41300000-0000-4000-8000-000000000001', 'type', 'schedule.changed', 'rules_version', 1,
      'payload', jsonb_build_object(
        'timezone', 'Asia/Tokyo', 'dayStartsAt', '05:00', 'effectiveAt', now())))$$,
  'P0001', 'schedule_backdated', 'apply_event schedule.changed effective now() raises it too'
);
select tests.clear_authentication();
select is(
  (select count(*)::int from public.events where id = '41300000-0000-4000-8000-000000000001'),
  0,
  '... and the rejected apply_event left no event'
);
select tests.authenticate_as(:'floor');
select throws_ok(
  format(
    $$insert into public.schedule_versions (user_id, effective_at)
      values (auth.uid(), %L::timestamptz - interval '2 hours')$$,
    :'nds'
  ),
  'P0001', 'schedule_backdated', 'a later version 2 hours before the next day start raises'
);
select throws_ok(
  format(
    $$insert into public.schedule_versions (user_id, effective_at)
      values (auth.uid(), %L::timestamptz - interval '65 minutes 1 second')$$,
    :'nds'
  ),
  'P0001', 'schedule_backdated', 'a later version 65 minutes and 1 second before it raises'
);
select lives_ok(
  format(
    $$insert into public.schedule_versions (user_id, effective_at) values (auth.uid(), %L)$$,
    :'nds'
  ),
  'a later version at the next day start of the schedule in force is fine'
);
select lives_ok(
  format(
    $$insert into public.schedule_versions (user_id, effective_at)
      values (auth.uid(), %L::timestamptz - interval '60 minutes')$$,
    :'nds'
  ),
  'a later version 60 minutes before it is fine (the tolerance)'
);
-- The cap allows 2 pending versions: the 60-minute one goes (as postgres) before the next case.
select tests.clear_authentication();
delete from public.schedule_versions
where user_id = :'floor' and effective_at = :'nds'::timestamptz - interval '60 minutes';
select tests.authenticate_as(:'floor');
select lives_ok(
  format(
    $$insert into public.schedule_versions (user_id, effective_at)
      values (auth.uid(), %L::timestamptz - interval '65 minutes')$$,
    :'nds'
  ),
  'a later version exactly 65 minutes before it is fine'
);
select lives_ok(
  format(
    $$insert into public.schedule_versions (user_id, effective_at, day_starts_at)
      values (auth.uid(), %L, '06:00')
      on conflict (user_id, effective_at) do update set day_starts_at = excluded.day_starts_at$$,
    :'nds'
  ),
  'an upsert of an existing pending version still works'
);
select results_eq(
  format(
    $$select count(*)::int,
        count(*) filter (where effective_at = %L and day_starts_at = '06:00')::int
      from public.schedule_versions where effective_at > now()$$,
    :'nds'
  ),
  $$values (2, 1)$$,
  '... it added no row and changed the pending version'
);

-- 1b. Near a day start the floor lies before now() − 5 minutes: the 5-minute rule still holds.
select tests.authenticate_as(:'near');
select throws_ok(
  $$insert into public.schedule_versions (user_id, effective_at)
    values (auth.uid(), now() - interval '10 minutes')$$,
  'P0001', 'schedule_backdated',
  'with the next day start under 30 minutes away, a version 10 minutes back still raises'
);
select lives_ok(
  $$insert into public.schedule_versions (user_id, effective_at)
    values (auth.uid(), now() - interval '4 minutes')$$,
  '... and one 4 minutes back is fine (clock skew), as before'
);

-- 2. The first version: at any time only while onboarded_at is null.
select tests.authenticate_as(:'late_first');
select throws_ok(
  format(
    $$insert into public.schedule_versions (user_id, effective_at)
      values (auth.uid(), least(now() - interval '1 minute',
                                %L::timestamptz - interval '65 minutes 1 second'))$$,
    :'default_nds'
  ),
  'P0001', 'schedule_backdated',
  'a first version for an onboarded learner, effective now() − 1 minute (or just under the floor '
  'within an hour of a day start), raises'
);
select lives_ok(
  format(
    $$insert into public.schedule_versions (user_id, effective_at) values (auth.uid(), %L)$$,
    :'default_nds'
  ),
  '... one at the next day start of the default schedule is fine'
);

select tests.authenticate_as(:'onboarding');
select is(
  public.apply_event(jsonb_build_object(
    'id', '41300000-0000-4000-8000-000000000002', 'type', 'schedule.changed', 'rules_version', 1,
    'payload', jsonb_build_object(
      'timezone', 'Asia/Tokyo', 'dayStartsAt', '05:00',
      'effectiveAt', now() - interval '1 minute'))),
  '{"outcome": "applied", "versions": {}}'::jsonb,
  'a first version during onboarding, effective now() − 1 minute (what onboarding sends), applies'
);
-- Onboarding retried from a fresh page (a new requestId, so new event ids) sends another version
-- "from a minute ago": no past day exists before onboarding, so the pre-4.12 rule applies. (It is
-- :'zone' 04:00, so the floor checked after onboarding below is hours away.)
select is(
  public.apply_event(jsonb_build_object(
    'id', '41300000-0000-4000-8000-000000000003', 'type', 'schedule.changed', 'rules_version', 1,
    'payload', jsonb_build_object(
      'timezone', :'zone', 'dayStartsAt', '04:00',
      'effectiveAt', now() - interval '30 seconds'))),
  '{"outcome": "applied", "versions": {}}'::jsonb,
  'a second version during onboarding (a retried onboarding), effective 30 seconds back, applies'
);
select throws_ok(
  $$insert into public.schedule_versions (user_id, effective_at)
    values (auth.uid(), now() - interval '1 hour')$$,
  'P0001', 'schedule_backdated', '... but one more than 5 minutes back raises, as before'
);
select tests.authenticate_as_service_role();
select is(
  public.apply_system_event(
    :'onboarding'::uuid,
    '{"id": "41300000-0000-4000-8000-000000000004", "type": "onboarding.completed", "payload": {}}'
  ),
  '{"outcome": "applied", "versions": {}}'::jsonb,
  'onboarding.completed sets onboarded_at'
);
select tests.authenticate_as(:'onboarding');
select throws_ok(
  $$select public.apply_event(jsonb_build_object(
      'id', '41300000-0000-4000-8000-000000000005', 'type', 'schedule.changed', 'rules_version', 1,
      'payload', jsonb_build_object(
        'timezone', 'Asia/Tokyo', 'dayStartsAt', '05:00', 'effectiveAt', now())))$$,
  'P0001', 'schedule_backdated', 'once onboarding.completed sets onboarded_at, the floor applies'
);

-- 3. Only one version counts as first: rows of one statement see the ones before them, and the
--    check runs under the per-user advisory lock the R14 cap takes, so two concurrent first
--    inserts serialise (the second sees the first once it commits). pgTAP runs in one session,
--    so the lock itself is pinned structurally.
select tests.authenticate_as(:'pair');
select throws_ok(
  $$insert into public.schedule_versions (user_id, effective_at)
    values (auth.uid(), now() - interval '3 days'), (auth.uid(), now() - interval '2 days')$$,
  'P0001', 'schedule_backdated',
  'two backdated first versions in one statement: the second is a later version and raises'
);
select tests.clear_authentication();
select is(
  (select count(*)::int from public.schedule_versions where user_id = :'pair'),
  0,
  '... and the statement left nothing'
);
select ok(
  (select p.prosrc ~ ('pg_advisory_xact_lock\(\s*pg_catalog\.hashtextextended\(\s*'
      '''schedule_versions:'' \|\| new\.user_id::text, 0\s*\)\s*\);'
      '.*v_first := not exists \(\s*select 1 from public\.schedule_versions')
    from pg_catalog.pg_proc p
    where p.oid = 'public.schedule_versions_guard_history()'::regprocedure),
  'the first-version check runs after the per-user advisory lock (''schedule_versions:'' || id)'
);

-- 4. The settings flow's own values at now(): nextDayStart(now, schedule in force), which equals
--    the rule's expression away from a DST change (section 5 covers the DST days).
select tests.authenticate_as(:'vn');
select is(
  public.apply_event(jsonb_build_object(
    'id', '41300000-0000-4000-8000-000000000006', 'type', 'schedule.changed', 'rules_version', 1,
    'payload', jsonb_build_object(
      'timezone', 'Asia/Bangkok', 'dayStartsAt', '05:00', 'effectiveAt', :'vn_nds'::timestamptz))),
  '{"outcome": "applied", "versions": {}}'::jsonb,
  'settings: a change for Asia/Ho_Chi_Minh 04:00 at its next day start applies'
);
select is(
  public.apply_event(jsonb_build_object(
    'id', '41300000-0000-4000-8000-000000000007', 'type', 'schedule.changed', 'rules_version', 1,
    'payload', jsonb_build_object(
      'timezone', 'Asia/Ho_Chi_Minh', 'dayStartsAt', '04:00',
      'effectiveAt', :'vn_nds'::timestamptz))),
  '{"outcome": "applied", "versions": {}}'::jsonb,
  'settings: switching back (the pending effectiveAt, the schedule in force) applies'
);
select results_eq(
  $$select timezone, day_starts_at from public.schedule_versions where effective_at > now()$$,
  $$values ('Asia/Ho_Chi_Minh'::text, '04:00'::time)$$,
  '... and replaces the pending version (one row)'
);
select tests.authenticate_as(:'ny');
select is(
  public.apply_event(jsonb_build_object(
    'id', '41300000-0000-4000-8000-000000000008', 'type', 'schedule.changed', 'rules_version', 1,
    'payload', jsonb_build_object(
      'timezone', 'America/Chicago', 'dayStartsAt', '02:30',
      'effectiveAt', :'ny_nds'::timestamptz))),
  '{"outcome": "applied", "versions": {}}'::jsonb,
  'settings: a change for America/New_York 02:30 at its next day start applies'
);
select tests.clear_authentication();

-- 5. TypeScript parity on the DST days. The nextDayStart values below were computed once with
--    `pnpm tsx -e` calling nextDayStart from lib/domain/time/localDay.ts; they are the values
--    lib/domain/time/localDay.test.ts pins ('nextDayStart'), so a change there fails first. The
--    rule's expression (at those instants: local_day in place of user_local_day) yields Postgres'
--    reading of the day start; nextDayStart takes the earliest instant whose local day is the next
--    one. Away from DST they agree; in a DST gap or overlap they differ by up to an hour, and the
--    settings flow's value must still pass the floor (expression − 65 minutes).
select is(
  ((public.local_day('2026-09-24T03:00:00Z', 'Asia/Ho_Chi_Minh', '04:00') + 1) + time '04:00')
    at time zone 'Asia/Ho_Chi_Minh',
  '2026-09-24T21:00:00Z'::timestamptz,
  'Asia/Ho_Chi_Minh 04:00 at 2026-09-24T03:00Z: the expression gives 21:00Z, as nextDayStart does'
);
select ok(
  '2026-09-24T21:00:00Z'::timestamptz >= (
    ((public.local_day('2026-09-24T03:00:00Z', 'Asia/Ho_Chi_Minh', '04:00') + 1) + time '04:00')
      at time zone 'Asia/Ho_Chi_Minh'
  ) - interval '65 minutes',
  '... and nextDayStart''s 2026-09-24T21:00Z passes the floor'
);
select is(
  ((public.local_day('2026-03-07T12:00:00Z', 'America/New_York', '02:30') + 1) + time '02:30')
    at time zone 'America/New_York',
  '2026-03-08T07:30:00Z'::timestamptz,
  'America/New_York 02:30 (skipped on 8 March 2026): Postgres reads 02:30 as EST, 07:30Z'
);
select ok(
  '2026-03-08T07:00:00Z'::timestamptz >= (
    ((public.local_day('2026-03-07T12:00:00Z', 'America/New_York', '02:30') + 1) + time '02:30')
      at time zone 'America/New_York'
  ) - interval '65 minutes',
  '... and nextDayStart''s 2026-03-08T07:00Z (03:00 EDT) passes the floor'
);
select ok(
  '2026-03-08T07:00:00Z'::timestamptz < (
    ((public.local_day('2026-03-07T12:00:00Z', 'America/New_York', '02:30') + 1) + time '02:30')
      at time zone 'America/New_York'
  ) - interval '5 minutes',
  '... which the 5-minute skew alone would have rejected'
);
select is(
  ((public.local_day('2026-10-31T12:00:00Z', 'America/New_York', '01:30') + 1) + time '01:30')
    at time zone 'America/New_York',
  '2026-11-01T06:30:00Z'::timestamptz,
  'America/New_York 01:30 (repeated on 1 November 2026): Postgres reads 01:30 as EST, 06:30Z'
);
select ok(
  '2026-11-01T05:30:00Z'::timestamptz >= (
    ((public.local_day('2026-10-31T12:00:00Z', 'America/New_York', '01:30') + 1) + time '01:30')
      at time zone 'America/New_York'
  ) - interval '65 minutes',
  '... and nextDayStart''s 2026-11-01T05:30Z (the first 01:30, EDT) passes the floor'
);
select ok(
  '2026-11-01T05:30:00Z'::timestamptz < (
    ((public.local_day('2026-10-31T12:00:00Z', 'America/New_York', '01:30') + 1) + time '01:30')
      at time zone 'America/New_York'
  ) - interval '5 minutes',
  '... which the 5-minute skew alone would have rejected'
);

-- 6. service_role and definer functions keep the pre-4.12 rules (e2e seeds an onboarded learner's
--    schedule with the secret key).
select tests.authenticate_as_service_role();
select lives_ok(
  format(
    $$insert into public.schedule_versions (user_id, effective_at)
      values (%L, now() - interval '30 days')$$,
    :'seeded'
  ),
  'service_role inserts an onboarded learner''s first version at any time'
);
select lives_ok(
  format(
    $$insert into public.schedule_versions (user_id, effective_at) values (%L, now())$$,
    :'seeded'
  ),
  'service_role inserts a later version effective now()'
);
select throws_ok(
  format(
    $$insert into public.schedule_versions (user_id, effective_at)
      values (%L, now() - interval '1 hour')$$,
    :'seeded'
  ),
  'P0001', 'schedule_backdated', '... but not one more than 5 minutes back'
);
select tests.clear_authentication();

select * from finish();
rollback;
