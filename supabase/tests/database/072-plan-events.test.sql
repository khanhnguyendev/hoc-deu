begin;
set client_min_messages = warning;
create extension if not exists pgtap with schema extensions;
\ir _helpers.psql

select plan(76);

-- Task 4.9c: apply_system_event stores the day's plan (plan.generated) and the auto check-in
-- (platform design §2.3, §4.3, §4.4, §5.4, §5.5; implementation plan Part B-M4 decisions 10, 12,
-- 30, 33). The server calls it with the secret key, so every call here runs as service_role.

-- A system event as lib/events/apply.ts sends it: snake_case keys, rules_version 2 (override it
-- with `|| '{"rules_version": 1}'`).
create function tests.sys_event(
  p_id text, p_type text, p_payload jsonb default '{}'::jsonb, p_plan text default null,
  p_block text default null, p_track text default null, p_local_day text default null
) returns jsonb language sql immutable as $$
  select jsonb_strip_nulls(jsonb_build_object(
      'id', p_id, 'type', p_type, 'plan_id', p_plan, 'block_id', p_block, 'track_id', p_track,
      'local_day', p_local_day))
    || jsonb_build_object('payload', p_payload, 'rules_version', 2)
$$;

-- A learner event (apply_event, 4.9b), as 071 builds it.
create function tests.learner_event(
  p_id text, p_type text, p_track text default null, p_payload jsonb default '{}'::jsonb,
  p_item text default null, p_plan text default null, p_block text default null
) returns jsonb language sql immutable as $$
  select jsonb_strip_nulls(jsonb_build_object(
      'id', p_id, 'type', p_type, 'track_id', p_track, 'item_id', p_item, 'plan_id', p_plan,
      'block_id', p_block))
    || jsonb_build_object('payload', p_payload, 'rules_version', 2)
$$;

-- plan.generated's payload.
create function tests.generated(p_mode text, p_version integer) returns jsonb
language sql immutable as $$
  select jsonb_build_object('mode', p_mode, 'planVersion', p_version)
$$;

-- The blocks of a plan for p_date (the camelCase JSON of lib/domain/plan/types.ts): a review and
-- a new block; p_minutes tells one build from another.
create function tests.blocks(p_date text, p_minutes integer) returns jsonb
language sql immutable as $$
  select jsonb_build_array(
    jsonb_build_object(
      'id', p_date || ':dsa:review:1', 'trackId', 'dsa', 'kind', 'review', 'estMinutes', 15,
      'items', '[]'::jsonb),
    jsonb_build_object(
      'id', p_date || ':dsa:new:1', 'trackId', 'dsa', 'kind', 'new', 'estMinutes', p_minutes,
      'items', jsonb_build_array(
        jsonb_build_object('itemId', 'dsa:lc-0001', 'mode', 'new', 'minutes', p_minutes))))
$$;

-- The roadmap_weeks snapshot (trackSnapshotSchema).
create function tests.weeks(p_week integer) returns jsonb language sql immutable as $$
  select jsonb_build_object('dsa', jsonb_build_object(
    'variant', '10w', 'week', p_week, 'dueCount', 0, 'newPerDay', null, 'throttled', false,
    'reviewDebt', false))
$$;

-- plan.generated's p_changes (one day_plans row) and p_expected.
create function tests.plan_changes(p_date text, p_blocks jsonb, p_weeks jsonb) returns jsonb
language sql immutable as $$
  select jsonb_build_array(jsonb_build_object(
    'table', 'day_plans',
    'row', jsonb_build_object('plan_date', p_date, 'blocks', p_blocks, 'roadmap_weeks', p_weeks)))
$$;
create function tests.plan_expected(p_date text, p_version integer) returns jsonb
language sql immutable as $$
  select jsonb_build_object('day_plans:' || p_date, p_version)
$$;

-- One p_changes element, a plan_block_state row and a daily_activity row (as 071).
create function tests.change(p_table text, p_row jsonb) returns jsonb
language sql immutable as $$
  select jsonb_build_object('table', p_table, 'row', p_row)
$$;
create function tests.block_row(p_plan text, p_block text, p_patch jsonb default '{}'::jsonb)
returns jsonb language sql immutable as $$
  select jsonb_build_object(
      'plan_id', p_plan, 'block_id', p_block, 'track_id', 'dsa', 'status', 'done', 'minutes', 20,
      'note', null, 'auto', true)
    || p_patch
$$;
create function tests.day_row(p_day text, p_items_done integer) returns jsonb
language sql immutable as $$
  select jsonb_build_object(
    'local_day', p_day, 'minutes_by_track', '{"dsa": 45}'::jsonb, 'items_done', p_items_done,
    'completed', true)
$$;

-- Whether this transaction holds the bigint advisory lock `p_key` (as 071).
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

-- The message an apply_system_event call raises, or 'no error'.
create function tests.system_error(p_user uuid, p_event jsonb) returns text
language plpgsql as $$
begin
  perform public.apply_system_event(p_user, p_event);
  return 'no error';
exception when others then
  return sqlerrm;
end $$;

grant execute on function
  tests.sys_event(text, text, jsonb, text, text, text, text),
  tests.learner_event(text, text, text, jsonb, text, text, text),
  tests.generated(text, integer),
  tests.blocks(text, integer),
  tests.weeks(integer),
  tests.plan_changes(text, jsonb, jsonb),
  tests.plan_expected(text, integer),
  tests.change(text, jsonb),
  tests.block_row(text, text, jsonb),
  tests.day_row(text, integer),
  tests.holds_advisory_lock(bigint),
  tests.system_error(uuid, jsonb)
to authenticated, service_role;

select tests.create_user('plan-events-learner@hocdeu.test') as learner \gset
select tests.create_user('plan-events-other@hocdeu.test') as other \gset
select tests.create_user('plan-events-suspended@hocdeu.test', 'suspended') as suspended \gset
select tests.create_user('plan-events-crossing@hocdeu.test') as crossing \gset
-- Every user here has the default schedule, so they share one local day.
select to_char(public.user_local_day(:'learner', now()), 'YYYY-MM-DD') as today \gset
select to_char(public.user_local_day(:'learner', now()) - 1, 'YYYY-MM-DD') as yesterday \gset

