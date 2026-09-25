begin;
set client_min_messages = warning;
create extension if not exists pgtap with schema extensions;
\ir _helpers.psql

select plan(54);

select tests.create_user('events-learner@hocdeu.test') as learner \gset
select tests.create_user('events-other@hocdeu.test') as other \gset
select tests.create_user('events-pending@hocdeu.test', 'pending') as pending \gset
select tests.create_user('events-stjohns@hocdeu.test') as stjohns \gset
select tests.create_user('events-default@hocdeu.test') as no_schedule \gset
select tests.create_user('events-two-versions@hocdeu.test') as two_versions \gset
select tests.create_user('events-quota@hocdeu.test') as quota \gset
select tests.create_user('events-size@hocdeu.test') as size \gset
select tests.create_user('events-deleted@hocdeu.test') as deleted \gset

-- Schedules, as postgres. A user's first version may be backdated; a later one may not (2.4
-- history trigger), so the second version of two_versions starts tomorrow. Pacific/Pago_Pago 12:00
-- runs ~26 h behind the default (Asia/Ho_Chi_Minh 04:00), so the two never give the same local
-- day at any instant: checks against it cannot pass by accident at some time of day.
insert into public.schedule_versions (user_id, effective_at, timezone, day_starts_at) values
  (:'learner', now() - interval '30 days', 'Pacific/Pago_Pago', '12:00'),
  (:'stjohns', '2026-01-01T00:00:00Z', 'America/St_Johns', '04:00'),
  (:'two_versions', now() - interval '30 days', 'Pacific/Pago_Pago', '12:00');
insert into public.schedule_versions (user_id, effective_at, timezone, day_starts_at)
values (:'two_versions', now() + interval '1 day', 'Pacific/Kiritimati', '00:00');

-- 0. Shape: triggers fire in name order; policies; table privileges.
select triggers_are(
  'public', 'events', array['events_10_prepare', 'events_20_quota', 'events_append_only'],
  'events has the prepare, quota and append-only triggers'
);
select policies_are(
  'public', 'events', array['events_select_own', 'events_insert_own'],
  'events has select-own and insert-own policies'
);
select policies_are('public', 'event_quota', array[]::name[], 'event_quota has no policies');
select table_privs_are(
  'public', 'events', 'authenticated', array['SELECT', 'INSERT'],
  'authenticated may only select and insert events'
);
select table_privs_are(
  'public', 'event_quota', 'authenticated', array[]::text[],
  'authenticated has no privilege on event_quota'
);

-- 1. A direct learner insert: source, actor_id, occurred_at and rules_version are forced;
--    local_day is computed from the user's schedule and never taken from input.
select isnt(
  public.local_day(now(), 'Pacific/Pago_Pago', '12:00'),
  public.local_day(now(), 'Asia/Ho_Chi_Minh', '04:00'),
  '(Pago_Pago 12:00 and the default never give the same day, so the schedule used is observable)'
);
select tests.authenticate_as(:'learner');
select lives_ok(
  format(
    $$insert into public.events
        (id, user_id, actor_id, source, type, occurred_at, local_day, rules_version)
      values ('00000000-0000-4000-8000-000000000001', %L, %L, 'admin', 'item.skipped',
              '2000-01-01T00:00:00Z', '1999-12-31', 999)$$,
    :'learner', :'other'
  ),
  'an active user inserts an event directly'
);
select results_eq(
  $$select source, actor_id, occurred_at, local_day, rules_version, payload from public.events
    where id = '00000000-0000-4000-8000-000000000001'$$,
  format(
    $$values ('learner'::text, %L::uuid, now(),
              public.local_day(now(), 'Pacific/Pago_Pago', '12:00'), 2, '{}'::jsonb)$$,
    :'learner'
  ),
  'it is stored as learner, by the user, at now(), on their local day, with rules_version 2 (not 999)'
);

