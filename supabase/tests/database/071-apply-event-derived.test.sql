begin;
set client_min_messages = warning;
create extension if not exists pgtap with schema extensions;
\ir _helpers.psql

select plan(91);

-- Task 4.9b: apply_event with derived changes, versions and locks (platform design §4.3, §4.4,
-- §4.5, §5.9; implementation plan Part B-M4 decisions 9, 10, 27, 33, 36). Case 11 — every M2 case
-- of 040 with its four updated expectations — is 040 itself, run in the same suite.

-- A learner event as lib/events/apply.ts sends it: snake_case keys and rules_version 1 — an older
-- client's. The events trigger stores rules_version() (2), and the derived rows take the stored one.
create function tests.event(
  p_id text, p_type text, p_track text default null, p_payload jsonb default '{}'::jsonb,
  p_item text default null, p_plan text default null, p_block text default null,
  p_local_day text default null
) returns jsonb language sql immutable as $$
  select jsonb_strip_nulls(jsonb_build_object(
      'id', p_id, 'type', p_type, 'track_id', p_track, 'item_id', p_item, 'plan_id', p_plan,
      'block_id', p_block, 'local_day', p_local_day))
    || jsonb_build_object('payload', p_payload, 'rules_version', 1)
$$;

-- One p_changes element.
create function tests.change(p_table text, p_row jsonb) returns jsonb
language sql immutable as $$
  select jsonb_build_object('table', p_table, 'row', p_row)
$$;

-- An item_state row as lib/events/derived.ts sends it; p_patch replaces fields.
create function tests.item_row(p_item text, p_patch jsonb default '{}'::jsonb) returns jsonb
language sql immutable as $$
  select jsonb_build_object(
      'item_id', p_item, 'track_id', 'dsa', 'topic_id', 'arrays', 'item_type', 'problem',
      'level', 1, 'weak', false, 'top_successes', 0, 'status', 'ok', 'due_on', '2026-10-03',
      'last_result', 'solved', 'last_result_on', '2026-09-26', 'introduced_on', '2026-09-26',
      'lapses', 0, 'reps', 1)
    || p_patch
$$;

-- A daily_activity row.
create function tests.day_row(p_day text, p_items_done integer) returns jsonb
language sql immutable as $$
  select jsonb_build_object(
    'local_day', p_day, 'minutes_by_track', '{}'::jsonb, 'items_done', p_items_done,
    'completed', false)
$$;

-- A plan_block_state row for the learner's plan; p_patch replaces fields.
create function tests.block_row(p_plan text, p_block text, p_patch jsonb default '{}'::jsonb)
returns jsonb language sql immutable as $$
  select jsonb_build_object(
      'plan_id', p_plan, 'block_id', p_block, 'track_id', 'dsa', 'status', 'done', 'minutes', 20,
      'note', null, 'auto', false)
    || p_patch
$$;

-- The signed-in caller's local day now, as the app writes it (YYYY-MM-DD, whatever DateStyle).
create function tests.today() returns text language sql stable as $$
  select to_char(public.user_local_day(auth.uid(), now()), 'YYYY-MM-DD')
$$;

-- Whether this transaction holds the bigint advisory lock `p_key` (pg_locks splits it into its
-- high 32 bits, classid, and low 32 bits, objid, with objsubid 1).
create function tests.holds_advisory_lock(p_key bigint) returns boolean
language sql stable as $$
  select exists (
    select 1 from pg_catalog.pg_locks l
    where l.locktype = 'advisory' and l.pid = pg_catalog.pg_backend_pid() and l.granted
      and l.objsubid = 1
      and l.classid::bigint = (p_key >> 32) & 4294967295
      and l.objid::bigint = p_key & 4294967295
  )
$$;

grant execute on function
  tests.event(text, text, text, jsonb, text, text, text, text),
  tests.change(text, jsonb),
  tests.item_row(text, jsonb),
  tests.day_row(text, integer),
  tests.block_row(text, text, jsonb),
  tests.today(),
  tests.holds_advisory_lock(bigint)
to authenticated, service_role;

select tests.create_user('derived-apply-learner@hocdeu.test') as learner \gset
select tests.create_user('derived-apply-other@hocdeu.test') as other \gset
select tests.create_user('derived-apply-reset@hocdeu.test') as reset_user \gset
select tests.create_user('derived-apply-resume@hocdeu.test') as resume_user \gset
select tests.create_user('derived-apply-enroll@hocdeu.test') as enroll_user \gset
-- Every user here has the default schedule, so they share one local day.
select to_char(public.user_local_day(:'learner', now()), 'YYYY-MM-DD') as today \gset

-- Plans are written only by the server (apply_system_event, 4.9c): inserted here as postgres.
insert into public.day_plans (id, user_id, plan_date, blocks) values
  ('71000000-0000-4000-8000-0000000000a1', :'learner', :'today',
   '[{"id": "b-review", "trackId": "dsa", "kind": "review", "estMinutes": 20, "items": []},
     {"id": "b-new", "trackId": "dsa", "kind": "new", "estMinutes": 30, "items": []}]'),
  ('71000000-0000-4000-8000-0000000000a2', :'other', :'today',
   '[{"id": "b-review", "trackId": "dsa", "kind": "review", "estMinutes": 20, "items": []}]');
insert into public.user_tracks (user_id, track_id, roadmap_variant, start_date, budget_minutes)
values (:'learner', 'dsa', '10w', '2026-09-25', 60);
-- The other user's item: a reset or resume of anyone else's track never touches it.
insert into public.item_state
  (user_id, item_id, track_id, topic_id, item_type, level, status, due_on, last_result,
   last_result_on, introduced_on, reps)
