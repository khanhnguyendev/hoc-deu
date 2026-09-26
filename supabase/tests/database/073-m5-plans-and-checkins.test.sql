begin;
set client_min_messages = warning;
create extension if not exists pgtap with schema extensions;
\ir _helpers.psql

select plan(39);

-- Task 5.0b: SQL for plans and check-ins (platform design §2.3, §4.3–§4.5, §5.5, §5.9;
-- implementation plan Part B-M5 decisions 9, 22, 23, 30; rulings M4-R12, M4-R21, M4-R22, M5-R2,
-- owner ruling M-6 (a)). The server calls apply_system_event with the secret key (service_role);
-- learner check-ins go through apply_event as the learner.

-- A system event as lib/events/apply.ts sends it (snake_case keys); rules_version defaults to
-- rules_version().
create function tests.sys_event(
  p_id text, p_type text, p_payload jsonb default '{}'::jsonb, p_plan text default null,
  p_track text default null, p_local_day text default null
) returns jsonb language sql immutable as $$
  select jsonb_strip_nulls(jsonb_build_object(
      'id', p_id, 'type', p_type, 'plan_id', p_plan, 'track_id', p_track,
      'local_day', p_local_day))
    || jsonb_build_object('payload', p_payload)
$$;

-- The blocks of a plan for p_date (the camelCase JSON of lib/domain/plan/types.ts): a review and
-- a new block of dsa.
create function tests.blocks(p_date text) returns jsonb language sql immutable as $$
  select jsonb_build_array(
    jsonb_build_object(
      'id', p_date || ':dsa:review:1', 'trackId', 'dsa', 'kind', 'review', 'estMinutes', 15,
      'items', '[]'::jsonb),
    jsonb_build_object(
      'id', p_date || ':dsa:new:1', 'trackId', 'dsa', 'kind', 'new', 'estMinutes', 30,
      'items', jsonb_build_array(
        jsonb_build_object('itemId', 'dsa:lc-0001', 'mode', 'new', 'minutes', 30))))
$$;

-- plan.generated's payload, p_changes and p_expected (as 072).
create function tests.generated(p_mode text, p_version integer) returns jsonb
language sql immutable as $$
  select jsonb_build_object('mode', p_mode, 'planVersion', p_version)
$$;
create function tests.plan_changes(p_date text) returns jsonb language sql immutable as $$
  select jsonb_build_array(jsonb_build_object(
    'table', 'day_plans',
    'row', jsonb_build_object('plan_date', p_date, 'blocks', tests.blocks(p_date),
                              'roadmap_weeks', '{}'::jsonb)))
$$;
create function tests.plan_expected(p_date text, p_version integer) returns jsonb
language sql immutable as $$
  select jsonb_build_object('day_plans:' || p_date, p_version)
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
grant execute on function
  tests.sys_event(text, text, jsonb, text, text, text),
  tests.blocks(text),
  tests.generated(text, integer),
  tests.plan_changes(text),
  tests.plan_expected(text, integer),
  tests.holds_advisory_lock(bigint)
to authenticated, service_role;

select tests.create_user('m5-r21@hocdeu.test') as r21 \gset
-- Every user of this file has the default schedule, so they share one local day (T), as
-- YYYY-MM-DD text whatever DateStyle (ruling M4-R12).
select to_char(public.user_local_day(:'r21', now()), 'YYYY-MM-DD') as today \gset
select to_char(public.user_local_day(:'r21', now()) - 1, 'YYYY-MM-DD') as yesterday \gset
select to_char(public.user_local_day(:'r21', now()) - 2, 'YYYY-MM-DD') as two_days_ago \gset

-- ---------------------------------------------------------------------------------------------
-- 1. Ruling M4-R21: plan.generated raises day_changed before it can return plan_exists, so
--    plan_exists only ever returns a plan of the database's own local day. A plan built for
--    yesterday and stored after the day start used to get yesterday's plan back as plan_exists.
-- ---------------------------------------------------------------------------------------------
-- Yesterday's plan has a check-in, so a rebuild of it would be plan_in_use.
insert into public.day_plans (id, user_id, plan_date, blocks) values
  ('73000000-0000-4000-8000-0000000000a1', :'r21', :'yesterday', tests.blocks(:'yesterday'));