-- 2. [RF-1] local_day follows the schedule version in force at occurred_at. (Section 1 covers a
--    learner insert with a version; St_Johns is checked at a fixed instant below, because at now()
--    it gives the same day as the default for much of the day.)
select tests.authenticate_as(:'no_schedule');
insert into public.events (id, user_id, type)
values ('00000000-0000-4000-8000-000000000003', auth.uid(), 'item.readded');
select is(
  (select local_day from public.events where id = '00000000-0000-4000-8000-000000000003'),
  public.local_day(now(), 'Asia/Ho_Chi_Minh', '04:00'),
  'with no version the trigger uses Asia/Ho_Chi_Minh 04:00'
);

-- System events (as postgres) keep their occurred_at, so the same instant can be checked under
-- both schedules: 06:00Z is 03:30 NDT (before the day start) but 13:00 in Ho Chi Minh City.
-- Regression: the trigger already ran as authenticated (no_schedule) in this transaction, so this
-- also checks that user_local_day does not reuse a plan built under that learner's RLS.
select tests.clear_authentication();
insert into public.events (id, user_id, source, type, occurred_at, payload) values
  ('00000000-0000-4000-8000-000000000004', :'stjohns', 'system', 'plan.generated',
   '2026-09-24T06:00:00Z', '{"mode": "baseline", "planVersion": 1}'),
  ('00000000-0000-4000-8000-000000000005', :'no_schedule', 'system', 'plan.generated',
   '2026-09-24T06:00:00Z', '{"mode": "baseline", "planVersion": 1}');
select results_eq(
  $$select id, source, occurred_at, local_day from public.events
    where id in ('00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000005')
    order by id$$,
  $$values
    ('00000000-0000-4000-8000-000000000004'::uuid, 'system'::text,
     '2026-09-24T06:00:00Z'::timestamptz, '2026-09-23'::date),
    ('00000000-0000-4000-8000-000000000005'::uuid, 'system'::text,
     '2026-09-24T06:00:00Z'::timestamptz, '2026-09-24'::date)$$,
  'the trigger uses a version America/St_Johns 04:00 effective in the past (2026-09-23), and '
  'Asia/Ho_Chi_Minh 04:00 without one (2026-09-24); a system event keeps source and occurred_at'
);
select is(
  (select actor_id from public.events where id = '00000000-0000-4000-8000-000000000004'),
  :'stjohns'::uuid,
  'actor_id defaults to user_id when null'
);

select is(
  public.user_local_day(:'two_versions', now()),
  public.local_day(now(), 'Pacific/Pago_Pago', '12:00'),
  'user_local_day at now() uses the backdated first version'
);
select is(
  public.user_local_day(:'two_versions', now() + interval '2 days'),
  public.local_day(now() + interval '2 days', 'Pacific/Kiritimati', '00:00'),
  'user_local_day at now() + 2 days uses the second version'
);
select is(
  public.user_local_day(:'two_versions', now() + interval '1 day'),
  public.local_day(now() + interval '1 day', 'Pacific/Kiritimati', '00:00'),
  'a version is in force from its effective_at itself'
);
select isnt(
  public.local_day(now() + interval '2 days', 'Pacific/Pago_Pago', '12:00'),
  public.local_day(now() + interval '2 days', 'Pacific/Kiritimati', '00:00'),
  '(the two versions give different days at any instant, so the pick is observable)'
);
select is(
  public.user_local_day(:'two_versions', now() - interval '31 days'),
  public.local_day(now() - interval '31 days', 'Asia/Ho_Chi_Minh', '04:00'),
  'before the first version user_local_day uses Asia/Ho_Chi_Minh 04:00'
);
-- two_versions' version in force now is Pago_Pago 12:00, which never matches the default (see the
-- isnt in section 1), so a leak would show at any time of day.
select tests.authenticate_as(:'learner');
select is(
  public.user_local_day(:'two_versions', now()),
  public.local_day(now(), 'Asia/Ho_Chi_Minh', '04:00'),
  'user_local_day is security invoker: another user''s versions are invisible to a learner'
);