values
  (:'other', 'dsa:p1', 'dsa', 'arrays', 'problem', 1, 'ok', '2026-10-05', 'solved', '2026-09-28',
   '2026-09-28', 1);

-- ---------------------------------------------------------------------------------------------
-- 0. Shape: both functions run as the caller; apply_derived_changes is callable by exactly
--    authenticated and service_role, and never for another user.
-- ---------------------------------------------------------------------------------------------
select results_eq(
  $$select p.proname::text collate "default", p.prosecdef,
           p.proconfig = array['search_path=""'] collate "C"
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('apply_event', 'apply_derived_changes')
    order by 1$$,
  $$values ('apply_derived_changes'::text, false, true), ('apply_event', false, true)$$,
  'apply_event and apply_derived_changes are SECURITY INVOKER with an empty search_path'
);
select results_eq(
  $$select r.rolname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    cross join (values ('anon'::text), ('authenticated'), ('service_role')) as r (rolname)
    where n.nspname = 'public' and p.proname = 'apply_derived_changes'
      and has_function_privilege(r.rolname, p.oid, 'EXECUTE')
    order by 1$$,
  $$values ('authenticated'::text), ('service_role')$$,
  'apply_derived_changes: EXECUTE for authenticated and service_role only (anon: none)'
);
select tests.authenticate_as(:'learner');
select throws_ok(
  format(
    $$select public.apply_derived_changes(
        %L, '{"type": "item.skipped", "item_id": "dsa:lc-0001"}', %L::date,
        jsonb_build_array(tests.change('item_state', tests.item_row('dsa:lc-0001'))),
        '{"item_state:dsa:lc-0001": 0}')$$,
    :'other', :'today'
  ),
  '42501', 'forbidden', 'a learner calling apply_derived_changes for another user raises forbidden'
);
select tests.clear_authentication();
-- Before any plan event, the learner's plan lock is not held (checked again after case 5).
select ok(
  not tests.holds_advisory_lock(public.plan_lock_key(:'learner', :'today')),
  'no transaction holds the learner''s plan lock yet'
);

-- ---------------------------------------------------------------------------------------------
-- 1. item.result with a new item_state row and a new daily_activity row (expected 0): stored for
--    the caller whatever the row says, version 1, the event's (stored) rules_version.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_as(:'learner');
select is(
  public.apply_event(
    tests.event(
      '71000000-0000-4000-8000-000000000001', 'item.result', 'dsa', '{"result": "solved"}',
      p_item => 'dsa:lc-0001', p_local_day => tests.today()
    ),
    jsonb_build_array(
      tests.change('item_state', tests.item_row(
        'dsa:lc-0001', jsonb_build_object('user_id', :'other', 'version', 7, 'rules_version', 1))),
      tests.change('daily_activity',
        tests.day_row(tests.today(), 1) || jsonb_build_object('user_id', :'other', 'version', 7))
    ),
    jsonb_build_object('item_state:dsa:lc-0001', 0, 'daily_activity:' || tests.today(), 0)
  ),
  jsonb_build_object(
    'outcome', 'applied',
    'versions', jsonb_build_object('item_state:dsa:lc-0001', 1, 'daily_activity:' || tests.today(), 1)
  ),
  'item.result with item_state and daily_activity (expected 0) returns applied, version 1 each'
);
select tests.clear_authentication();
select results_eq(
  $$select user_id, version, rules_version, level, due_on, status, reps
    from public.item_state where item_id = 'dsa:lc-0001'$$,
  format($$values (%L::uuid, 1, 2, 1, '2026-10-03'::date, 'ok'::text, 1)$$, :'learner'),
  '... the item_state row is the caller''s (not the row''s user_id), version 1, rules_version 2'
);
select results_eq(
  format(
    $$select user_id, local_day, items_done, completed, version, rules_version
      from public.daily_activity where user_id in (%L, %L)$$,
    :'learner', :'other'
  ),
  format($$values (%L::uuid, %L::date, 1, false, 1, 2)$$, :'learner', :'today'),
  '... and so is the daily_activity row'
);
select is(
  (select count(*)::int from public.events where user_id = :'learner'), 1, '... with one event'
);
select is(
  (select count from public.event_quota where user_id = :'learner'), 1, '... counted once'
);

-- ---------------------------------------------------------------------------------------------
-- 2. [RF-2] The same event id again — even with other changes — is a duplicate: nothing changes.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_as(:'learner');
select is(
  public.apply_event(
    tests.event(
      '71000000-0000-4000-8000-000000000001', 'item.result', 'dsa', '{"result": "failed"}',
      p_item => 'dsa:lc-0001'
    ),
    jsonb_build_array(
      tests.change('item_state', tests.item_row('dsa:lc-0001', '{"level": 5, "weak": true}'))),
    '{"item_state:dsa:lc-0001": 1}'
  ),
  '{"outcome": "duplicate", "versions": {}}'::jsonb,
  'the same event id with other changes returns duplicate'
);
select tests.clear_authentication();
select results_eq(
  $$select level, weak, version from public.item_state where item_id = 'dsa:lc-0001'$$,
  $$values (1, false, 1)$$,
  '... and leaves the item_state row unchanged'
);
select is(
  (select count(*)::int from public.events where user_id = :'learner'), 1, '... still one event'
);
select is(
  (select count from public.event_quota where user_id = :'learner'), 1, '... and the quota unchanged'
);