insert into public.plan_block_state
  (plan_id, block_id, user_id, track_id, status, minutes, checked_in_on) values
  ('73000000-0000-4000-8000-0000000000a1', :'yesterday' || ':dsa:review:1', :'r21', 'dsa', 'done',
   15, :'yesterday');
select tests.authenticate_as_service_role();
select public.apply_system_event(
  :'r21',
  tests.sys_event('73000000-0000-4000-8000-000000000101', 'plan.generated',
                  tests.generated('baseline', 1), p_local_day => :'today'),
  tests.plan_changes(:'today'),
  tests.plan_expected(:'today', 0)
) ->> 'plan_id' as r21_today \gset
select throws_ok(
  format(
    $$select public.apply_system_event(%1$L,
        tests.sys_event(gen_random_uuid()::text, 'plan.generated',
                        tests.generated('baseline', 1), p_local_day => %2$L),
        tests.plan_changes(%2$L), tests.plan_expected(%2$L, 0))$$,
    :'r21', :'yesterday'
  ),
  'P0001', 'day_changed',
  'a second plan.generated for D (yesterday, which has a plan) whose local_day is not the '
  'database''s raises day_changed, not plan_exists'
);
select is(
  public.apply_system_event(
    :'r21',
    tests.sys_event('73000000-0000-4000-8000-000000000102', 'plan.generated',
                    tests.generated('baseline', 1), p_local_day => :'today'),
    tests.plan_changes(:'today'),
    tests.plan_expected(:'today', 0)
  ),
  jsonb_build_object('outcome', 'plan_exists', 'plan_id', :'r21_today', 'versions', '{}'::jsonb),
  '... with the database''s local_day, a second plan.generated for today returns plan_exists'
);
select throws_ok(
  format(
    $$select public.apply_system_event(%1$L,
        tests.sys_event(gen_random_uuid()::text, 'plan.generated',
                        tests.generated('rebuild', 2), p_local_day => %2$L),
        tests.plan_changes(%2$L), tests.plan_expected(%2$L, 1))$$,
    :'r21', :'yesterday'
  ),
  'P0001', 'day_changed',
  'a rebuild of yesterday''s plan (touched) with local_day yesterday raises day_changed, not '
  'plan_in_use (before the rebuild check)'
);
select is(
  public.apply_system_event(
    :'r21',
    tests.sys_event('73000000-0000-4000-8000-000000000101', 'plan.generated',
                    tests.generated('baseline', 1), p_local_day => :'yesterday'),
    tests.plan_changes(:'yesterday'),
    tests.plan_expected(:'yesterday', 0)
  ),
  '{"outcome": "duplicate", "versions": {}}'::jsonb,
  'an event id already recorded is a duplicate, whatever its local_day (the duplicate check '
  'comes first)'
);
select tests.clear_authentication();
select results_eq(
  format(
    $$select (select count(*)::int from public.events where user_id = %1$L),
             (select string_agg(version::text, ',' order by plan_date)
                from public.day_plans where user_id = %1$L)$$,
    :'r21'
  ),
  $$values (1, '1,1'::text)$$,
  '... none of them wrote an event or changed a plan'
);

-- ---------------------------------------------------------------------------------------------
-- 2. plan.extra_added (decision 22): p_changes holds the track's whole extra block; SQL checks
--    that it only appends payload.itemIds to that block (or creates it), bumps the plan's
--    version and stores the event with the plan_id (the plan is touched).
-- ---------------------------------------------------------------------------------------------
-- The track's extra block on p_date (`<date>:<track>:extra:1`) listing p_items, 10 minutes each.
create function tests.extra_block(p_date text, p_track text, p_items text[]) returns jsonb
language sql immutable as $$
  select jsonb_build_object(
    'id', p_date || ':' || p_track || ':extra:1', 'trackId', p_track, 'kind', 'extra',
    'estMinutes', 10 * coalesce(array_length(p_items, 1), 0),
    'items', coalesce(
      (select jsonb_agg(jsonb_build_object('itemId', u.i, 'mode', 'new', 'minutes', 10)
                        order by u.n)
       from unnest(p_items) with ordinality as u (i, n)),
      '[]'::jsonb))