-- 3. Learners insert only learner types, only for themselves, only while active.
select lives_ok(
  $$insert into public.events (id, user_id, type, payload)
    values (gen_random_uuid(), auth.uid(), 'block.checked_in', '{"status": "done", "minutes": 30}')$$,
  'a learner inserts block.checked_in (a type in both lists)'
);
select throws_ok(
  $$insert into public.events (id, user_id, type)
    values (gen_random_uuid(), auth.uid(), 'admin.user_approved')$$,
  '42501', 'forbidden_event_type', 'a learner cannot insert admin.user_approved'
);
select throws_ok(
  $$insert into public.events (id, user_id, type)
    values (gen_random_uuid(), auth.uid(), 'plan.generated')$$,
  '42501', 'forbidden_event_type', 'a learner cannot insert plan.generated'
);
select throws_ok(
  format(
    $$insert into public.events (id, user_id, type) values (gen_random_uuid(), %L, 'item.skipped')$$,
    :'other'
  ),
  '42501', 'forbidden_user_id', 'a learner cannot insert an event for another user'
);
select throws_ok(
  $$insert into public.events (id, user_id, type)
    values (gen_random_uuid(), '00000000-0000-4000-8000-00000000dead', 'item.skipped')$$,
  '42501', 'forbidden_user_id',
  'a learner inserting for a nonexistent user gets 42501 too (not a foreign-key error)'
);
select tests.authenticate_as(:'pending');
select throws_ok(
  $$insert into public.events (id, user_id, type)
    values (gen_random_uuid(), auth.uid(), 'item.skipped')$$,
  '42501', 'new row violates row-level security policy for table "events"',
  'a pending user cannot insert an event'
);
select tests.authenticate_as(:'other');
select is(
  (select count(*)::int from public.events),
  0,
  'another user''s events are invisible'
);
select tests.clear_authentication();
select throws_ok(
  format(
    $$insert into public.events (id, user_id, source, type)
      values (gen_random_uuid(), %L, 'system', 'Plan.Generated')$$,
    :'learner'
  ),
  '23514', 'new row for relation "events" violates check constraint "events_type_check"',
  'a type that is not lower_snake.lower_snake fails the check'
);

-- 4. Append-only: learners have no UPDATE or DELETE privilege (checked before any trigger); the
--    trigger stops everyone else.
select tests.authenticate_as(:'learner');
select throws_ok(
  $$update public.events set payload = '{"x": 1}' where user_id = auth.uid()$$,
  '42501', 'permission denied for table events', 'a learner cannot update an event'
);
select throws_ok(
  $$delete from public.events where user_id = auth.uid()$$,
  '42501', 'permission denied for table events', 'a learner cannot delete an event'
);
select tests.clear_authentication();
select throws_ok(
  $$update public.events set payload = '{"x": 1}'
    where id = '00000000-0000-4000-8000-000000000001'$$,
  'P0001', 'events_are_append_only', 'postgres cannot update an event either'
);