-- ---------------------------------------------------------------------------------------------
-- 3. [RF-2] Version conflicts roll the whole call back: no event row, no quota increment, no
--    derived row changed — also one the same call changed before the conflict.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_as(:'learner');
select throws_ok(
  $$select public.apply_event(
      tests.event(
        '71000000-0000-4000-8000-000000000003', 'item.result', 'dsa', '{"result": "hint"}',
        p_item => 'dsa:lc-0001'),
      jsonb_build_array(tests.change('item_state', tests.item_row('dsa:lc-0001', '{"level": 2}'))),
      '{"item_state:dsa:lc-0001": 0}')$$,
  'P0001', 'version_conflict', 'expected 0 for a row that exists raises version_conflict'
);
select tests.clear_authentication();
select is(
  (select count(*)::int from public.events where id = '71000000-0000-4000-8000-000000000003'),
  0,
  '... and no event row remains'
);
select is(
  (select count from public.event_quota where user_id = :'learner'), 1, '... nor a quota increment'
);
select results_eq(
  $$select level, version from public.item_state where item_id = 'dsa:lc-0001'$$,
  $$values (1, 1)$$,
  '... and the row is unchanged'
);

select tests.authenticate_as(:'learner');
select is(
  public.apply_event(
    tests.event(
      '71000000-0000-4000-8000-000000000004', 'item.result', 'dsa', '{"result": "solved"}',
      p_item => 'dsa:lc-0001'
    ),
    jsonb_build_array(tests.change(
      'item_state', tests.item_row('dsa:lc-0001', '{"level": 2, "due_on": "2026-10-17"}'))),
    '{"item_state:dsa:lc-0001": 1}'
  ),
  '{"outcome": "applied", "versions": {"item_state:dsa:lc-0001": 2}}'::jsonb,
  'expected 1 for the row at version 1 updates it to version 2'
);
select tests.clear_authentication();
select results_eq(
  format(
    $$select user_id, level, due_on, version, rules_version
      from public.item_state where item_id = 'dsa:lc-0001'$$
  ),
  format($$values (%L::uuid, 2, '2026-10-17'::date, 2, 2)$$, :'learner'),
  '... with the row''s new values'
);
select is(
  (select count from public.event_quota where user_id = :'learner'), 2, '... and one more event counted'
);

select tests.authenticate_as(:'learner');
select throws_ok(
  format(
    $$select public.apply_event(
        tests.event(
          '71000000-0000-4000-8000-000000000005', 'item.result', 'dsa', '{"result": "hint"}',
          p_item => 'dsa:lc-0001'),
        jsonb_build_array(
          tests.change('daily_activity', tests.day_row(%1$L, 2)),
          tests.change('item_state', tests.item_row('dsa:lc-0001', '{"level": 3}'))),
        jsonb_build_object('daily_activity:' || %1$L, 1, 'item_state:dsa:lc-0001', 1))$$,
    :'today'
  ),
  'P0001', 'version_conflict',
  'expected 1 for the row at version 2 raises version_conflict (after a daily_activity update)'
);
select tests.clear_authentication();
select is(
  (select count(*)::int from public.events where id = '71000000-0000-4000-8000-000000000005'),
  0,
  '... and no event row remains'
);
select is(
  (select count from public.event_quota where user_id = :'learner'), 2, '... nor a quota increment'
);
select results_eq(
  format(
    $$select items_done, version from public.daily_activity where user_id = %L$$, :'learner'
  ),
  $$values (1, 1)$$,
  '... and the daily_activity row the call updated first is rolled back'
);
select results_eq(
  $$select level, version from public.item_state where item_id = 'dsa:lc-0001'$$,
  $$values (2, 2)$$,
  '... as is the item_state row'
);