$$;

-- plan.extra_added through apply_system_event, as lib/events/plans.ts addExtraItems sends it:
-- the whole extra block after the addition in p_changes, the plan's version in p_expected.
create function tests.add_extra(
  p_user uuid, p_id text, p_plan text, p_date text, p_track text, p_item_ids text[],
  p_block jsonb, p_expected integer, p_local_day text default null
) returns jsonb language sql as $$
  select public.apply_system_event(
    p_user,
    tests.sys_event(p_id, 'plan.extra_added',
                    jsonb_build_object('itemIds', to_jsonb(p_item_ids)), p_plan, p_track,
                    p_local_day),
    jsonb_build_array(jsonb_build_object('table', 'day_plan_block', 'row', p_block)),
    tests.plan_expected(p_date, p_expected))
$$;

grant execute on function
  tests.extra_block(text, text, text[]),
  tests.add_extra(uuid, text, text, text, text, text[], jsonb, integer, text)
to authenticated, service_role;

select tests.create_user('m5-extra@hocdeu.test') as extra \gset
select tests.create_user('m5-extra-other@hocdeu.test') as extra_other \gset
insert into public.day_plans (id, user_id, plan_date, blocks) values
  ('73000000-0000-4000-8000-0000000000e1', :'extra', :'today', tests.blocks(:'today')),
  ('73000000-0000-4000-8000-0000000000e2', :'extra_other', :'today', tests.blocks(:'today')),
  -- A plan 30 bytes under the 128 KB bound: one more item does not fit.
  ('73000000-0000-4000-8000-0000000000e3', :'extra', '2026-01-10',
   jsonb_build_array(repeat('x', 131072 - 30 - 4)));
select ok(
  octet_length((select blocks::text from public.day_plans
                where id = '73000000-0000-4000-8000-0000000000e3')) = 131072 - 30,
  '(the third plan''s blocks are 30 bytes under the day_plans bound)'
);

select tests.authenticate_as_service_role();
select is(
  tests.add_extra(
    :'extra', '73000000-0000-4000-8000-000000000201', '73000000-0000-4000-8000-0000000000e1',
    :'today', 'dsa', array['dsa:lc-0101'],
    tests.extra_block(:'today', 'dsa', array['dsa:lc-0101']), 1, :'today'),
  jsonb_build_object(
    'outcome', 'applied', 'plan_id', '73000000-0000-4000-8000-0000000000e1',
    'versions', tests.plan_expected(:'today', 2)),
  'a new extra block returns applied with the plan_id and versions {day_plans:<date>: n + 1}'
);
select tests.clear_authentication();
select results_eq(
  $$select version, blocks from public.day_plans
    where id = '73000000-0000-4000-8000-0000000000e1'$$,
  format(
    $$values (2, tests.blocks(%1$L)
                 || jsonb_build_array(tests.extra_block(%1$L, 'dsa', array['dsa:lc-0101'])))$$,
    :'today'
  ),
  '... appends the block to the plan at version 2'
);
select results_eq(
  format(
    $$select id, type, source, actor_id, plan_id, track_id, block_id, payload
      from public.events where user_id = %L$$,
    :'extra'
  ),
  format(
    $$values ('73000000-0000-4000-8000-000000000201'::uuid, 'plan.extra_added'::text,
              'system'::text, %L::uuid, '73000000-0000-4000-8000-0000000000e1'::uuid,
              'dsa'::text, null::text, '{"itemIds": ["dsa:lc-0101"]}'::jsonb)$$,
    :'extra'
  ),
  '... and stores one plan.extra_added event carrying the plan_id'
);
select ok(
  tests.holds_advisory_lock(public.plan_lock_key(:'extra', :'today')),
  '... under the (user, plan_date) advisory lock (decision 33)'
);