-- 5. Quota: 500 learner events per user and local day; system events are not counted.
select tests.authenticate_as(:'quota');
select lives_ok(
  $sql$
    do $do$
    begin
      for i in 1..500 loop
        insert into public.events (id, user_id, type, payload)
        values (gen_random_uuid(), auth.uid(), 'item.result', '{"result": "solved"}');
      end loop;
    end $do$
  $sql$,
  '500 learner inserts on one local day succeed'
);
select throws_ok(
  $$insert into public.events (id, user_id, type, payload)
    values (gen_random_uuid(), auth.uid(), 'item.result', '{"result": "solved"}')$$,
  'P0001', 'quota_exceeded', 'the 501st raises quota_exceeded'
);
select tests.clear_authentication();
select results_eq(
  format($$select local_day, count from public.event_quota where user_id = %L$$, :'quota'),
  $$values (public.local_day(now(), 'Asia/Ho_Chi_Minh', '04:00'), 500)$$,
  'the counter for that local day is 500'
);
select lives_ok(
  format(
    $$insert into public.events (id, user_id, source, type, payload)
      values (gen_random_uuid(), %L, 'system', 'plan.generated',
              '{"mode": "baseline", "planVersion": 1}')$$,
    :'quota'
  ),
  'a system event for the same user and day still succeeds'
);
select is(
  (select q.count from public.event_quota q where q.user_id = :'quota'),
  500,
  'the counter stays 500'
);
select is(
  (select count(*)::int from public.events where user_id = :'quota'),
  501,
  'the user has 500 learner events and one system event'
);
select lives_ok(
  format(
    $$insert into public.events (id, user_id, source, type, occurred_at, payload)
      values (gen_random_uuid(), %L, 'learner', 'item.result', now() + interval '1 day',
              '{"result": "solved"}')$$,
    :'quota'
  ),
  'a learner event on the next local day is accepted'
);
select is(
  (select q.count from public.event_quota q
    where q.user_id = :'quota'
      and q.local_day = public.local_day(now() + interval '1 day', 'Asia/Ho_Chi_Minh', '04:00')),
  1,
  '... and starts a new counter'
);

-- 6. event_quota is internal: no learner access at all.
select tests.authenticate_as(:'quota');
select throws_ok(
  $$select * from public.event_quota$$,
  '42501', 'permission denied for table event_quota', 'a learner cannot read event_quota'
);
select throws_ok(
  $$insert into public.event_quota (user_id, local_day) values (auth.uid(), current_date)$$,
  '42501', 'permission denied for table event_quota', 'a learner cannot insert into event_quota'
);
select throws_ok(
  $$update public.event_quota set count = 0$$,
  '42501', 'permission denied for table event_quota', 'a learner cannot reset event_quota'
);

-- 7. Payload size: at most 2048 bytes as payload::text; always an object. Id lengths are capped.
select tests.authenticate_as(:'size');
select lives_ok(
  $$insert into public.events (id, user_id, type, payload)
    values (gen_random_uuid(), auth.uid(), 'block.checked_in',
            jsonb_build_object('n', repeat('x', 2039)))$$,
  'a payload of exactly 2048 bytes is accepted'
);
select throws_ok(
  $$insert into public.events (id, user_id, type, payload)
    values (gen_random_uuid(), auth.uid(), 'block.checked_in',
            jsonb_build_object('n', repeat('x', 2040)))$$,
  '23514', 'new row for relation "events" violates check constraint "events_payload_check"',
  'a payload over 2 KB fails'
);
select throws_ok(
  $$insert into public.events (id, user_id, type, payload)
    values (gen_random_uuid(), auth.uid(), 'block.checked_in', '[]')$$,
  '23514', 'new row for relation "events" violates check constraint "events_payload_check"',
  'a payload that is not an object fails'
);

-- TypeScript's jsonbTextBytes must equal octet_length(payload::text): the same payloads are
-- measured in lib/domain/events.test.ts (199, 84 and 1894 bytes).
insert into public.events (id, user_id, type, payload) values
  ('00000000-0000-4000-8000-00000000000a', auth.uid(), 'track.updated',
   '{"budgetMinutes":60,"newPerDay":null,"throttle":[{"dueAbove":30,"newPerDay":1},{"dueAbove":80,"newPerDay":0}],"weeklyTemplate":{"sat":90,"days":["mon","tue"]},"includeBonus":true}'),
  ('00000000-0000-4000-8000-00000000000b', auth.uid(), 'block.checked_in',
   '{"status":"done","minutes":30,"note":"Ôn \"two pointers\"\nxong ệ\t\\ 😀"}');