-- ---------------------------------------------------------------------------------------------
-- 4. invalid_event: each change needs its p_expected key and nothing else; a row only for the
--    event's item, plan and block; only the tables the event type allows; the argument shapes.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_as(:'learner');
select throws_ok(
  $$select public.apply_event(
      tests.event(gen_random_uuid()::text, 'item.result', 'dsa', '{"result": "solved"}',
                  p_item => 'dsa:lc-0002'),
      jsonb_build_array(tests.change('item_state', tests.item_row('dsa:lc-0002'))),
      '{}')$$,
  'P0001', 'invalid_event', 'a change without its p_expected key raises invalid_event'
);
select throws_ok(
  $$select public.apply_event(
      tests.event(gen_random_uuid()::text, 'item.result', 'dsa', '{"result": "solved"}',
                  p_item => 'dsa:lc-0002'),
      jsonb_build_array(tests.change('item_state', tests.item_row('dsa:lc-0002'))),
      '{"item_state:dsa:lc-0002": 0, "item_state:dsa:lc-0003": 0}')$$,
  'P0001', 'invalid_event', 'a p_expected key without its change raises invalid_event'
);
select throws_ok(
  $$select public.apply_event(
      tests.event(gen_random_uuid()::text, 'item.result', 'dsa', '{"result": "solved"}',
                  p_item => 'dsa:lc-0002'),
      jsonb_build_array(tests.change('item_state', tests.item_row('dsa:lc-0003'))),
      '{"item_state:dsa:lc-0003": 0}')$$,
  'P0001', 'invalid_event', 'an item_state change for another item than the event''s raises invalid_event'
);
select throws_ok(
  $$select public.apply_event(
      tests.event(gen_random_uuid()::text, 'item.result', 'dsa', '{"result": "solved"}',
                  p_item => 'dsa:lc-0002', p_plan => '71000000-0000-4000-8000-0000000000a1',
                  p_block => 'b-new'),
      jsonb_build_array(tests.change(
        'plan_block_state', tests.block_row('71000000-0000-4000-8000-0000000000a1', 'b-new'))),
      '{"plan_block_state:71000000-0000-4000-8000-0000000000a1/b-new": 0}')$$,
  'P0001', 'invalid_event',
  'plan_block_state on an item.result raises invalid_event (even for the event''s plan and block)'
);
select throws_ok(
  $$select public.apply_event(
      tests.event(gen_random_uuid()::text, 'track.updated', 'dsa', '{"budgetMinutes": 30}'),
      jsonb_build_array(tests.change('daily_activity', tests.day_row(tests.today(), 5))),
      jsonb_build_object('daily_activity:' || tests.today(), 1))$$,
  'P0001', 'invalid_event', 'any change on a track.updated raises invalid_event'
);
select throws_ok(
  $$select public.apply_event(
      tests.event(gen_random_uuid()::text, 'item.skipped', 'dsa', p_item => 'dsa:lc-0001'),
      jsonb_build_array(tests.change('daily_activity', tests.day_row(tests.today(), 5))),
      jsonb_build_object('daily_activity:' || tests.today(), 1))$$,
  'P0001', 'invalid_event', 'daily_activity on an item.skipped raises invalid_event'
);
select throws_ok(
  $$select public.apply_event(
      tests.event(gen_random_uuid()::text, 'item.result', 'dsa', '{"result": "solved"}',
                  p_item => 'dsa:lc-0002'),
      jsonb_build_array(
        tests.change('item_state', tests.item_row('dsa:lc-0002')),
        tests.change('item_state', tests.item_row('dsa:lc-0002', '{"level": 2}'))),
      '{"item_state:dsa:lc-0002": 0}')$$,
  'P0001', 'invalid_event', 'two changes of one row raise invalid_event'
);
select throws_ok(
  $$select public.apply_event(
      tests.event(gen_random_uuid()::text, 'item.result', 'dsa', '{"result": "solved"}',
                  p_item => 'dsa:lc-0002'),
      jsonb_build_array(tests.change('item_state', tests.item_row('dsa:lc-0002'))),
      '{"item_state:dsa:lc-0002": "0"}')$$,
  'P0001', 'invalid_event', 'an expected version that is not a JSON number raises invalid_event'
);
select throws_ok(
  $$select public.apply_event(
      tests.event(gen_random_uuid()::text, 'item.result', 'dsa', '{"result": "solved"}',
                  p_item => 'dsa:lc-0001'),
      jsonb_build_array(tests.change('item_state', tests.item_row('dsa:lc-0001'))),
      '{"item_state:dsa:lc-0001": -1}')$$,
  'P0001', 'invalid_event', '... or a negative one'
);
select throws_ok(
  $$select public.apply_event(
      tests.event(gen_random_uuid()::text, 'item.result', 'dsa', '{"result": "solved"}',
                  p_item => 'dsa:lc-0002'),
      '{"table": "item_state"}',
      '{}')$$,
  'P0001', 'invalid_event', 'a p_changes that is not an array raises invalid_event'
);
select throws_ok(
  $$select public.apply_event(
      tests.event(gen_random_uuid()::text, 'item.result', 'dsa', '{"result": "solved"}',
                  p_item => 'dsa:lc-0002'),
      '[]',
      '[]')$$,
  'P0001', 'invalid_event', 'a p_expected that is not an object raises invalid_event'
);
-- New daily_activity rows far from today: within the 16-change bound they reach the window
-- trigger (invalid_local_day); one more change is refused before any write.
select throws_ok(
  $$select public.apply_event(
      tests.event(gen_random_uuid()::text, 'item.result', 'dsa', '{"result": "solved"}',
                  p_item => 'dsa:lc-0002'),
      (select jsonb_agg(tests.change(
          'daily_activity', tests.day_row(to_char(date '2000-01-01' + g, 'YYYY-MM-DD'), 1)))
       from generate_series(1, 16) g),
      (select jsonb_object_agg('daily_activity:' || to_char(date '2000-01-01' + g, 'YYYY-MM-DD'), 0)
       from generate_series(1, 16) g))$$,
  'P0001', 'invalid_local_day', '16 changes pass the bound (these then fail the window trigger)'
);
select throws_ok(
  $$select public.apply_event(
      tests.event(gen_random_uuid()::text, 'item.result', 'dsa', '{"result": "solved"}',
                  p_item => 'dsa:lc-0002'),
      (select jsonb_agg(tests.change(
          'daily_activity', tests.day_row(to_char(date '2000-01-01' + g, 'YYYY-MM-DD'), 1)))
       from generate_series(1, 17) g),
      (select jsonb_object_agg('daily_activity:' || to_char(date '2000-01-01' + g, 'YYYY-MM-DD'), 0)
       from generate_series(1, 17) g))$$,
  'P0001', 'invalid_event', '17 changes raise invalid_event'
);
select throws_ok(
  $$select public.apply_event(
      tests.event(gen_random_uuid()::text, 'block.checked_in', 'dsa',
                  '{"status": "done", "minutes": 20}',
                  p_plan => '71000000-0000-4000-8000-0000000000a1'))$$,
  'P0001', 'invalid_event', 'a block.checked_in without block_id raises invalid_event'
);
select throws_ok(
  $$select public.apply_event(
      tests.event(gen_random_uuid()::text, 'block.checked_in', null,
                  '{"status": "done", "minutes": 20}',
                  p_plan => '71000000-0000-4000-8000-0000000000a1', p_block => 'b-new'))$$,
  'P0001', 'invalid_event', '... or without track_id'
);
select throws_ok(
  $$select public.apply_event(
      tests.event(gen_random_uuid()::text, 'item.skipped', 'dsa', p_item => 'dsa:lc-0001',
                  p_local_day => '2026-02-30'))$$,
  'P0001', 'invalid_event', 'a local_day that is not a date raises invalid_event'
);
select throws_ok(
  $$select public.apply_event(
      tests.event(gen_random_uuid()::text, 'item.skipped', 'dsa', p_item => 'dsa:lc-0001')
        || '{"local_day": null}')$$,
  'P0001', 'invalid_event', '... and so does a JSON null local_day'
);
select tests.clear_authentication();
select is(
  (select count(*)::int from public.events where user_id = :'learner'), 2,
  '... and none of them left an event row'
);
select is(
  (select count(*)::int from public.item_state where item_id in ('dsa:lc-0002', 'dsa:lc-0003')),
  0,
  '... or an item_state row'
);