select tests.authenticate_as_service_role();
select is(
  tests.add_extra(
    :'extra', '73000000-0000-4000-8000-000000000202', '73000000-0000-4000-8000-0000000000e1',
    :'today', 'english', array['english:card-0001'],
    tests.extra_block(:'today', 'english', array['english:card-0001']), 2, :'today')
    -> 'versions',
  tests.plan_expected(:'today', 3),
  'another track''s extra block is a block of its own (version 3)'
);
select is(
  tests.add_extra(
    :'extra', '73000000-0000-4000-8000-000000000203', '73000000-0000-4000-8000-0000000000e1',
    :'today', 'dsa', array['dsa:lc-0102', 'dsa:lc-0103'],
    tests.extra_block(:'today', 'dsa', array['dsa:lc-0101', 'dsa:lc-0102', 'dsa:lc-0103']), 3,
    :'today') -> 'versions',
  tests.plan_expected(:'today', 4),
  'a second addition to the dsa extra block returns version 4'
);
select tests.clear_authentication();
select results_eq(
  $$select version, blocks from public.day_plans
    where id = '73000000-0000-4000-8000-0000000000e1'$$,
  format(
    $$values (4, tests.blocks(%1$L)
                 || jsonb_build_array(
                      tests.extra_block(
                        %1$L, 'dsa', array['dsa:lc-0101', 'dsa:lc-0102', 'dsa:lc-0103']),
                      tests.extra_block(%1$L, 'english', array['english:card-0001'])))$$,
    :'today'
  ),
  '... which replaces the dsa extra block in place (before the english one)'
);