select results_eq(
  $$select octet_length(payload::text) from public.events
    where id in ('00000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-00000000000b')
    order by id$$,
  $$values (199), (84)$$,
  'payload::text sizes match jsonbTextBytes (nested objects and arrays; escapes and UTF-8)'
);
select tests.clear_authentication();
select lives_ok(
  format(
    $$insert into public.events (id, user_id, source, type, payload)
      values ('00000000-0000-4000-8000-00000000000c', %L, 'system', 'plan.extra_added',
              jsonb_build_object('itemIds',
                (select jsonb_agg('dsa:x'::text) from generate_series(1, 209))))$$,
    :'size'
  ),
  'the largest itemIds payload parseEventPayload accepts (209 ids) is accepted'
);
select is(
  (select octet_length(payload::text) from public.events
    where id = '00000000-0000-4000-8000-00000000000c'),
  1894,
  '... and is 1894 bytes as payload::text, as jsonbTextBytes computes'
);

select tests.authenticate_as(:'size');
select lives_ok(
  $$insert into public.events (id, user_id, type, track_id, item_id, block_id)
    values (gen_random_uuid(), auth.uid(), 'item.skipped',
            repeat('t', 32), repeat('i', 128), repeat('b', 128))$$,
  'track_id up to 32 bytes and item_id, block_id up to 128 bytes are accepted'
);
select throws_ok(
  $$insert into public.events (id, user_id, type, track_id)
    values (gen_random_uuid(), auth.uid(), 'item.skipped', repeat('t', 33))$$,
  '23514', 'new row for relation "events" violates check constraint "events_track_id_check"',
  'a track_id over 32 bytes fails'
);
select throws_ok(
  $$insert into public.events (id, user_id, type, item_id)
    values (gen_random_uuid(), auth.uid(), 'item.skipped', repeat('i', 129))$$,
  '23514', 'new row for relation "events" violates check constraint "events_item_id_check"',
  'an item_id over 128 bytes fails'
);
select throws_ok(
  $$insert into public.events (id, user_id, type, block_id)
    values (gen_random_uuid(), auth.uid(), 'item.skipped', repeat('b', 129))$$,
  '23514', 'new row for relation "events" violates check constraint "events_block_id_check"',
  'a block_id over 128 bytes fails'
);
select throws_ok(
  $$insert into public.events (id, user_id, type, item_id)
    values (gen_random_uuid(), auth.uid(), 'item.skipped', repeat('ệ', 43))$$,
  '23514', 'new row for relation "events" violates check constraint "events_item_id_check"',
  'the limits are bytes: 43 three-byte characters (129 bytes) fail'
);

-- 8. Deleting the auth user removes their events and quota rows; audit rows they acted in stay.
select tests.authenticate_as(:'deleted');
insert into public.events (id, user_id, type)
values ('00000000-0000-4000-8000-000000000008', auth.uid(), 'item.skipped');
select tests.clear_authentication();
insert into public.events (id, user_id, actor_id, source, type, payload)
values (
  '00000000-0000-4000-8000-000000000009', :'other', :'deleted', 'admin', 'admin.user_approved',
  jsonb_build_object('targetUserId', :'other'::text, 'from', 'pending', 'to', 'active')
);
select is(
  (select count(*)::int from public.event_quota where user_id = :'deleted'),
  1,
  'the user to delete has a quota row'
);
delete from auth.users where id = :'deleted';
select is(
  (select count(*)::int from public.events where user_id = :'deleted'),
  0,
  'deleting the auth user removes their events'
);
select is(
  (select count(*)::int from public.event_quota where user_id = :'deleted'),
  0,
  '... and their quota rows'
);
select results_eq(
  $$select user_id, actor_id from public.events
    where id = '00000000-0000-4000-8000-000000000009'$$,
  format($$values (%L::uuid, %L::uuid)$$, :'other', :'deleted'),
  'an admin event whose actor was the deleted user survives'
);

select * from finish();
rollback;