-- ---------------------------------------------------------------------------------------------
-- 5. block.checked_in: the first check-in's local day is checked_in_on; a later update keeps it
--    and bumps version (decision 6).
-- ---------------------------------------------------------------------------------------------
select ok(
  not tests.holds_advisory_lock(public.plan_lock_key(:'learner', :'today')),
  'the failed plan events above left no plan lock (their subtransactions rolled back)'
);
select tests.authenticate_as(:'learner');
select is(
  public.apply_event(
    tests.event(
      '71000000-0000-4000-8000-000000000051', 'block.checked_in', 'dsa',
      '{"status": "done", "minutes": 20}', p_plan => '71000000-0000-4000-8000-0000000000a1',
      p_block => 'b-review', p_local_day => tests.today()
    ),
    jsonb_build_array(tests.change('plan_block_state', tests.block_row(
      '71000000-0000-4000-8000-0000000000a1', 'b-review',
      jsonb_build_object('checked_in_on', '2000-01-01', 'user_id', :'other')))),
    '{"plan_block_state:71000000-0000-4000-8000-0000000000a1/b-review": 0}'
  ),
  '{"outcome": "applied",
    "versions": {"plan_block_state:71000000-0000-4000-8000-0000000000a1/b-review": 1}}'::jsonb,
  'block.checked_in with a new plan_block_state row returns applied, version 1'
);
select tests.clear_authentication();
select results_eq(
  $$select user_id, status, minutes, checked_in_on, checked_in_at, version, rules_version
    from public.plan_block_state
    where plan_id = '71000000-0000-4000-8000-0000000000a1' and block_id = 'b-review'$$,
  format(
    $$values (%L::uuid, 'done'::text, 20, %L::date, now(), 1, 2)$$, :'learner', :'today'
  ),
  '... stored for the caller, checked_in_on the event''s local day (not the row''s), checked_in_at now()'
);

-- 6 (lock). The plan lock (decision 33) is still held by this transaction.
select ok(
  tests.holds_advisory_lock(public.plan_lock_key(:'learner', :'today')),
  'the transaction holds the (user, plan_date) advisory lock: plan_lock_key''s high and low 32 bits'
);

-- A later day's edit: the stored check-in is moved to yesterday (as the first transaction of
-- yesterday would have left it), then updated today.
update public.plan_block_state
set checked_in_on = checked_in_on - 1, checked_in_at = '2026-01-01T00:00:00Z'
where plan_id = '71000000-0000-4000-8000-0000000000a1' and block_id = 'b-review';
select tests.authenticate_as(:'learner');
select is(
  public.apply_event(
    tests.event(
      '71000000-0000-4000-8000-000000000052', 'block.checked_in', 'dsa',
      '{"status": "partial", "minutes": 10, "note": "Ôn lại"}',
      p_plan => '71000000-0000-4000-8000-0000000000a1', p_block => 'b-review'
    ),
    jsonb_build_array(tests.change('plan_block_state', tests.block_row(
      '71000000-0000-4000-8000-0000000000a1', 'b-review',
      jsonb_build_object(
        'status', 'partial', 'minutes', 10, 'note', 'Ôn lại', 'checked_in_on', tests.today())))),
    '{"plan_block_state:71000000-0000-4000-8000-0000000000a1/b-review": 1}'
  ),
  '{"outcome": "applied",
    "versions": {"plan_block_state:71000000-0000-4000-8000-0000000000a1/b-review": 2}}'::jsonb,
  'an update of the check-in (expected 1) returns version 2'
);
select tests.clear_authentication();
select results_eq(
  $$select status, minutes, note, checked_in_on, checked_in_at, version
    from public.plan_block_state
    where plan_id = '71000000-0000-4000-8000-0000000000a1' and block_id = 'b-review'$$,
  format(
    $$values ('partial'::text, 10, 'Ôn lại'::text, %L::date - 1, now(), 2)$$, :'today'
  ),
  '... keeps checked_in_on (the first check-in''s day), sets checked_in_at to now()'
);