-- invalid_event: the block may only append payload.itemIds to the stored extra block.
select tests.authenticate_as_service_role();
select throws_ok(
  format(
    $$select tests.add_extra(%1$L, gen_random_uuid()::text, %2$L, %3$L, 'dsa',
        array['dsa:lc-0101'],
        tests.extra_block(%3$L, 'dsa',
          array['dsa:lc-0101', 'dsa:lc-0102', 'dsa:lc-0103', 'dsa:lc-0101']), 4, %3$L)$$,
    :'extra', '73000000-0000-4000-8000-0000000000e1', :'today'
  ),
  'P0001', 'invalid_event', 're-sending an item the extra block already lists raises invalid_event'
);
select throws_ok(
  format(
    $$select tests.add_extra(%1$L, gen_random_uuid()::text, %2$L, %3$L, 'dsa',
        array['dsa:lc-0104'],
        tests.extra_block(%3$L, 'dsa',
          array['dsa:lc-0102', 'dsa:lc-0101', 'dsa:lc-0103', 'dsa:lc-0104']), 4, %3$L)$$,
    :'extra', '73000000-0000-4000-8000-0000000000e1', :'today'
  ),
  'P0001', 'invalid_event',
  'a block whose earlier items differ (another order) raises invalid_event'
);
select throws_ok(
  format(
    $$select tests.add_extra(%1$L, gen_random_uuid()::text, %2$L, %3$L, 'dsa',
        array['dsa:lc-0104'],
        jsonb_set(
          tests.extra_block(%3$L, 'dsa',
            array['dsa:lc-0101', 'dsa:lc-0102', 'dsa:lc-0103', 'dsa:lc-0104']),
          '{items,0,minutes}', '25'), 4, %3$L)$$,
    :'extra', '73000000-0000-4000-8000-0000000000e1', :'today'
  ),
  'P0001', 'invalid_event', '... and so does one whose earlier item objects differ (minutes)'
);
select throws_ok(
  format(
    $$select tests.add_extra(%1$L, gen_random_uuid()::text, %2$L, %3$L, 'dsa',
        array['dsa:lc-0104'],
        tests.extra_block(%3$L, 'dsa', array['dsa:lc-0101', 'dsa:lc-0104']), 4, %3$L)$$,
    :'extra', '73000000-0000-4000-8000-0000000000e1', :'today'
  ),
  'P0001', 'invalid_event', '... or one that drops an item'
);
select throws_ok(
  format(
    $$select tests.add_extra(%1$L, gen_random_uuid()::text, %2$L, %3$L, 'dsa',
        array['dsa:lc-0104'],
        tests.extra_block(%3$L, 'dsa',
          array['dsa:lc-0101', 'dsa:lc-0102', 'dsa:lc-0103', 'dsa:lc-0105']), 4, %3$L)$$,
    :'extra', '73000000-0000-4000-8000-0000000000e1', :'today'
  ),
  'P0001', 'invalid_event', '... or one whose new items are not payload.itemIds'
);
select throws_ok(
  format(
    $$select tests.add_extra(%1$L, gen_random_uuid()::text, %2$L, %3$L, 'dsa',
        array['dsa:lc-0104'],
        jsonb_set(
          tests.extra_block(%3$L, 'dsa',
            array['dsa:lc-0101', 'dsa:lc-0102', 'dsa:lc-0103', 'dsa:lc-0104']),
          '{id}', to_jsonb(%3$L || ':dsa:extra:2')), 4, %3$L)$$,
    :'extra', '73000000-0000-4000-8000-0000000000e1', :'today'
  ),
  'P0001', 'invalid_event', 'a block id other than <date>:<track>:extra:1 raises invalid_event'
);
select throws_ok(
  format(
    $$select tests.add_extra(%1$L, gen_random_uuid()::text, %2$L, %3$L, 'dsa',
        array['dsa:lc-0104'],
        jsonb_set(
          tests.extra_block(%3$L, 'dsa',
            array['dsa:lc-0101', 'dsa:lc-0102', 'dsa:lc-0103', 'dsa:lc-0104']),
          '{kind}', '"new"'), 4, %3$L)$$,
    :'extra', '73000000-0000-4000-8000-0000000000e1', :'today'
  ),
  'P0001', 'invalid_event', '... and so does a kind other than extra'
);
select throws_ok(
  format(
    $$select tests.add_extra(%1$L, gen_random_uuid()::text, %2$L, %3$L, 'dsa',
        array['dsa:lc-0104'],
        jsonb_set(
          tests.extra_block(%3$L, 'dsa',
            array['dsa:lc-0101', 'dsa:lc-0102', 'dsa:lc-0103', 'dsa:lc-0104']),
          '{trackId}', '"english"'), 4, %3$L)$$,
    :'extra', '73000000-0000-4000-8000-0000000000e1', :'today'
  ),
  'P0001', 'invalid_event', '... a trackId other than the event''s track_id'
);
select throws_ok(
  format(
    $$select tests.add_extra(%1$L, gen_random_uuid()::text, %2$L, %3$L, 'dsa',
        array['dsa:lc-0104'],
        jsonb_set(
          tests.extra_block(%3$L, 'dsa',
            array['dsa:lc-0101', 'dsa:lc-0102', 'dsa:lc-0103', 'dsa:lc-0104']),
          '{estMinutes}', '"40"'), 4, %3$L)$$,
    :'extra', '73000000-0000-4000-8000-0000000000e1', :'today'
  ),
  'P0001', 'invalid_event', '... or an estMinutes that is not a number'
);
select throws_ok(
  format(
    $$select tests.add_extra(%1$L, gen_random_uuid()::text, %2$L, %3$L, 'dsa',
        (select array_agg('dsa:x-' || g) from generate_series(1, 21) g),
        tests.extra_block(%3$L, 'dsa',
          array['dsa:lc-0101', 'dsa:lc-0102', 'dsa:lc-0103']
            || (select array_agg('dsa:x-' || g) from generate_series(1, 21) g)), 4, %3$L)$$,
    :'extra', '73000000-0000-4000-8000-0000000000e1', :'today'
  ),
  'P0001', 'invalid_event', '21 item ids (the bound is 20, ruling M5-R2) raise invalid_event'
);
select throws_ok(
  format(
    $$select tests.add_extra(%1$L, gen_random_uuid()::text, %2$L, %3$L, 'dsa',
        array['dsa:lc-0104', 'dsa:lc-0104'],
        tests.extra_block(%3$L, 'dsa',
          array['dsa:lc-0101', 'dsa:lc-0102', 'dsa:lc-0103', 'dsa:lc-0104', 'dsa:lc-0104']),
        4, %3$L)$$,
    :'extra', '73000000-0000-4000-8000-0000000000e1', :'today'
  ),
  'P0001', 'invalid_event', '... and so does a repeated item id'
);
select throws_ok(
  format(
    $$select tests.add_extra(%1$L, gen_random_uuid()::text, %2$L, %3$L, 'dsa',
        array[repeat('x', 129)],
        tests.extra_block(%3$L, 'dsa',
          array['dsa:lc-0101', 'dsa:lc-0102', 'dsa:lc-0103', repeat('x', 129)]), 4, %3$L)$$,
    :'extra', '73000000-0000-4000-8000-0000000000e1', :'today'
  ),
  'P0001', 'invalid_event', '... an item id of 129 characters'
);
select throws_ok(
  format(
    $$select tests.add_extra(%1$L, gen_random_uuid()::text, %2$L, %3$L, 'dsa',
        array[]::text[],
        tests.extra_block(%3$L, 'dsa', array['dsa:lc-0101', 'dsa:lc-0102', 'dsa:lc-0103']), 4,
        %3$L)$$,
    :'extra', '73000000-0000-4000-8000-0000000000e1', :'today'
  ),
  'P0001', 'invalid_event', '... no item ids'
);
select throws_ok(
  format(
    $$select public.apply_system_event(%1$L,
        tests.sys_event(gen_random_uuid()::text, 'plan.extra_added',
                        '{"itemIds": ["dsa:lc-0104"], "note": "x"}', %2$L, 'dsa', %3$L),
        jsonb_build_array(jsonb_build_object('table', 'day_plan_block', 'row',
          tests.extra_block(%3$L, 'dsa',
            array['dsa:lc-0101', 'dsa:lc-0102', 'dsa:lc-0103', 'dsa:lc-0104']))),
        tests.plan_expected(%3$L, 4))$$,
    :'extra', '73000000-0000-4000-8000-0000000000e1', :'today'
  ),
  'P0001', 'invalid_event', '... a payload key other than itemIds'
);
select throws_ok(
  format(
    $$select tests.add_extra(%1$L, gen_random_uuid()::text, null, %2$L, 'dsa',
        array['dsa:lc-0104'],
        tests.extra_block(%2$L, 'dsa',
          array['dsa:lc-0101', 'dsa:lc-0102', 'dsa:lc-0103', 'dsa:lc-0104']), 4, %2$L)$$,
    :'extra', :'today'
  ),
  'P0001', 'invalid_event', '... no plan_id'
);
select throws_ok(
  format(
    $$select tests.add_extra(%1$L, gen_random_uuid()::text, %2$L, %3$L, null,
        array['dsa:lc-0104'],
        tests.extra_block(%3$L, 'dsa',
          array['dsa:lc-0101', 'dsa:lc-0102', 'dsa:lc-0103', 'dsa:lc-0104']), 4, %3$L)$$,
    :'extra', '73000000-0000-4000-8000-0000000000e1', :'today'
  ),
  'P0001', 'invalid_event', '... no track_id'
);
select throws_ok(
  format(
    $$select tests.add_extra(%1$L, gen_random_uuid()::text, %2$L, %4$L, 'dsa',
        array['dsa:lc-0104'],
        tests.extra_block(%3$L, 'dsa',
          array['dsa:lc-0101', 'dsa:lc-0102', 'dsa:lc-0103', 'dsa:lc-0104']), 4, %3$L)$$,
    :'extra', '73000000-0000-4000-8000-0000000000e1', :'today', :'yesterday'
  ),
  'P0001', 'invalid_event', '... a p_expected key for another date than the plan''s'
);
select throws_ok(
  format(
    $$select public.apply_system_event(%1$L,
        tests.sys_event(gen_random_uuid()::text, 'plan.extra_added',
                        '{"itemIds": ["dsa:lc-0104"]}', %2$L, 'dsa', %3$L),
        jsonb_build_array(jsonb_build_object('table', 'day_plans', 'row',
          tests.extra_block(%3$L, 'dsa',
            array['dsa:lc-0101', 'dsa:lc-0102', 'dsa:lc-0103', 'dsa:lc-0104']))),
        tests.plan_expected(%3$L, 4))$$,
    :'extra', '73000000-0000-4000-8000-0000000000e1', :'today'
  ),
  'P0001', 'invalid_event', '... a change of another table than day_plan_block'
);
select throws_ok(
  format(
    $$select tests.add_extra(%1$L, gen_random_uuid()::text, %2$L, %3$L, 'dsa',
        array['dsa:lc-0104'],
        tests.extra_block(%3$L, 'dsa',
          array['dsa:lc-0101', 'dsa:lc-0102', 'dsa:lc-0103', 'dsa:lc-0104']), 3, %3$L)$$,
    :'extra', '73000000-0000-4000-8000-0000000000e1', :'today'
  ),
  'P0001', 'version_conflict',
  'a stale expected version (3; the plan is at 4) raises version_conflict'
);
select throws_ok(
  format(
    $$select tests.add_extra(%1$L, gen_random_uuid()::text, %2$L, %3$L, 'dsa',
        array['dsa:lc-0104'], tests.extra_block(%3$L, 'dsa', array['dsa:lc-0104']), 1, %3$L)$$,
    :'extra', '73000000-0000-4000-8000-0000000000e2', :'today'
  ),
  'P0001', 'invalid_event', 'another user''s plan raises invalid_event'
);
select throws_ok(
  format(
    $$select tests.add_extra(%1$L, gen_random_uuid()::text, %2$L, %3$L, 'dsa',
        array['dsa:lc-0104'],
        tests.extra_block(%3$L, 'dsa',
          array['dsa:lc-0101', 'dsa:lc-0102', 'dsa:lc-0103', 'dsa:lc-0104']), 4, %4$L)$$,
    :'extra', '73000000-0000-4000-8000-0000000000e1', :'today', :'yesterday'
  ),
  'P0001', 'day_changed',
  'a local_day other than the database''s raises day_changed (decision 10 of M4)'
);
select throws_ok(
  format(
    $$select tests.add_extra(%1$L, gen_random_uuid()::text,
        '73000000-0000-4000-8000-0000000000e3', '2026-01-10', 'dsa', array['dsa:lc-0104'],
        tests.extra_block('2026-01-10', 'dsa', array['dsa:lc-0104']), 1)$$,
    :'extra'
  ),
  '23514', 'new row for relation "day_plans" violates check constraint "day_plans_blocks_check"',
  'the day_plans size bound still bounds the plan'
);
select tests.clear_authentication();
select results_eq(
  format(
    $$select (select version from public.day_plans
               where id = '73000000-0000-4000-8000-0000000000e1'),
             (select version from public.day_plans
               where id = '73000000-0000-4000-8000-0000000000e2'),
             (select count(*)::int from public.events where user_id in (%L, %L))$$,
    :'extra', :'extra_other'
  ),
  $$values (4, 1, 3)$$,
  '... none of them changed a plan or stored an event'
);