-- The other user's and the suspended user's plans, inserted as postgres (no lock taken).
insert into public.day_plans (id, user_id, plan_date, blocks) values
  ('72000000-0000-4000-8000-0000000000b1', :'other', :'today', tests.blocks(:'today', 30)),
  ('72000000-0000-4000-8000-0000000000b2', :'suspended', :'today', tests.blocks(:'today', 30));

-- ---------------------------------------------------------------------------------------------
-- 0. Shape: still one SECURITY DEFINER function with an empty search_path.
-- ---------------------------------------------------------------------------------------------
select results_eq(
  $$select p.prosecdef, p.proconfig = array['search_path=""'] collate "C"
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'apply_system_event'$$,
  $$values (true, true)$$,
  'apply_system_event is one SECURITY DEFINER function with an empty search_path'
);
select ok(
  not tests.holds_advisory_lock(public.plan_lock_key(:'learner', :'today')),
  'no transaction holds the learner''s plan lock for today yet'
);

-- ---------------------------------------------------------------------------------------------
-- 1. baseline: the plan (version 1, source baseline, never seen, the event's rules_version) and
--    one plan.generated event carrying its plan_id. The row's other keys are ignored.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_as_service_role();
select public.apply_system_event(
  :'learner',
  tests.sys_event(
    '72000000-0000-4000-8000-000000000001', 'plan.generated', tests.generated('baseline', 1)
  ) || '{"rules_version": 1}',
  jsonb_build_array(jsonb_build_object('table', 'day_plans', 'row', jsonb_build_object(
    'plan_date', :'today', 'blocks', tests.blocks(:'today', 30), 'roadmap_weeks', tests.weeks(1),
    'user_id', :'other', 'id', '72000000-0000-4000-8000-0000000000b1', 'version', 7,
    'source', 'ai', 'seen_at', '2026-01-01T00:00:00Z'))),
  tests.plan_expected(:'today', 0)
) as baseline \gset
select tests.clear_authentication();
select :'baseline'::jsonb ->> 'plan_id' as plan_today \gset

select is(
  :'baseline'::jsonb - 'plan_id',
  jsonb_build_object('outcome', 'applied', 'versions', tests.plan_expected(:'today', 1)),
  'baseline returns applied with versions {day_plans:<date>: 1}'
);
select results_eq(
  format(
    $$select id::text, plan_date, version, source, seen_at, rules_version, blocks, roadmap_weeks
      from public.day_plans where user_id = %L$$,
    :'learner'
  ),
  format(
    $$values (%L::text, %L::date, 1, 'baseline'::text, null::timestamptz, 1,
              tests.blocks(%2$L, 30), tests.weeks(1))$$,
    :'plan_today', :'today'
  ),
  '... stores one plan with the returned plan_id: version 1, source baseline, seen_at null, '
  'the event''s rules_version, the row''s blocks and roadmap_weeks'
);
select results_eq(
  format(
    $$select id, type, source, actor_id, plan_id, block_id, payload, rules_version
      from public.events where user_id = %L$$,
    :'learner'
  ),
  format(
    $$values ('72000000-0000-4000-8000-000000000001'::uuid, 'plan.generated'::text,
              'system'::text, %L::uuid, %L::uuid, null::text,
              '{"mode": "baseline", "planVersion": 1}'::jsonb, 1)$$,
    :'learner', :'plan_today'
  ),
  '... and one plan.generated event carrying that plan_id: source system, actor_id the user'
);
select ok(
  tests.holds_advisory_lock(public.plan_lock_key(:'learner', :'today')),
  '... under the (user, plan_date) advisory lock (decision 33)'
);
select results_eq(
  format(
    $$select (select count(*)::int from public.day_plans where user_id = %L),
             (select count(*)::int from public.event_quota where user_id = %L)$$,
    :'other', :'learner'
  ),
  $$values (1, 0)$$,
  '... the other user the row names keeps just their own plan; the event is not counted as quota'
);

-- ---------------------------------------------------------------------------------------------
-- 2. A plan exists for the date: plan_exists with its id and no event; the same event id again is
--    a duplicate. A resume for another date stores a plan of its own.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_as_service_role();
select is(
  public.apply_system_event(
    :'learner',
    tests.sys_event(
      '72000000-0000-4000-8000-000000000002', 'plan.generated', tests.generated('baseline', 1)),
    tests.plan_changes(:'today', tests.blocks(:'today', 60), tests.weeks(2)),
    tests.plan_expected(:'today', 0)
  ),
  jsonb_build_object('outcome', 'plan_exists', 'plan_id', :'plan_today', 'versions', '{}'::jsonb),
  'a second baseline for the date (new event id) returns plan_exists with the first plan''s id'
);
select is(
  public.apply_system_event(
    :'learner',
    tests.sys_event(
      '72000000-0000-4000-8000-000000000003', 'plan.generated', tests.generated('resume', 1)),
    tests.plan_changes(:'today', tests.blocks(:'today', 60), tests.weeks(2)),
    tests.plan_expected(:'today', 0)
  ),
  jsonb_build_object('outcome', 'plan_exists', 'plan_id', :'plan_today', 'versions', '{}'::jsonb),
  '... and so does a resume'
);
select is(
  public.apply_system_event(
    :'learner',
    tests.sys_event(
      '72000000-0000-4000-8000-000000000001', 'plan.generated', tests.generated('baseline', 1)),
    tests.plan_changes(:'today', tests.blocks(:'today', 60), tests.weeks(2)),
    tests.plan_expected(:'today', 0)
  ),
  '{"outcome": "duplicate", "versions": {}}'::jsonb,
  'the first event id again returns duplicate'
);
select tests.clear_authentication();
select results_eq(
  format(
    $$select d.version, d.blocks,
             (select count(*)::int from public.events e where e.user_id = %L)
      from public.day_plans d where d.id = %L$$,
    :'learner', :'plan_today'
  ),
  format($$values (1, tests.blocks(%L, 30), 1)$$, :'today'),
  '... none of them wrote an event or changed the plan'
);

select tests.authenticate_as_service_role();
select public.apply_system_event(
  :'learner',
  tests.sys_event(
    '72000000-0000-4000-8000-000000000004', 'plan.generated', tests.generated('resume', 1)),
  tests.plan_changes(:'yesterday', tests.blocks(:'yesterday', 20), tests.weeks(1)),
  tests.plan_expected(:'yesterday', 0)
) as resumed \gset
select tests.clear_authentication();
select :'resumed'::jsonb ->> 'plan_id' as plan_yesterday \gset
select is(
  :'resumed'::jsonb - 'plan_id',
  jsonb_build_object('outcome', 'applied', 'versions', tests.plan_expected(:'yesterday', 1)),
  'a resume for another date returns applied, version 1'
);
select results_eq(
  format(
    $$select id::text, plan_date, version, source from public.day_plans
      where user_id = %L and id <> %L$$,
    :'learner', :'plan_today'
  ),
  format(
    $$values (%L::text, %L::date, 1, 'baseline'::text)$$, :'plan_yesterday', :'yesterday'
  ),
  '... with a plan of its own (a resume is stored as source baseline)'
);

-- ---------------------------------------------------------------------------------------------
-- 2a. Decision 10 (final review M-3): storePlan sends local_day = the plan date. A plan built for
--     D and stored after D's day start raises day_changed and stores nothing; one whose local_day
--     is the database's is stored.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_as_service_role();
select throws_ok(
  format(
    $$select public.apply_system_event(%L,
        tests.sys_event(
          '72000000-0000-4000-8000-000000000021', 'plan.generated',
          tests.generated('baseline', 1), p_local_day => %L),
        tests.plan_changes(%2$L, tests.blocks(%2$L, 30), tests.weeks(1)),
        tests.plan_expected(%2$L, 0))$$,
    :'crossing', :'yesterday'
  ),
  'P0001', 'day_changed',
  'plan.generated for yesterday with local_day yesterday (a request that crossed the day start) '
  'raises day_changed'
);
select tests.clear_authentication();
select results_eq(
  format(
    $$select (select count(*)::int from public.day_plans where user_id = %L),
             (select count(*)::int from public.events where user_id = %L)$$,
    :'crossing', :'crossing'
  ),
  $$values (0, 0)$$,
  '... and stores no plan and no event'
);
select tests.authenticate_as_service_role();
select is(
  public.apply_system_event(
    :'crossing',
    tests.sys_event(
      '72000000-0000-4000-8000-000000000022', 'plan.generated', tests.generated('baseline', 1),
      p_local_day => :'today'),
    tests.plan_changes(:'today', tests.blocks(:'today', 30), tests.weeks(1)),
    tests.plan_expected(:'today', 0)
  ) - 'plan_id',
  jsonb_build_object('outcome', 'applied', 'versions', tests.plan_expected(:'today', 1)),
  'plan.generated for today with local_day today is stored'
);
select tests.clear_authentication();

-- ---------------------------------------------------------------------------------------------
-- 3. rebuild of an untouched plan (decision 12): its generation event and a bot's plan.ai_*
--    event name it, which does not make it touched. New blocks and snapshot, version n + 1,
--    source baseline (an AI plan rebuilt by a settings change, §5.4), the event's rules_version;
--    seen_at is kept.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_as(:'learner');
select ok(public.mark_plan_seen(:'plan_today'), 'the learner marks today''s plan seen');
select tests.clear_authentication();
select is(
  (select seen_at from public.day_plans where id = :'plan_today'), now(), '... which sets seen_at'
);
-- A fixed seen_at (now() is constant in a transaction) and source ai, so that "kept" and
-- "becomes baseline" are observable; a bot's proposal names the plan (written as postgres here).
update public.day_plans set seen_at = '2026-01-02T00:00:00Z', source = 'ai'
where id = :'plan_today';
insert into public.events (id, user_id, source, type, plan_id, payload) values (
  '72000000-0000-4000-8000-0000000000a1', :'learner', 'bot', 'plan.ai_proposed', :'plan_today',
  '{"runId": "run-1", "outcome": "proposed"}'
);

select tests.authenticate_as_service_role();
select is(
  public.apply_system_event(
    :'learner',
    tests.sys_event(
      '72000000-0000-4000-8000-000000000005', 'plan.generated', tests.generated('rebuild', 2)),
    tests.plan_changes(:'today', tests.blocks(:'today', 45), tests.weeks(2)),
    tests.plan_expected(:'today', 1)
  ),
  jsonb_build_object(
    'outcome', 'applied', 'plan_id', :'plan_today', 'versions', tests.plan_expected(:'today', 2)),
  'a rebuild of the untouched plan (expected 1, planVersion 2) returns applied, version 2'
);
select tests.clear_authentication();
select results_eq(
  format(
    $$select version, source, seen_at, rules_version, blocks, roadmap_weeks
      from public.day_plans where id = %L$$,
    :'plan_today'
  ),
  format(
    $$values (2, 'baseline'::text, '2026-01-02T00:00:00Z'::timestamptz, 2, tests.blocks(%L, 45),
              tests.weeks(2))$$,
    :'today'
  ),
  '... the plan has the new blocks and snapshot, version 2, source baseline and the event''s '
  'rules_version, and keeps seen_at'
);
select results_eq(
  format(
    $$select id, plan_id, payload from public.events
      where user_id = %L and type = 'plan.generated' order by id$$,
    :'learner'
  ),
  format(
    $$values ('72000000-0000-4000-8000-000000000001'::uuid, %1$L::uuid,
              '{"mode": "baseline", "planVersion": 1}'::jsonb),
             ('72000000-0000-4000-8000-000000000004', %2$L, '{"mode": "resume", "planVersion": 1}'),
             ('72000000-0000-4000-8000-000000000005', %1$L,
              '{"mode": "rebuild", "planVersion": 2}')$$,
    :'plan_today', :'plan_yesterday'
  ),
  '... with a plan.generated event (mode rebuild, planVersion 2) carrying the same plan_id'
);

-- ---------------------------------------------------------------------------------------------
-- 4. Touched plans (§2.3, decision 12) are not rebuilt: plan_in_use with the plan's id, no event,
--    the plan unchanged — after a learner check-in, and after a learner item.result naming it.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_as(:'learner');
select is(
  public.apply_event(
    tests.learner_event(
      '72000000-0000-4000-8000-000000000006', 'block.checked_in', 'dsa',
      '{"status": "done", "minutes": 15}', p_plan => :'plan_today',
      p_block => :'today' || ':dsa:review:1'
    ),
    jsonb_build_array(tests.change('plan_block_state', tests.block_row(
      :'plan_today', :'today' || ':dsa:review:1', '{"minutes": 15, "auto": false}'))),
    jsonb_build_object(
      'plan_block_state:' || :'plan_today' || '/' || :'today' || ':dsa:review:1', 0)
  ) ->> 'outcome',
  'applied',
  'the learner checks in today''s review block (apply_event)'
);
select tests.authenticate_as_service_role();
select is(
  public.apply_system_event(
    :'learner',
    tests.sys_event(
      '72000000-0000-4000-8000-000000000007', 'plan.generated', tests.generated('rebuild', 3)),
    tests.plan_changes(:'today', tests.blocks(:'today', 60), tests.weeks(3)),
    tests.plan_expected(:'today', 2)
  ),
  jsonb_build_object('outcome', 'plan_in_use', 'plan_id', :'plan_today', 'versions', '{}'::jsonb),
  'a rebuild after a learner check-in on the plan returns plan_in_use'
);
select tests.clear_authentication();
select results_eq(
  format(
    $$select d.version, d.blocks, d.roadmap_weeks,
             (select count(*)::int from public.events e
               where e.id = '72000000-0000-4000-8000-000000000007')
      from public.day_plans d where d.id = %L$$,
    :'plan_today'
  ),
  format($$values (2, tests.blocks(%L, 45), tests.weeks(2), 0)$$, :'today'),
  '... leaves the plan unchanged and writes no event'
);

select tests.authenticate_as(:'learner');
select is(
  public.apply_event(tests.learner_event(
    '72000000-0000-4000-8000-000000000008', 'item.result', 'dsa', '{"result": "solved"}',
    p_item => 'dsa:lc-0001', p_plan => :'plan_yesterday'
  )) ->> 'outcome',
  'applied',
  'the learner records a result naming yesterday''s plan (apply_event, no check-in)'
);
select tests.authenticate_as_service_role();
select is(
  public.apply_system_event(
    :'learner',
    tests.sys_event(
      '72000000-0000-4000-8000-000000000009', 'plan.generated', tests.generated('rebuild', 2)),
    tests.plan_changes(:'yesterday', tests.blocks(:'yesterday', 60), tests.weeks(3)),
    tests.plan_expected(:'yesterday', 1)
  ),
  jsonb_build_object(
    'outcome', 'plan_in_use', 'plan_id', :'plan_yesterday', 'versions', '{}'::jsonb),
  'a rebuild after a learner item.result carrying the plan_id returns plan_in_use'
);
select tests.clear_authentication();
select results_eq(
  format(
    $$select d.version, d.blocks,
             (select count(*)::int from public.events e
               where e.id = '72000000-0000-4000-8000-000000000009')
      from public.day_plans d where d.id = %L$$,
    :'plan_yesterday'
  ),
  format($$values (1, tests.blocks(%L, 20), 0)$$, :'yesterday'),
  '... leaves that plan unchanged and writes no event'
);

-- A check-in row that no event names (a learner may insert one directly, within the 4.9a bounds)
-- makes a plan touched too.
select tests.authenticate_as_service_role();
select public.apply_system_event(
  :'learner',
  tests.sys_event(
    '72000000-0000-4000-8000-000000000014', 'plan.generated', tests.generated('baseline', 1)),
  tests.plan_changes('2026-01-10', tests.blocks('2026-01-10', 20), tests.weeks(1)),
  tests.plan_expected('2026-01-10', 0)
) ->> 'plan_id' as plan_older \gset
select tests.authenticate_as(:'learner');
select lives_ok(
  format(
    $$insert into public.plan_block_state
        (plan_id, block_id, user_id, track_id, status, minutes, checked_in_on)
      values (%L, '2026-01-10:dsa:review:1', %L, 'dsa', 'done', 15, '2026-01-10')$$,
    :'plan_older', :'learner'
  ),
  'the learner inserts a check-in row for a third plan directly, with no event'
);
select tests.authenticate_as_service_role();
select is(
  public.apply_system_event(
    :'learner',
    tests.sys_event(
      '72000000-0000-4000-8000-000000000015', 'plan.generated', tests.generated('rebuild', 2)),
    tests.plan_changes('2026-01-10', tests.blocks('2026-01-10', 60), tests.weeks(2)),
    tests.plan_expected('2026-01-10', 1)
  ),
  jsonb_build_object('outcome', 'plan_in_use', 'plan_id', :'plan_older', 'versions', '{}'::jsonb),
  'a rebuild of a plan with a check-in row but no event naming it returns plan_in_use'
);
select tests.clear_authentication();
select results_eq(
  format(
    $$select d.version, d.blocks,
             (select count(*)::int from public.events e
               where e.id = '72000000-0000-4000-8000-000000000015')
      from public.day_plans d where d.id = %L$$,
    :'plan_older'
  ),
  $$values (1, tests.blocks('2026-01-10', 20), 0)$$,
  '... leaves that plan unchanged and writes no event'
);

-- ---------------------------------------------------------------------------------------------
-- 5. version_conflict (a stale or missing version) and invalid_event (the mode, versions and
--    change do not agree); none of them stores anything.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_as_service_role();
select throws_ok(
  format(
    $$select public.apply_system_event(%L,
        tests.sys_event(gen_random_uuid()::text, 'plan.generated', tests.generated('rebuild', 2)),
        tests.plan_changes(%L, tests.blocks(%2$L, 60), tests.weeks(3)),
        tests.plan_expected(%2$L, 1))$$,
    :'learner', :'today'
  ),
  'P0001', 'version_conflict',
  'a rebuild with a stale expected version (1; the plan is at 2) raises version_conflict'
);
select throws_ok(
  format(
    $$select public.apply_system_event(%L,
        tests.sys_event(gen_random_uuid()::text, 'plan.generated', tests.generated('rebuild', 2)),
        tests.plan_changes('2026-01-05', tests.blocks('2026-01-05', 60), tests.weeks(3)),
        tests.plan_expected('2026-01-05', 1))$$,
    :'learner'
  ),
  'P0001', 'version_conflict', '... and so does a rebuild for a date without a plan'
);
select throws_ok(
  format(
    $$select public.apply_system_event(%L,
        tests.sys_event(gen_random_uuid()::text, 'plan.generated', tests.generated('rebuild', 4)),
        tests.plan_changes(%L, tests.blocks(%2$L, 60), tests.weeks(3)),
        tests.plan_expected(%2$L, 2))$$,
    :'learner', :'today'
  ),
  'P0001', 'invalid_event', 'a rebuild whose planVersion is not expected + 1 raises invalid_event'
);
select throws_ok(
  format(
    $$select public.apply_system_event(%L,
        tests.sys_event(gen_random_uuid()::text, 'plan.generated', tests.generated('rebuild', 1)),
        tests.plan_changes('2026-01-06', tests.blocks('2026-01-06', 60), tests.weeks(3)),
        tests.plan_expected('2026-01-06', 0))$$,
    :'learner'
  ),
  'P0001', 'invalid_event', '... and so does a rebuild expecting no plan (0)'
);
select throws_ok(
  format(
    $$select public.apply_system_event(%L,
        tests.sys_event(gen_random_uuid()::text, 'plan.generated', tests.generated('baseline', 1)),
        tests.plan_changes('2026-01-06', tests.blocks('2026-01-06', 60), tests.weeks(3)),
        tests.plan_expected('2026-01-06', 1))$$,
    :'learner'
  ),
  'P0001', 'invalid_event', 'a baseline expecting a plan (1) raises invalid_event'
);
select throws_ok(
  format(
    $$select public.apply_system_event(%L,
        tests.sys_event(gen_random_uuid()::text, 'plan.generated', tests.generated('resume', 2)),
        tests.plan_changes('2026-01-06', tests.blocks('2026-01-06', 60), tests.weeks(3)),
        tests.plan_expected('2026-01-06', 0))$$,
    :'learner'
  ),
  'P0001', 'invalid_event', '... and so does a resume with planVersion 2'
);
select throws_ok(
  format(
    $$select public.apply_system_event(%L,
        tests.sys_event(gen_random_uuid()::text, 'plan.generated',
                        '{"mode": "replace", "planVersion": 1}'),
        tests.plan_changes('2026-01-06', tests.blocks('2026-01-06', 60), tests.weeks(3)),
        tests.plan_expected('2026-01-06', 0))$$,
    :'learner'
  ),
  'P0001', 'invalid_event', 'an unknown mode raises invalid_event'
);
select throws_ok(
  format(
    $$select public.apply_system_event(%L,
        tests.sys_event(gen_random_uuid()::text, 'plan.generated',
                        '{"mode": "baseline", "planVersion": "1"}'),
        tests.plan_changes('2026-01-06', tests.blocks('2026-01-06', 60), tests.weeks(3)),
        tests.plan_expected('2026-01-06', 0))$$,
    :'learner'
  ),
  'P0001', 'invalid_event', 'a planVersion that is not a JSON number raises invalid_event'
);
select throws_ok(
  format(
    $$select public.apply_system_event(%L,
        tests.sys_event(gen_random_uuid()::text, 'plan.generated', tests.generated('baseline', 1)))$$,
    :'learner'
  ),
  'P0001', 'invalid_event', 'a plan.generated without its day_plans change raises invalid_event'
);
select throws_ok(
  format(
    $$select public.apply_system_event(%L,
        tests.sys_event(gen_random_uuid()::text, 'plan.generated', tests.generated('baseline', 1)),
        tests.plan_changes('2026-01-06', tests.blocks('2026-01-06', 60), tests.weeks(3))
          || tests.plan_changes('2026-01-07', tests.blocks('2026-01-07', 60), tests.weeks(3)),
        tests.plan_expected('2026-01-06', 0) || tests.plan_expected('2026-01-07', 0))$$,
    :'learner'
  ),
  'P0001', 'invalid_event', '... or with two changes'
);
select throws_ok(
  format(
    $$select public.apply_system_event(%L,
        tests.sys_event(gen_random_uuid()::text, 'plan.generated', tests.generated('baseline', 1)),
        jsonb_build_array(tests.change('item_state', '{"plan_date": "2026-01-06"}')),
        tests.plan_expected('2026-01-06', 0))$$,
    :'learner'
  ),
  'P0001', 'invalid_event', '... or with a change of another table'
);
select throws_ok(
  format(
    $$select public.apply_system_event(%L,
        tests.sys_event(gen_random_uuid()::text, 'plan.generated', tests.generated('baseline', 1)),
        tests.plan_changes('2026-01-06', tests.blocks('2026-01-06', 60), tests.weeks(3)),
        tests.plan_expected('2026-01-07', 0))$$,
    :'learner'
  ),
  'P0001', 'invalid_event', 'a p_expected key for another date raises invalid_event'
);
select throws_ok(
  format(
    $$select public.apply_system_event(%L,
        tests.sys_event(gen_random_uuid()::text, 'plan.generated', tests.generated('baseline', 1)),
        tests.plan_changes('2026-01-06', tests.blocks('2026-01-06', 60), tests.weeks(3)),
        tests.plan_expected('2026-01-06', 0) || '{"item_state:x": 0}')$$,
    :'learner'
  ),
  'P0001', 'invalid_event', '... and so does an extra p_expected key'
);
select throws_ok(
  format(
    $$select public.apply_system_event(%L,
        tests.sys_event(gen_random_uuid()::text, 'plan.generated', tests.generated('baseline', 1)),
        tests.plan_changes('2026-02-30', tests.blocks('2026-02-30', 60), tests.weeks(3)),
        tests.plan_expected('2026-02-30', 0))$$,
    :'learner'
  ),
  'P0001', 'invalid_event', 'a plan_date that is not a date raises invalid_event'
);
select throws_ok(
  format(
    $$select public.apply_system_event(%L,
        tests.sys_event(gen_random_uuid()::text, 'plan.generated', tests.generated('baseline', 1)),
        tests.plan_changes('2026-01-06', '{"id": "b"}', tests.weeks(3)),
        tests.plan_expected('2026-01-06', 0))$$,
    :'learner'
  ),
  'P0001', 'invalid_event', 'blocks that are not a JSON array raise invalid_event'
);
select throws_ok(
  format(
    $$select public.apply_system_event(%L,
        tests.sys_event(gen_random_uuid()::text, 'plan.generated', tests.generated('rebuild', 3),
                        p_plan => %L),
        tests.plan_changes(%L, tests.blocks(%3$L, 60), tests.weeks(3)),
        tests.plan_expected(%3$L, 2))$$,
    :'learner', :'plan_today', :'today'
  ),
  'P0001', 'invalid_event', 'a plan.generated naming a plan_id raises invalid_event (the database sets it)'
);
select tests.clear_authentication();
select results_eq(
  format(
    $$select (select count(*)::int from public.day_plans where user_id = %1$L),
             (select max(version) from public.day_plans where user_id = %1$L),
             (select count(*)::int from public.events where user_id = %1$L)$$,
    :'learner'
  ),
  -- Four plan.generated, the bot's proposal and the learner's check-in and result.
  $$values (3, 2, 7)$$,
  '... none of them stored a plan, a version or an event'
);

-- ---------------------------------------------------------------------------------------------
-- 6. The auto check-in (§5.5): block.checked_in with auto true, the plan lock first, then the
--    derived rows through apply_derived_changes (4.9b), for the user whatever the rows say.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_as_service_role();
select is(
  public.apply_system_event(
    :'learner',
    tests.sys_event(
      '72000000-0000-4000-8000-000000000010', 'block.checked_in',
      '{"status": "done", "minutes": 45, "auto": true}', p_plan => :'plan_today',
      p_block => :'today' || ':dsa:new:1', p_track => 'dsa', p_local_day => :'today'
    ),
    jsonb_build_array(
      tests.change('plan_block_state', tests.block_row(
        :'plan_today', :'today' || ':dsa:new:1',
        jsonb_build_object('minutes', 45, 'user_id', :'other', 'checked_in_on', '2000-01-01'))),
      tests.change('daily_activity', tests.day_row(:'today', 1))),
    jsonb_build_object(
      'plan_block_state:' || :'plan_today' || '/' || :'today' || ':dsa:new:1', 0,
      'daily_activity:' || :'today', 0)
  ),
  jsonb_build_object('outcome', 'applied', 'versions', jsonb_build_object(
    'plan_block_state:' || :'plan_today' || '/' || :'today' || ':dsa:new:1', 1,
    'daily_activity:' || :'today', 1)),
  'an auto check-in with plan_block_state and daily_activity changes returns applied, version 1 each'
);
select tests.clear_authentication();
select results_eq(
  format(
    $$select user_id, status, minutes, auto, checked_in_on, version, rules_version
      from public.plan_block_state where plan_id = %L and block_id = %L$$,
    :'plan_today', :'today' || ':dsa:new:1'
  ),
  format($$values (%L::uuid, 'done'::text, 45, true, %L::date, 1, 2)$$, :'learner', :'today'),
  '... stores the check-in for the user: auto true, checked_in_on the event''s local day'
);
select results_eq(
  format(
    $$select user_id, local_day, minutes_by_track, items_done, completed, version
      from public.daily_activity where user_id in (%L, %L)$$,
    :'learner', :'other'
  ),
  format(
    $$values (%L::uuid, %L::date, '{"dsa": 45}'::jsonb, 1, true, 1)$$, :'learner', :'today'
  ),
  '... and the daily_activity row'
);
select results_eq(
  $$select type, source, actor_id, plan_id::text, block_id, track_id, payload
    from public.events where id = '72000000-0000-4000-8000-000000000010'$$,
  format(
    $$values ('block.checked_in'::text, 'system'::text, %L::uuid, %L::text, %L::text, 'dsa'::text,
              '{"status": "done", "minutes": 45, "auto": true}'::jsonb)$$,
    :'learner', :'plan_today', :'today' || ':dsa:new:1'
  ),
  '... with one block.checked_in event: source system, actor_id the user'
);
select is(
  (select count from public.event_quota where user_id = :'learner'),
  2,
  '... not counted against the learner quota (2: the learner''s check-in and result)'
);

select tests.authenticate_as_service_role();
select is(
  public.apply_system_event(
    :'learner',
    tests.sys_event(
      '72000000-0000-4000-8000-000000000010', 'block.checked_in',
      '{"status": "done", "minutes": 45, "auto": true}', p_plan => :'plan_today',
      p_block => :'today' || ':dsa:new:1', p_track => 'dsa', p_local_day => :'today'
    ),
    jsonb_build_array(tests.change('plan_block_state', tests.block_row(
      :'plan_today', :'today' || ':dsa:new:1', '{"minutes": 5}'))),
    jsonb_build_object('plan_block_state:' || :'plan_today' || '/' || :'today' || ':dsa:new:1', 1)
  ),
  '{"outcome": "duplicate", "versions": {}}'::jsonb,
  'the same auto check-in id again returns duplicate'
);
select throws_ok(
  format(
    $$select public.apply_system_event(%L,
        tests.sys_event(gen_random_uuid()::text, 'block.checked_in',
                        '{"status": "done", "minutes": 15, "auto": false}', p_plan => %L,
                        p_block => %L, p_track => 'dsa'))$$,
    :'learner', :'plan_today', :'today' || ':dsa:review:1'
  ),
  'P0001', 'invalid_event', 'a block.checked_in with auto false raises invalid_event'
);
select throws_ok(
  format(
    $$select public.apply_system_event(%L,
        tests.sys_event(gen_random_uuid()::text, 'block.checked_in',
                        '{"status": "done", "minutes": 15}', p_plan => %L, p_block => %L,
                        p_track => 'dsa'))$$,
    :'learner', :'plan_today', :'today' || ':dsa:review:1'
  ),
  'P0001', 'invalid_event', '... and so does one without auto'
);
select throws_ok(
  format(
    $$select public.apply_system_event(%L,
        tests.sys_event(
          '72000000-0000-4000-8000-000000000011', 'block.checked_in',
          '{"status": "done", "minutes": 15, "auto": true}', p_plan => %L, p_block => %L,
          p_track => 'dsa', p_local_day => %L),
        jsonb_build_array(
          tests.change('plan_block_state', tests.block_row(%2$L, %3$L, '{"minutes": 15}')),
          tests.change('daily_activity', tests.day_row(%5$L, 2))),
        jsonb_build_object('plan_block_state:' || %2$L || '/' || %3$L, 1,
                           'daily_activity:' || %5$L, 1))$$,
    :'learner', :'plan_today', :'today' || ':dsa:review:1', :'yesterday', :'today'
  ),
  'P0001', 'day_changed', 'an auto check-in whose local_day is not the database''s raises day_changed'
);
select tests.clear_authentication();
select results_eq(
  format(
    $$select (select count(*)::int from public.events
               where id = '72000000-0000-4000-8000-000000000011'),
             (select b.auto::text || '/' || b.version from public.plan_block_state b
               where b.plan_id = %L and b.block_id = %L),
             (select a.items_done || '/' || a.version from public.daily_activity a
               where a.user_id = %L)$$,
    :'plan_today', :'today' || ':dsa:review:1', :'learner'
  ),
  $$values (0, 'false/1'::text, '1/1'::text)$$,
  '... and stores nothing: no event, the check-in and the daily_activity row unchanged'
);

select tests.authenticate_as_service_role();
select throws_ok(
  format(
    $$select public.apply_system_event(%L,
        tests.sys_event(gen_random_uuid()::text, 'block.checked_in',
                        '{"status": "done", "minutes": 30, "auto": true}',
                        p_plan => '72000000-0000-4000-8000-0000000000b1', p_block => %L,
                        p_track => 'dsa'),
        jsonb_build_array(tests.change('plan_block_state', tests.block_row(
          '72000000-0000-4000-8000-0000000000b1', %2$L))),
        jsonb_build_object(
          'plan_block_state:72000000-0000-4000-8000-0000000000b1/' || %2$L, 0))$$,
    :'learner', :'today' || ':dsa:new:1'
  ),
  'P0001', 'invalid_event', 'an auto check-in naming another user''s plan raises invalid_event'
);
select throws_ok(
  format(
    $$select public.apply_system_event(%L,
        tests.sys_event(gen_random_uuid()::text, 'block.checked_in',
                        '{"status": "done", "minutes": 30, "auto": true}',
                        p_plan => '72000000-0000-4000-8000-0000000000ff', p_block => 'b',
                        p_track => 'dsa'))$$,
    :'learner'
  ),
  'P0001', 'invalid_event', '... and so does one naming a plan that does not exist'
);
select throws_ok(
  format(
    $$select public.apply_system_event(%L,
        tests.sys_event(gen_random_uuid()::text, 'block.checked_in',
                        '{"status": "done", "minutes": 30, "auto": true}', p_plan => %L,
                        p_block => 'no-such-block', p_track => 'dsa'),
        jsonb_build_array(tests.change('plan_block_state', tests.block_row(%2$L, 'no-such-block'))),
        jsonb_build_object('plan_block_state:' || %2$L || '/no-such-block', 0))$$,
    :'learner', :'plan_today'
  ),
  'P0001', 'invalid_event', '... or a block the plan does not list'
);
select throws_ok(
  format(
    $$select public.apply_system_event(%L,
        tests.sys_event(gen_random_uuid()::text, 'block.checked_in',
                        '{"status": "done", "minutes": 30, "auto": true}', p_plan => %L,
                        p_track => 'dsa'))$$,
    :'learner', :'plan_today'
  ),
  'P0001', 'invalid_event', '... or no block_id'
);
select tests.clear_authentication();
select results_eq(
  format(
    $$select (select count(*)::int from public.events where user_id = %1$L),
             (select count(*)::int from public.plan_block_state where user_id = %1$L),
             (select count(*)::int from public.plan_block_state
               where plan_id = '72000000-0000-4000-8000-0000000000b1')$$,
    :'learner'
  ),
  $$values (8, 3, 0)$$,
  '... none of them stored an event or a check-in'
);

-- The lock (decision 33) comes from the plan the event names: the other user's, untouched so far.
select ok(
  not tests.holds_advisory_lock(public.plan_lock_key(:'other', :'today')),
  'no transaction holds the other user''s plan lock yet'
);
select tests.authenticate_as_service_role();
select is(
  public.apply_system_event(
    :'other',
    tests.sys_event(
      '72000000-0000-4000-8000-000000000012', 'block.checked_in',
      '{"status": "done", "minutes": 30, "auto": true}',
      p_plan => '72000000-0000-4000-8000-0000000000b1', p_block => :'today' || ':dsa:new:1',
      p_track => 'dsa'
    ) || '{"source": "bot"}',
    jsonb_build_array(tests.change('plan_block_state', tests.block_row(
      '72000000-0000-4000-8000-0000000000b1', :'today' || ':dsa:new:1', '{"minutes": 30}'))),
    jsonb_build_object(
      'plan_block_state:72000000-0000-4000-8000-0000000000b1/' || :'today' || ':dsa:new:1', 0)
  ) ->> 'outcome',
  'applied',
  'the other user''s auto check-in on their plan returns applied'
);
select tests.clear_authentication();
select ok(
  tests.holds_advisory_lock(public.plan_lock_key(:'other', :'today')),
  '... under their (user, plan_date) advisory lock'
);
select results_eq(
  $$select e.source, b.user_id, b.auto from public.events e
    join public.plan_block_state b on b.plan_id = e.plan_id and b.block_id = e.block_id
    where e.id = '72000000-0000-4000-8000-000000000012'$$,
  format($$values ('bot'::text, %L::uuid, true)$$, :'other'),
  '... a given source is kept, and the check-in is theirs'
);

-- ---------------------------------------------------------------------------------------------
-- 7. The bounds: blocks over 128 KB fail the check constraint; inactive users, authenticated
--    callers and the types other tasks own are refused.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_as_service_role();
select throws_ok(
  format(
    $$select public.apply_system_event(%L,
        tests.sys_event('72000000-0000-4000-8000-000000000013', 'plan.generated',
                        tests.generated('baseline', 1)),
        tests.plan_changes('2026-01-08', jsonb_build_array(repeat('x', 131072)), tests.weeks(1)),
        tests.plan_expected('2026-01-08', 0))$$,
    :'learner'
  ),
  '23514', 'new row for relation "day_plans" violates check constraint "day_plans_blocks_check"',
  'a plan whose blocks JSON exceeds 128 KB raises the check constraint error'
);
select throws_ok(
  format(
    $$select public.apply_system_event(%L,
        tests.sys_event(gen_random_uuid()::text, 'plan.generated', tests.generated('baseline', 1)),
        tests.plan_changes('2026-01-08', tests.blocks('2026-01-08', 30), tests.weeks(1)),
        tests.plan_expected('2026-01-08', 0))$$,
    :'suspended'
  ),
  '42501', 'inactive', 'a plan for a suspended user raises inactive'
);
select throws_ok(
  format(
    $$select public.apply_system_event(%L,
        tests.sys_event(gen_random_uuid()::text, 'block.checked_in',
                        '{"status": "done", "minutes": 30, "auto": true}',
                        p_plan => '72000000-0000-4000-8000-0000000000b2', p_block => %L,
                        p_track => 'dsa'),
        jsonb_build_array(tests.change('plan_block_state', tests.block_row(
          '72000000-0000-4000-8000-0000000000b2', %2$L))),
        jsonb_build_object(
          'plan_block_state:72000000-0000-4000-8000-0000000000b2/' || %2$L, 0))$$,
    :'suspended', :'today' || ':dsa:new:1'
  ),
  '42501', 'inactive', '... and so does their auto check-in'
);
select tests.clear_authentication();
select results_eq(
  format(
    $$select (select count(*)::int from public.day_plans
               where plan_date = '2026-01-08' and user_id in (%1$L, %2$L)),
             (select count(*)::int from public.events where user_id in (%1$L, %2$L)),
             (select count(*)::int from public.plan_block_state where user_id = %2$L)$$,
    :'learner', :'suspended'
  ),
  $$values (0, 8, 0)$$,
  '... none of them stored a plan, an event or a check-in'
);

select results_eq(
  $$select r.rolname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    cross join (values ('anon'::text), ('authenticated'), ('service_role')) as r (rolname)
    where n.nspname = 'public' and p.proname = 'apply_system_event'
      and has_function_privilege(r.rolname, p.oid, 'EXECUTE')$$,
  $$values ('service_role'::text)$$,
  'apply_system_event: EXECUTE for service_role only (authenticated and anon: none)'
);
select tests.authenticate_as(:'learner');
select throws_ok(
  format(
    $$select public.apply_system_event(%L,
        tests.sys_event(gen_random_uuid()::text, 'plan.generated', tests.generated('rebuild', 3)),
        tests.plan_changes(%L, tests.blocks(%2$L, 60), tests.weeks(3)),
        tests.plan_expected(%2$L, 2))$$,
    :'learner', :'today'
  ),
  '42501', 'permission denied for function apply_system_event',
  'a learner (authenticated) cannot execute apply_system_event'
);

select tests.authenticate_as_service_role();
select throws_ok(
  format(
    $$select public.apply_system_event(%L,
        tests.sys_event(gen_random_uuid()::text, 'onboarding.completed'), '[]',
        tests.plan_expected('2026-01-09', 0))$$,
    :'learner'
  ),
  'P0001', 'invalid_event', 'onboarding.completed with a non-empty p_expected raises invalid_event'
);
select throws_ok(
  format(
    $$select public.apply_system_event(%L,
        tests.sys_event(gen_random_uuid()::text, 'onboarding.completed', p_plan => %L))$$,
    :'learner', :'plan_today'
  ),
  'P0001', 'invalid_event', '... and so does one naming a plan'
);
select tests.clear_authentication();
select is(
  (select onboarded_at from public.profiles where id = :'learner'),
  null,
  '... and neither onboards the user'
);

-- Every other system type stays not_implemented, before any lock or lookup (its owning task:
-- plan.extra_added 5.4, plan.ai_* 6.5, user_item.* and roadmap.override_* 6.6,
-- admin.bot_token_rotated 6.3, item.snapshot the compaction job; the admin decisions have their
-- own functions).
select results_eq(
  format(
    $$select t, tests.system_error(%L, jsonb_build_object(
          'id', gen_random_uuid(), 'type', t, 'payload', '{}'::jsonb))
      from unnest(public.system_event_types()) as t
      where t not in ('onboarding.completed', 'plan.generated', 'block.checked_in')
      order by 1$$,
    :'learner'
  ),
  $$select t, 'not_implemented'::text
    from unnest(array[
      'admin.ai_flag_changed', 'admin.bootstrapped', 'admin.bot_token_rotated',
      'admin.role_changed', 'admin.user_approved', 'admin.user_rejected', 'admin.user_suspended',
      'item.snapshot', 'plan.ai_applied', 'plan.ai_proposed', 'plan.ai_skipped',
      'plan.extra_added', 'roadmap.override_resumed', 'roadmap.override_revoked',
      'roadmap.override_set', 'roadmap.override_suspended', 'user_item.created',
      'user_item.hidden', 'user_item.retired'
    ]) as t order by 1$$,
  'every other system type (19) raises not_implemented'
);

select * from finish();
rollback;