-- ---------------------------------------------------------------------------------------------
-- 6. A block.checked_in naming another user's plan, or a plan that does not exist, is
--    invalid_event (the plan lookup runs under RLS before the lock and the insert).
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_as(:'learner');
select throws_ok(
  $$select public.apply_event(
      tests.event(gen_random_uuid()::text, 'block.checked_in', 'dsa',
                  '{"status": "done", "minutes": 20}',
                  p_plan => '71000000-0000-4000-8000-0000000000a2', p_block => 'b-review'),
      jsonb_build_array(tests.change(
        'plan_block_state', tests.block_row('71000000-0000-4000-8000-0000000000a2', 'b-review'))),
      '{"plan_block_state:71000000-0000-4000-8000-0000000000a2/b-review": 0}')$$,
  'P0001', 'invalid_event', 'a block.checked_in naming another user''s plan raises invalid_event'
);
select throws_ok(
  $$select public.apply_event(
      tests.event(gen_random_uuid()::text, 'block.checked_in', 'dsa',
                  '{"status": "done", "minutes": 20}',
                  p_plan => '71000000-0000-4000-8000-0000000000ff', p_block => 'b-review'))$$,
  'P0001', 'invalid_event', '... and so does one naming a plan that does not exist'
);
select tests.clear_authentication();
select is(
  (select count(*)::int from public.plan_block_state
    where plan_id = '71000000-0000-4000-8000-0000000000a2'),
  0,
  '... and the other user''s plan has no block state'
);
select is(
  (select count(*)::int from public.events where user_id = :'learner'), 4,
  '... and neither left an event row (4: two results, two check-ins)'
);

-- ---------------------------------------------------------------------------------------------
-- 7. Decision 10: a local_day that differs from the database's (a request crossing the day
--    start) raises day_changed, and nothing is stored.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_as(:'learner');
select throws_ok(
  $$select public.apply_event(
      tests.event(
        '71000000-0000-4000-8000-000000000071', 'item.result', 'dsa', '{"result": "solved"}',
        p_item => 'dsa:lc-0001',
        p_local_day => to_char(public.user_local_day(auth.uid(), now()) - 1, 'YYYY-MM-DD')),
      jsonb_build_array(tests.change('item_state', tests.item_row('dsa:lc-0001', '{"level": 3}'))),
      '{"item_state:dsa:lc-0001": 2}')$$,
  'P0001', 'day_changed', 'a local_day other than the database''s raises day_changed'
);
select tests.clear_authentication();
select is(
  (select count(*)::int from public.events where id = '71000000-0000-4000-8000-000000000071'),
  0,
  '... no event row remains'
);
select is(
  (select count from public.event_quota where user_id = :'learner'), 4, '... nor a quota increment'
);
select results_eq(
  $$select level, version from public.item_state where item_id = 'dsa:lc-0001'$$,
  $$values (2, 2)$$,
  '... and the item_state row is unchanged'
);

-- ---------------------------------------------------------------------------------------------
-- 8. track.reset (decision 9): deletes only that track's item_state rows and sets reset_on to
--    the event's local day; events, check-ins and daily activity stay. An active or paused track
--    only.
-- ---------------------------------------------------------------------------------------------
insert into public.user_tracks (user_id, track_id, roadmap_variant, start_date, budget_minutes)
values (:'reset_user', 'dsa', '10w', '2026-09-25', 60),
       (:'reset_user', 'english', '10w', '2026-09-25', 25);
insert into public.item_state (user_id, item_id, track_id, item_type, status, introduced_on) values
  (:'reset_user', 'dsa:p1', 'dsa', 'problem', 'ok', '2026-09-20'),
  (:'reset_user', 'dsa:p2', 'dsa', 'problem', 'weak', '2026-09-20'),
  (:'reset_user', 'english:e1', 'english', 'flashcard', 'ok', '2026-09-20');
insert into public.daily_activity (user_id, local_day, items_done) values
  (:'reset_user', '2026-09-20', 2);
select tests.authenticate_as(:'reset_user');
select is(
  public.apply_event(tests.event(gen_random_uuid()::text, 'track.reset', 'dsa')),
  '{"outcome": "applied", "versions": {}}'::jsonb,
  'track.reset returns applied'
);
select tests.clear_authentication();
select results_eq(
  format($$select item_id from public.item_state where user_id = %L order by 1$$, :'reset_user'),
  $$values ('english:e1'::text)$$,
  '... deletes that track''s item_state rows only'
);
select results_eq(
  format($$select item_id, due_on from public.item_state where user_id = %L$$, :'other'),
  $$values ('dsa:p1'::text, '2026-10-05'::date)$$,
  '... and never another user''s'
);
select results_eq(
  format(
    $$select track_id, reset_on, status from public.user_tracks where user_id = %L order by 1$$,
    :'reset_user'
  ),
  format(
    $$values ('dsa'::text, %L::date, 'active'::text), ('english', null, 'active')$$, :'today'
  ),
  '... sets reset_on to the event''s local day on that track only'
);
select results_eq(
  format(
    $$select (select count(*)::int from public.daily_activity where user_id = %1$L),
             (select count(*)::int from public.events where user_id = %1$L)$$,
    :'reset_user'
  ),
  $$values (1, 1)$$,
  '... and keeps the daily activity and the event'
);
insert into public.item_state (user_id, item_id, track_id, item_type, status, introduced_on)
values (:'reset_user', 'dsa:p3', 'dsa', 'problem', 'ok', '2026-09-26');
select tests.authenticate_as(:'reset_user');
select lives_ok(
  $$select public.apply_event(tests.event(gen_random_uuid()::text, 'track.paused', 'dsa'));
    select public.apply_event(tests.event(gen_random_uuid()::text, 'track.reset', 'dsa'))$$,
  'a paused track can be reset'
);
select is(
  (select count(*)::int from public.item_state where track_id = 'dsa'), 0,
  '... which deletes its rows again'
);
select lives_ok(
  $$select public.apply_event(tests.event(gen_random_uuid()::text, 'track.removed', 'english'))$$,
  'removing english runs'
);
select throws_ok(
  $$select public.apply_event(tests.event(gen_random_uuid()::text, 'track.reset', 'english'))$$,
  'P0001', 'invalid_transition', 'track.reset on a removed track raises invalid_transition'
);
select throws_ok(
  $$select public.apply_event(tests.event(gen_random_uuid()::text, 'track.reset', 'sql'))$$,
  'P0001', 'track_not_enrolled', 'track.reset on a track not enrolled raises track_not_enrolled'
);
select tests.clear_authentication();
select results_eq(
  format(
    $$select item_id from public.item_state where user_id = %L order by 1$$, :'reset_user'
  ),
  $$values ('english:e1'::text)$$,
  '... and neither deletes anything'
);
select is(
  (select reset_on from public.user_tracks where user_id = :'reset_user' and track_id = 'english'),
  null,
  '... nor sets reset_on'
);