-- The extra event touches the plan (§2.3): it is never rebuilt. The same event id is a duplicate.
select tests.authenticate_as_service_role();
select is(
  public.apply_system_event(
    :'extra',
    tests.sys_event('73000000-0000-4000-8000-000000000204', 'plan.generated',
                    tests.generated('rebuild', 5), p_local_day => :'today'),
    tests.plan_changes(:'today'),
    tests.plan_expected(:'today', 4)
  ),
  jsonb_build_object(
    'outcome', 'plan_in_use', 'plan_id', '73000000-0000-4000-8000-0000000000e1',
    'versions', '{}'::jsonb),
  'afterwards a rebuild of the plan returns plan_in_use'
);
select is(
  tests.add_extra(
    :'extra', '73000000-0000-4000-8000-000000000201', '73000000-0000-4000-8000-0000000000e1',
    :'today', 'dsa', array['dsa:lc-0104'],
    tests.extra_block(:'today', 'dsa',
      array['dsa:lc-0101', 'dsa:lc-0102', 'dsa:lc-0103', 'dsa:lc-0104']), 4, :'today'),
  '{"outcome": "duplicate", "versions": {}}'::jsonb,
  'the first event id again returns duplicate'
);
select tests.clear_authentication();
select results_eq(
  $$select version, jsonb_array_length(blocks) from public.day_plans
    where id = '73000000-0000-4000-8000-0000000000e1'$$,
  $$values (4, 4)$$,
  '... and neither changed the plan'
);

select * from finish();
rollback;