-- ---------------------------------------------------------------------------------------------
-- 9. track.resumed shifts the track's due dates by pausedDays (§5.9, decision 9) — the fixture of
--    lib/domain/projection/project.test.ts ("track.reset and track.resumed", 4.2): dsa:p1 due
--    2026-10-05, a lesson and a skipped problem with no due date, english:e1 due 2026-09-29.
--    pausedDays must be a JSON integer 0–3650 (decision 36).
-- ---------------------------------------------------------------------------------------------
insert into public.user_tracks (user_id, track_id, roadmap_variant, start_date, budget_minutes)
values (:'resume_user', 'dsa', '8w', '2026-09-28', 60),
       (:'resume_user', 'english', '10w', '2026-09-28', 25);
insert into public.item_state
  (user_id, item_id, track_id, topic_id, item_type, level, weak, top_successes, status, due_on,
   last_result, last_result_on, introduced_on, lapses, reps)
values
  (:'resume_user', 'dsa:p1', 'dsa', 'arrays', 'problem', 1, false, 0, 'ok', '2026-10-05',
   'solved', '2026-09-28', '2026-09-28', 0, 1),
  (:'resume_user', 'dsa:lesson-arrays', 'dsa', 'arrays', 'lesson', 0, false, 0, 'ok', null,
   'completed', '2026-09-28', '2026-09-28', 0, 1),
  (:'resume_user', 'dsa:p2', 'dsa', 'arrays', 'problem', 0, false, 0, 'skipped', null,
   'solved', '2026-09-28', '2026-09-28', 0, 0),
  (:'resume_user', 'english:e1', 'english', 'standup', 'flashcard', 1, false, 0, 'ok',
   '2026-09-29', 'solved', '2026-09-28', '2026-09-28', 0, 1);

select tests.authenticate_as(:'resume_user');
select is(
  public.apply_event(tests.event(gen_random_uuid()::text, 'track.paused', 'dsa')),
  '{"outcome": "applied", "versions": {}}'::jsonb,
  'track.paused returns applied'
);
select throws_ok(
  $$select public.apply_event(
      tests.event(gen_random_uuid()::text, 'track.resumed', 'dsa', '{"pausedDays": "5"}'))$$,
  'P0001', 'invalid_event', 'track.resumed with pausedDays "5" (a string) raises invalid_event'
);
select throws_ok(
  $$select public.apply_event(
      tests.event(gen_random_uuid()::text, 'track.resumed', 'dsa', '{"pausedDays": -1}'))$$,
  'P0001', 'invalid_event', '... with -1'
);
select throws_ok(
  $$select public.apply_event(
      tests.event(gen_random_uuid()::text, 'track.resumed', 'dsa', '{"pausedDays": 3651}'))$$,
  'P0001', 'invalid_event', '... with 3651'
);
select throws_ok(
  $$select public.apply_event(
      tests.event(gen_random_uuid()::text, 'track.resumed', 'dsa', '{"pausedDays": 2.5}'))$$,
  'P0001', 'invalid_event', '... with 2.5'
);
select throws_ok(
  $$select public.apply_event(
      tests.event(gen_random_uuid()::text, 'track.resumed', 'dsa', '{"pausedDays": 1e20}'))$$,
  'P0001', 'invalid_event', '... and with 1e20 (checked before any integer cast)'
);
select tests.clear_authentication();
select results_eq(
  format(
    $$select item_id, due_on, version from public.item_state where user_id = %L order by 1$$,
    :'resume_user'
  ),
  $$values ('dsa:lesson-arrays'::text, null::date, 1), ('dsa:p1', '2026-10-05', 1),
           ('dsa:p2', null, 1), ('english:e1', '2026-09-29', 1)$$,
  '... and nothing is shifted'
);
select is(
  (select status from public.user_tracks where user_id = :'resume_user' and track_id = 'dsa'),
  'paused',
  '... nor resumed'
);

select tests.authenticate_as(:'resume_user');
select is(
  public.apply_event(
    tests.event(gen_random_uuid()::text, 'track.resumed', 'dsa', '{"pausedDays": 5}')
  ),
  '{"outcome": "applied", "versions": {}}'::jsonb,
  'track.resumed {pausedDays: 5} returns applied'
);
select tests.clear_authentication();
select results_eq(
  format(
    $$select item_id, due_on, version from public.item_state where user_id = %L order by 1$$,
    :'resume_user'
  ),
  $$values ('dsa:lesson-arrays'::text, null::date, 1), ('dsa:p1', '2026-10-10', 2),
           ('dsa:p2', null, 1), ('english:e1', '2026-09-29', 1)$$,
  '... shifts that track''s due dates by 5 and bumps their version; null stays null, english is '
  'untouched (4.2''s expectation)'
);
select results_eq(
  format($$select due_on, version from public.item_state where user_id = %L$$, :'other'),
  $$values ('2026-10-05'::date, 1)$$,
  '... and another user''s dsa item is untouched'
);
select is(
  (select status from public.user_tracks where user_id = :'resume_user' and track_id = 'dsa'),
  'active',
  '... and the track is active again'
);

select tests.authenticate_as(:'resume_user');
select lives_ok(
  $$select public.apply_event(tests.event(gen_random_uuid()::text, 'track.paused', 'dsa'));
    select public.apply_event(
      tests.event(gen_random_uuid()::text, 'track.resumed', 'dsa', '{"pausedDays": 3650}'));
    select public.apply_event(tests.event(gen_random_uuid()::text, 'track.paused', 'dsa'));
    select public.apply_event(
      tests.event(gen_random_uuid()::text, 'track.resumed', 'dsa', '{"pausedDays": 1.0}'))$$,
  'pausedDays 3650 (the bound) and 1.0 (a JSON integer written with a fraction) are accepted'
);
select tests.clear_authentication();
select is(
  (select due_on from public.item_state where user_id = :'resume_user' and item_id = 'dsa:p1'),
  date '2026-10-10' + 3651,
  '... and shift by 3650 and 1'
);
-- A same-day pause and resume (pausedDays 0) shifts nothing, so it bumps no version: an
-- in-flight review in another tab does not conflict (final review M-2).
select version as resume_p1_version from public.item_state
where user_id = :'resume_user' and item_id = 'dsa:p1' \gset
select tests.authenticate_as(:'resume_user');
select lives_ok(
  $$select public.apply_event(tests.event(gen_random_uuid()::text, 'track.paused', 'dsa'));
    select public.apply_event(
      tests.event(gen_random_uuid()::text, 'track.resumed', 'dsa', '{"pausedDays": 0}'))$$,
  'a same-day pause and resume (pausedDays 0) applies'
);
select tests.clear_authentication();
select results_eq(
  format(
    $$select item_id, due_on, version from public.item_state
      where user_id = %L and track_id = 'dsa' order by 1$$,
    :'resume_user'
  ),
  format(
    $$values ('dsa:lesson-arrays'::text, null::date, 1), ('dsa:p1', %L::date, %s),
             ('dsa:p2', null, 1)$$,
    date '2026-10-10' + 3651, :'resume_p1_version'
  ),
  '... and leaves every due date and version unchanged'
);

-- ---------------------------------------------------------------------------------------------
-- 10. Decision 27: re-enrolling resets new_per_day, throttle, weekly_template and include_bonus;
--     track.updated on a removed track raises track_not_enrolled.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_as(:'enroll_user');
select lives_ok(
  $$select public.apply_event(tests.event(
      gen_random_uuid()::text, 'track.enrolled', 'dsa',
      '{"roadmapVariant": "10w", "budgetMinutes": 60, "startDate": "2026-09-25"}'));
    select public.apply_event(tests.event(
      gen_random_uuid()::text, 'track.updated', 'dsa',
      '{"newPerDay": 2, "throttle": [{"dueAbove": 30, "newPerDay": 1}],
        "weeklyTemplate": {"sat": 90}, "includeBonus": true}'));
    select public.apply_event(tests.event(gen_random_uuid()::text, 'track.removed', 'dsa'))$$,
  'enroll, set every optional setting, remove'
);
select throws_ok(
  $$select public.apply_event(tests.event(
      '71000000-0000-4000-8000-000000000101', 'track.updated', 'dsa', '{"budgetMinutes": 30}'))$$,
  'P0001', 'track_not_enrolled', 'track.updated on a removed track raises track_not_enrolled'
);
select tests.clear_authentication();
select results_eq(
  format(
    $$select status, budget_minutes, new_per_day, include_bonus,
             (select count(*)::int from public.events
               where id = '71000000-0000-4000-8000-000000000101')
      from public.user_tracks where user_id = %L and track_id = 'dsa'$$,
    :'enroll_user'
  ),
  $$values ('removed'::text, 60, 2, true, 0)$$,
  '... changes nothing and leaves no event'
);
select tests.authenticate_as(:'enroll_user');
select is(
  public.apply_event(tests.event(
    gen_random_uuid()::text, 'track.enrolled', 'dsa',
    '{"roadmapVariant": "8w", "budgetMinutes": 45, "startDate": "2026-10-01"}'
  )),
  '{"outcome": "applied", "versions": {}}'::jsonb,
  're-enrolling the removed track returns applied'
);
select tests.clear_authentication();
select results_eq(
  format(
    $$select roadmap_variant, budget_minutes, start_date, status, new_per_day, throttle,
             weekly_template, include_bonus
      from public.user_tracks where user_id = %L$$,
    :'enroll_user'
  ),
  $$values ('8w'::text, 45, '2026-10-01'::date, 'active'::text, null::int, null::jsonb,
            null::jsonb, false)$$,
  '... with the new settings, and new_per_day, throttle, weekly_template, include_bonus reset'
);

select * from finish();
rollback;
