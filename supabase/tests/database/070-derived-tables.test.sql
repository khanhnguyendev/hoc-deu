begin;
set client_min_messages = warning;
create extension if not exists pgtap with schema extensions;
\ir _helpers.psql

select plan(95);

-- Task 4.9a: day_plans and the derived tables (platform design §4.1, §4.3, §4.5; implementation
-- plan Part B-M4 decisions 6, 11, 18, 33, 35).

select tests.create_user('derived-learner@hocdeu.test') as learner \gset
select tests.create_user('derived-other@hocdeu.test') as other \gset
select tests.create_user('derived-pending@hocdeu.test', 'pending') as pending \gset
select tests.create_user('derived-cap@hocdeu.test') as cap \gset
select tests.create_user('derived-deleted@hocdeu.test') as deleted \gset
select tests.create_user('derived-permanent@hocdeu.test') as permanent \gset

-- Plans are written only by the server (apply_system_event, 4.9c), so they are inserted here as
-- postgres. The learner's first plan and the other user's are unseen, with a fixed updated_at; the
-- learner's second plan was seen earlier (fixed seen_at and updated_at), so "unchanged" is
-- observable although now() is constant in a transaction.
insert into public.day_plans (id, user_id, plan_date, blocks, seen_at, updated_at) values
  ('70000000-0000-4000-8000-000000000001', :'learner', '2026-09-25',
   '[{"id": "2026-09-25:dsa:review:1", "trackId": "dsa", "kind": "review", "estMinutes": 20, "items": []},
     {"id": "2026-09-25:dsa:new:1", "trackId": "dsa", "kind": "new", "estMinutes": 30, "items": []}]',
   null, '2026-01-01T00:00:00Z'),
  ('70000000-0000-4000-8000-000000000002', :'learner', '2026-09-24',
   '[{"id": "2026-09-24:dsa:review:1", "trackId": "dsa", "kind": "review", "estMinutes": 20, "items": []}]',
   '2026-01-02T00:00:00Z', '2026-01-02T00:00:00Z'),
  ('70000000-0000-4000-8000-000000000003', :'other', '2026-09-25',
   '[{"id": "2026-09-25:dsa:review:1", "trackId": "dsa", "kind": "review", "estMinutes": 20, "items": []}]',
   null, '2026-01-01T00:00:00Z'),
  ('70000000-0000-4000-8000-000000000004', :'deleted', '2026-09-25',
   '[{"id": "2026-09-25:dsa:review:1", "trackId": "dsa", "kind": "review", "estMinutes": 20, "items": []}]',
   null, '2026-01-01T00:00:00Z'),
  ('70000000-0000-4000-8000-000000000005', :'permanent', '2026-09-25',
   '[{"id": "2026-09-25:dsa:review:1", "trackId": "dsa", "kind": "review", "estMinutes": 20, "items": []}]',
   null, '2026-01-01T00:00:00Z');

-- ---------------------------------------------------------------------------------------------
-- 1. Shape: the four tables exist with RLS on, their policies, triggers and grants (decision 11:
--    UPDATE only on non-key columns). 001's invariants run over them too.
-- ---------------------------------------------------------------------------------------------
select has_table('public', 'day_plans', 'day_plans exists');
select has_table('public', 'plan_block_state', 'plan_block_state exists');
select has_table('public', 'item_state', 'item_state exists');
select has_table('public', 'daily_activity', 'daily_activity exists');
select bag_eq(
  $$select c.relname::text from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relrowsecurity
      and c.relname in ('day_plans', 'plan_block_state', 'item_state', 'daily_activity')$$,
  $$values ('day_plans'), ('plan_block_state'), ('item_state'), ('daily_activity')$$,
  'the four tables have row level security enabled'
);
select policies_are(
  'public', 'day_plans', array['day_plans_select_own'],
  'day_plans has only a select-own policy (only the server writes plans)'
);
select policies_are(
  'public', 'plan_block_state',
  array['plan_block_state_select_own', 'plan_block_state_insert_own', 'plan_block_state_update_own'],
  'plan_block_state has select-, insert- and update-own policies'
);
select policies_are(
  'public', 'item_state',
  array['item_state_select_own', 'item_state_insert_own', 'item_state_update_own',
        'item_state_delete_own'],
  'item_state has select-, insert-, update- and delete-own policies (delete: track.reset)'
);
select policies_are(
  'public', 'daily_activity',
  array['daily_activity_select_own', 'daily_activity_insert_own', 'daily_activity_update_own'],
  'daily_activity has select-, insert- and update-own policies'
);
select triggers_are(
  'public', 'day_plans', array['day_plans_permanent', 'set_updated_at'],
  'day_plans has the permanence and updated_at triggers'
);
select triggers_are(
  'public', 'plan_block_state', array['check_in_day', 'known_block'],
  'plan_block_state has the check-in-day (task 5.0b) and known-block triggers'
);
select triggers_are('public', 'item_state', array['limit_rows'], 'item_state has the row-cap trigger');
select triggers_are(
  'public', 'daily_activity', array['local_day_window'], 'daily_activity has the local-day trigger'
);
select table_privs_are(
  'public', 'day_plans', 'authenticated', array['SELECT'],
  'authenticated may only select day_plans'
);
select table_privs_are(
  'public', 'plan_block_state', 'authenticated', array['SELECT', 'INSERT'],
  'authenticated may select and insert plan_block_state (update: per column)'
);
select table_privs_are(
  'public', 'item_state', 'authenticated', array['SELECT', 'INSERT', 'DELETE'],
  'authenticated may select, insert and delete item_state (update: per column)'
);
select table_privs_are(
  'public', 'daily_activity', 'authenticated', array['SELECT', 'INSERT'],
  'authenticated may select and insert daily_activity (update: per column)'
);
select results_eq(
  $$select c.relname::text collate "default", a.attname::text collate "default"
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in ('day_plans', 'plan_block_state', 'item_state', 'daily_activity')
      and a.attnum > 0 and not a.attisdropped
      and has_column_privilege('authenticated', c.oid, a.attnum, 'UPDATE')
    order by 1, 2$$,
  $$values
    ('daily_activity'::text, 'completed'::text), ('daily_activity', 'items_done'),
    ('daily_activity', 'minutes_by_track'), ('daily_activity', 'rules_version'),
    ('daily_activity', 'version'),
    ('item_state', 'due_on'), ('item_state', 'introduced_on'), ('item_state', 'item_type'),
    ('item_state', 'lapses'), ('item_state', 'last_result'), ('item_state', 'last_result_on'),
    ('item_state', 'level'), ('item_state', 'reps'), ('item_state', 'rules_version'),
    ('item_state', 'status'), ('item_state', 'top_successes'), ('item_state', 'topic_id'),
    ('item_state', 'track_id'), ('item_state', 'version'), ('item_state', 'weak'),
    ('plan_block_state', 'auto'), ('plan_block_state', 'checked_in_at'),
    ('plan_block_state', 'checked_in_on'), ('plan_block_state', 'minutes'),
    ('plan_block_state', 'note'),
    ('plan_block_state', 'rules_version'), ('plan_block_state', 'status'),
    ('plan_block_state', 'version')$$,
  'authenticated may UPDATE exactly the non-key columns of the derived tables, and nothing of '
  'day_plans (decision 11; plan_block_state.checked_in_on since task 5.0b, bounded by its '
  'check_in_day trigger)'
);

-- ---------------------------------------------------------------------------------------------
-- 2. Decision 18: the running database's rules version equals RULES_VERSION (tools/db/sql-sync
--    reads the literal below and compares it with lib/domain/rules.ts). Learner rows carry it.
-- ---------------------------------------------------------------------------------------------
select is(public.rules_version(), 3, 'the running rules_version() equals lib/domain/rules.ts RULES_VERSION');
select is(
  (select rules_version from public.day_plans where id = '70000000-0000-4000-8000-000000000001'),
  3,
  'a plan inserted without rules_version gets 3'
);
select tests.authenticate_as(:'learner');
insert into public.events (id, user_id, type, rules_version)
values ('70000000-0000-4000-8000-000000000101', auth.uid(), 'item.skipped', 1);
select is(
  (select rules_version from public.events where id = '70000000-0000-4000-8000-000000000101'),
  3,
  'a learner event is stored with rules_version 3 (it sent 1; the events trigger forces it)'
);
select tests.clear_authentication();

-- ---------------------------------------------------------------------------------------------
-- 3. A learner sees only their own rows and cannot write day_plans.
-- ---------------------------------------------------------------------------------------------
insert into public.plan_block_state
  (plan_id, block_id, user_id, track_id, status, minutes, checked_in_on) values
  ('70000000-0000-4000-8000-000000000001', '2026-09-25:dsa:review:1', :'learner', 'dsa', 'done',
   20, '2026-09-25'),
  ('70000000-0000-4000-8000-000000000003', '2026-09-25:dsa:review:1', :'other', 'dsa', 'done',
   20, '2026-09-25');
insert into public.item_state
  (user_id, item_id, track_id, topic_id, item_type, status, introduced_on) values
  (:'learner', 'dsa:two-sum', 'dsa', 'arrays', 'problem', 'ok', '2026-09-20'),
  (:'other', 'dsa:two-sum', 'dsa', 'arrays', 'problem', 'ok', '2026-09-20'),
  (:'other', 'dsa:valid-anagram', 'dsa', 'arrays', 'problem', 'weak', '2026-09-20');
insert into public.daily_activity (user_id, local_day) values
  (:'learner', '2000-01-01'), (:'other', '2000-01-01'), (:'other', '2000-01-02');

select tests.authenticate_as(:'learner');
select results_eq(
  'select id from public.day_plans order by id',
  $$values ('70000000-0000-4000-8000-000000000001'::uuid),
           ('70000000-0000-4000-8000-000000000002'::uuid)$$,
  'a learner sees only their own plans'
);
select results_eq(
  'select plan_id, block_id from public.plan_block_state',
  $$values ('70000000-0000-4000-8000-000000000001'::uuid, '2026-09-25:dsa:review:1'::text)$$,
  '... only their own block states'
);
select results_eq(
  'select item_id from public.item_state',
  $$values ('dsa:two-sum'::text)$$,
  '... only their own item states'
);
select results_eq(
  'select local_day from public.daily_activity',
  $$values ('2000-01-01'::date)$$,
  '... and only their own daily activity'
);
select throws_ok(
  $$insert into public.day_plans (user_id, plan_date, blocks) values (auth.uid(), '2026-10-01', '[]')$$,
  '42501', 'permission denied for table day_plans', 'a learner cannot insert a plan'
);
select throws_ok(
  $$update public.day_plans set seen_at = now()$$,
  '42501', 'permission denied for table day_plans',
  '... nor update one (seen_at goes through mark_plan_seen)'
);
select throws_ok(
  $$delete from public.day_plans$$,
  '42501', 'permission denied for table day_plans', '... nor delete one'
);
select tests.clear_authentication();

-- ---------------------------------------------------------------------------------------------
-- 4. mark_plan_seen (§4.5, §5.2): sets seen_at once, for the caller's own plan only.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_as(:'learner');
select is(
  public.mark_plan_seen('70000000-0000-4000-8000-000000000001'),
  true,
  'mark_plan_seen on the caller''s own unseen plan returns true'
);
select tests.clear_authentication();
select results_eq(
  $$select seen_at, updated_at from public.day_plans
    where id = '70000000-0000-4000-8000-000000000001'$$,
  $$values (now(), now())$$,
  '... and sets seen_at (updated_at follows)'
);
select ctid::text as seen_ctid from public.day_plans
where id = '70000000-0000-4000-8000-000000000001' \gset
select tests.authenticate_as(:'learner');
select is(
  public.mark_plan_seen('70000000-0000-4000-8000-000000000001'),
  true,
  'a second call returns true'
);
select tests.clear_authentication();
select is(
  (select ctid::text from public.day_plans where id = '70000000-0000-4000-8000-000000000001'),
  :'seen_ctid',
  '... and does not update the row at all (same row version)'
);
select tests.authenticate_as(:'learner');
select is(
  public.mark_plan_seen('70000000-0000-4000-8000-000000000002'),
  true,
  'mark_plan_seen on a plan seen earlier returns true'
);
select tests.clear_authentication();
select results_eq(
  $$select seen_at, updated_at from public.day_plans
    where id = '70000000-0000-4000-8000-000000000002'$$,
  $$values ('2026-01-02T00:00:00Z'::timestamptz, '2026-01-02T00:00:00Z'::timestamptz)$$,
  '... and leaves seen_at and updated_at unchanged'
);
select tests.authenticate_as(:'learner');
select is(
  public.mark_plan_seen('70000000-0000-4000-8000-000000000003'),
  false,
  'mark_plan_seen on another user''s plan returns false'
);
select is(
  public.mark_plan_seen('70000000-0000-4000-8000-0000000000ff'),
  false,
  '... and on a plan that does not exist, false too (nothing tells the two apart)'
);
select tests.clear_authentication();
select results_eq(
  $$select seen_at, updated_at from public.day_plans
    where id = '70000000-0000-4000-8000-000000000003'$$,
  $$values (null::timestamptz, '2026-01-01T00:00:00Z'::timestamptz)$$,
  '... and the other user''s plan is unchanged'
);
select tests.authenticate_as(:'pending');
select throws_ok(
  $$select public.mark_plan_seen('70000000-0000-4000-8000-000000000001')$$,
  '42501', 'inactive', 'a pending user gets inactive'
);
select tests.clear_authentication();
set local role authenticated;
select throws_ok(
  $$select public.mark_plan_seen('70000000-0000-4000-8000-000000000001')$$,
  '42501', 'not_authenticated', 'without a user id in the JWT, mark_plan_seen raises not_authenticated'
);
select tests.clear_authentication();
set local role anon;
select throws_ok(
  $$select public.mark_plan_seen('70000000-0000-4000-8000-000000000001')$$,
  '42501', 'permission denied for function mark_plan_seen', 'anon cannot execute mark_plan_seen'
);
select tests.clear_authentication();

-- ---------------------------------------------------------------------------------------------
-- 5. events.plan_id (§4.1): a learner may name only their own plans; the foreign key holds for
--    everyone else.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_as(:'learner');
select throws_ok(
  $$insert into public.events (id, user_id, type, plan_id, block_id)
    values ('70000000-0000-4000-8000-000000000111', auth.uid(), 'block.checked_in',
            '70000000-0000-4000-8000-000000000003', '2026-09-25:dsa:review:1')$$,
  '42501', 'forbidden_plan_id', 'a learner cannot insert an event naming another user''s plan'
);
select lives_ok(
  $$insert into public.events (id, user_id, type, plan_id, block_id)
    values ('70000000-0000-4000-8000-000000000112', auth.uid(), 'block.checked_in',
            '70000000-0000-4000-8000-000000000001', '2026-09-25:dsa:review:1')$$,
  '... but may name their own'
);
select throws_ok(
  $$insert into public.events (id, user_id, type, plan_id)
    values ('70000000-0000-4000-8000-000000000113', auth.uid(), 'item.skipped',
            '70000000-0000-4000-8000-0000000000ff')$$,
  '42501', 'forbidden_plan_id',
  'a plan that does not exist is forbidden_plan_id too (the trigger runs before the foreign key)'
);
select throws_ok(
  $$select public.apply_event(jsonb_build_object(
      'id', '70000000-0000-4000-8000-000000000114', 'type', 'settings.changed',
      'plan_id', '70000000-0000-4000-8000-000000000003', 'payload', '{}'::jsonb))$$,
  'P0001', 'invalid_event',
  'apply_event with another user''s plan_id raises invalid_event (its plan lookup, 4.9b, runs first)'
);
select tests.clear_authentication();
select throws_ok(
  format(
    $$insert into public.events (id, user_id, source, type, plan_id)
      values ('70000000-0000-4000-8000-000000000115', %L, 'system', 'plan.generated',
              '70000000-0000-4000-8000-0000000000ff')$$,
    :'learner'
  ),
  '23503', 'insert or update on table "events" violates foreign key constraint "events_plan_id_fkey"',
  'a system insert naming a plan that does not exist fails the foreign key'
);

-- ---------------------------------------------------------------------------------------------
-- 6. Bounds (decision 11): learners write their own derived rows directly (apply_event is
--    SECURITY INVOKER), so the database caps them; service_role and definer functions are trusted.
-- ---------------------------------------------------------------------------------------------

-- item_state: at most 5000 rows per user; the row an upsert would update is not counted.
select tests.authenticate_as(:'cap');
select lives_ok(
  $$insert into public.item_state (user_id, item_id, track_id, item_type, status, introduced_on)
    select auth.uid(), 'dsa:p' || g, 'dsa', 'problem', 'ok', '2026-09-20'
    from generate_series(1, 5000) g$$,
  'a learner inserts 5000 item_state rows'
);
select throws_ok(
  $$insert into public.item_state (user_id, item_id, track_id, item_type, status, introduced_on)
    values (auth.uid(), 'dsa:p5001', 'dsa', 'problem', 'ok', '2026-09-20')$$,
  'P0001', 'too_many_items', 'the 5001st raises too_many_items'
);
select lives_ok(
  $$insert into public.item_state (user_id, item_id, track_id, item_type, status, introduced_on)
    values (auth.uid(), 'dsa:p1', 'dsa', 'problem', 'ok', '2026-09-20')
    on conflict (user_id, item_id) do update set level = 1$$,
  '... but an upsert of an existing row is not counted'
);
select tests.authenticate_as(:'learner');
select throws_ok(
  format(
    $$insert into public.item_state (user_id, item_id, track_id, item_type, status, introduced_on)
      values (%L, 'dsa:p5001', 'dsa', 'problem', 'ok', '2026-09-20')$$,
    :'cap'
  ),
  '42501', 'new row violates row-level security policy for table "item_state"',
  'a row for another user (at the cap) is left to RLS'
);
select tests.authenticate_as(:'pending');
select throws_ok(
  $$insert into public.item_state (user_id, item_id, track_id, item_type, status, introduced_on)
    values (auth.uid(), 'dsa:two-sum', 'dsa', 'problem', 'ok', '2026-09-20')$$,
  '42501', 'new row violates row-level security policy for table "item_state"',
  'a pending user cannot insert an item_state row'
);
select tests.authenticate_as_service_role();
select lives_ok(
  format(
    $$insert into public.item_state (user_id, item_id, track_id, item_type, status, introduced_on)
      values (%L, 'dsa:p5001', 'dsa', 'problem', 'ok', '2026-09-20')$$,
    :'cap'
  ),
  'service_role is not bounded (the 5001st row)'
);
select tests.clear_authentication();

-- daily_activity: a new row only within one day of the user's local day. The row an upsert would
-- update is not new (decision 11, ruling M4-R13): an edited check-in recomputes an older day.
select tests.authenticate_as(:'learner');
select throws_ok(
  $$insert into public.daily_activity (user_id, local_day)
    values (auth.uid(), public.user_local_day(auth.uid(), now()) - 2)$$,
  'P0001', 'invalid_local_day', 'a daily_activity row two days back raises invalid_local_day'
);
select throws_ok(
  $$insert into public.daily_activity (user_id, local_day)
    values (auth.uid(), public.user_local_day(auth.uid(), now()) + 2)$$,
  'P0001', 'invalid_local_day', '... and two days ahead'
);
select lives_ok(
  $$insert into public.daily_activity (user_id, local_day)
    values (auth.uid(), public.user_local_day(auth.uid(), now()))$$,
  'today is allowed'
);
select lives_ok(
  $$insert into public.daily_activity (user_id, local_day)
    values (auth.uid(), public.user_local_day(auth.uid(), now()) - 1)$$,
  'yesterday is allowed'
);
select lives_ok(
  $$insert into public.daily_activity (user_id, local_day)
    values (auth.uid(), public.user_local_day(auth.uid(), now()) + 1)$$,
  'tomorrow is allowed (a day start ahead of the server''s view)'
);
select throws_ok(
  $$insert into public.daily_activity (user_id, local_day)
    values (auth.uid(), public.user_local_day(auth.uid(), now()) - 3)
    on conflict (user_id, local_day) do nothing$$,
  'P0001', 'invalid_local_day', 'a new row three days back raises invalid_local_day, upsert or not'
);
select tests.clear_authentication();
insert into public.daily_activity (user_id, local_day)
values (:'learner', public.user_local_day(:'learner', now()) - 3);
select tests.authenticate_as(:'learner');
select lives_ok(
  $$insert into public.daily_activity (user_id, local_day)
    values (auth.uid(), public.user_local_day(auth.uid(), now()) - 3)
    on conflict (user_id, local_day) do nothing$$,
  'once that row exists, the insert half of an upsert of it is not bounded (do nothing)'
);
select lives_ok(
  $$insert into public.daily_activity (user_id, local_day, items_done)
    values (auth.uid(), public.user_local_day(auth.uid(), now()) - 3, 3)
    on conflict (user_id, local_day) do update set items_done = excluded.items_done$$,
  '... nor is an upsert that updates it'
);
select is(
  (select items_done from public.daily_activity
    where local_day = public.user_local_day(auth.uid(), now()) - 3),
  3,
  '... which changes the row'
);
select throws_ok(
  format(
    $$insert into public.daily_activity (user_id, local_day) values (%L, '2000-01-03')$$,
    :'other'
  ),
  '42501', 'new row violates row-level security policy for table "daily_activity"',
  'a row for another user is left to RLS'
);
select tests.authenticate_as_service_role();
select lives_ok(
  format(
    $$insert into public.daily_activity (user_id, local_day) values (%L, '2000-01-04')$$,
    :'learner'
  ),
  'service_role is not bounded (any local_day)'
);
select tests.clear_authentication();

-- plan_block_state: only for a block the user's own plan lists.
select tests.authenticate_as(:'learner');
select throws_ok(
  $$insert into public.plan_block_state
      (plan_id, block_id, user_id, track_id, status, minutes, checked_in_on)
    values ('70000000-0000-4000-8000-000000000001', '2026-09-25:dsa:recap:1', auth.uid(), 'dsa',
            'done', 10, '2026-09-25')$$,
  'P0001', 'unknown_block', 'a block id the plan does not list raises unknown_block'
);
select throws_ok(
  $$insert into public.plan_block_state
      (plan_id, block_id, user_id, track_id, status, minutes, checked_in_on)
    values ('70000000-0000-4000-8000-000000000003', '2026-09-25:dsa:review:1', auth.uid(), 'dsa',
            'done', 10, '2026-09-25')$$,
  'P0001', 'unknown_block',
  '... and so does a block another user''s plan lists (only the ownership check rejects it)'
);
select lives_ok(
  $$insert into public.plan_block_state
      (plan_id, block_id, user_id, track_id, status, minutes, checked_in_on)
    values ('70000000-0000-4000-8000-000000000001', '2026-09-25:dsa:new:1', auth.uid(), 'dsa',
            'partial', 15, '2026-09-25')$$,
  'a block the learner''s own plan lists is accepted'
);
select results_eq(
  $$select version, rules_version, auto from public.plan_block_state
    where block_id = '2026-09-25:dsa:new:1'$$,
  $$values (1, 3, false)$$,
  '... with version 1, rules_version 3 and auto false by default'
);
select throws_ok(
  format(
    $$insert into public.plan_block_state
        (plan_id, block_id, user_id, track_id, status, minutes, checked_in_on)
      values ('70000000-0000-4000-8000-000000000003', '2026-09-25:dsa:review:2', %L, 'dsa',
              'done', 10, '2026-09-25')$$,
    :'other'
  ),
  '42501', 'new row violates row-level security policy for table "plan_block_state"',
  'a row for another user is left to RLS'
);
select tests.authenticate_as_service_role();
select lives_ok(
  format(
    $$insert into public.plan_block_state
        (plan_id, block_id, user_id, track_id, status, minutes, checked_in_on)
      values ('70000000-0000-4000-8000-000000000001', '2026-09-25:dsa:recap:1', %L, 'dsa',
              'done', 10, '2026-09-25')$$,
    :'learner'
  ),
  'service_role is not bounded (a block id the plan does not list)'
);
select tests.clear_authentication();

-- Column grants: a learner cannot move a row out of its bounds by an update of a key column.
select tests.authenticate_as(:'learner');
select throws_ok(
  $$update public.daily_activity set local_day = local_day - 1$$,
  '42501', 'permission denied for table daily_activity',
  'a learner cannot update daily_activity.local_day'
);
select throws_ok(
  $$update public.plan_block_state set block_id = '2026-09-25:dsa:recap:1'$$,
  '42501', 'permission denied for table plan_block_state',
  '... nor plan_block_state.block_id'
);
select throws_ok(
  $$update public.plan_block_state set plan_id = '70000000-0000-4000-8000-000000000002'$$,
  '42501', 'permission denied for table plan_block_state',
  '... nor plan_block_state.plan_id'
);
select throws_ok(
  $$update public.item_state set item_id = 'dsa:p1'$$,
  '42501', 'permission denied for table item_state',
  '... nor item_state.item_id'
);
select throws_ok(
  format($$update public.item_state set user_id = %L$$, :'cap'),
  '42501', 'permission denied for table item_state',
  '... nor item_state.user_id'
);
select lives_ok(
  $$update public.item_state set due_on = '2026-10-01', version = version + 1
    where item_id = 'dsa:two-sum'$$,
  'a learner updates item_state.due_on'
);
select results_eq(
  $$select due_on, version from public.item_state where item_id = 'dsa:two-sum'$$,
  $$values ('2026-10-01'::date, 2)$$,
  '... and the row changes'
);
select lives_ok(
  $$delete from public.item_state where item_id = 'dsa:two-sum'$$,
  'a learner deletes their own item_state row (track.reset)'
);
select tests.clear_authentication();
select results_eq(
  $$select user_id from public.item_state where item_id = 'dsa:two-sum'$$,
  format($$values (%L::uuid)$$, :'other'),
  '... which leaves the other user''s row alone'
);

-- ---------------------------------------------------------------------------------------------
-- 6b. plan_lock_key (decision 33): one key per (user, plan_date), whatever the session's DateStyle
--     (ruling M4-R12: every caller must take the same lock, and the function is IMMUTABLE).
-- ---------------------------------------------------------------------------------------------
select public.plan_lock_key(:'learner', date '2026-09-25') as lock_key_iso \gset
set local datestyle = 'SQL, DMY';
select is(
  public.plan_lock_key(:'learner', date '2026-09-25'),
  :'lock_key_iso'::bigint,
  'plan_lock_key gives the same key under DateStyle ISO and SQL, DMY'
);
reset datestyle;
select isnt(
  public.plan_lock_key(:'learner', '2026-09-25'),
  public.plan_lock_key(:'learner', '2026-09-26'),
  '... differs for another day'
);
select isnt(
  public.plan_lock_key(:'learner', '2026-09-25'),
  public.plan_lock_key(:'other', '2026-09-25'),
  '... and for another user'
);
select results_eq(
  $$select p.proname::text collate "default", r.rolname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    cross join (values ('anon'::text), ('authenticated'), ('service_role')) as r (rolname)
    where n.nspname = 'public'
      and p.proname in ('mark_plan_seen', 'plan_lock_key', 'day_plans_reject_delete',
                        'item_state_limit_rows', 'daily_activity_window',
                        'plan_block_state_known_block', 'events_prepare')
      and has_function_privilege(r.rolname, p.oid, 'EXECUTE')
    order by 1, 2$$,
  $$values ('mark_plan_seen'::text, 'authenticated'::text),
           ('plan_lock_key', 'authenticated'),
           ('plan_lock_key', 'service_role')$$,
  'the complete EXECUTE grants of this task''s functions (trigger functions: none)'
);

-- ---------------------------------------------------------------------------------------------
-- 7. Account deletion (§4.6) removes the user's plans, block states, item states, daily activity
--    and the events that name a plan — the events cascade is a delete, never an update, so
--    events_are_append_only does not fire.
-- ---------------------------------------------------------------------------------------------
insert into public.plan_block_state
  (plan_id, block_id, user_id, track_id, status, minutes, checked_in_on) values
  ('70000000-0000-4000-8000-000000000004', '2026-09-25:dsa:review:1', :'deleted', 'dsa', 'done',
   20, '2026-09-25');
insert into public.item_state (user_id, item_id, track_id, item_type, status, introduced_on)
values (:'deleted', 'dsa:two-sum', 'dsa', 'problem', 'ok', '2026-09-20');
insert into public.daily_activity (user_id, local_day) values (:'deleted', '2026-09-25');
insert into public.events (id, user_id, source, type, plan_id, payload) values
  ('70000000-0000-4000-8000-000000000121', :'deleted', 'system', 'plan.generated',
   '70000000-0000-4000-8000-000000000004', '{"mode": "baseline", "planVersion": 1}');
select tests.authenticate_as(:'deleted');
insert into public.events (id, user_id, type, plan_id, block_id)
values ('70000000-0000-4000-8000-000000000122', auth.uid(), 'block.checked_in',
        '70000000-0000-4000-8000-000000000004', '2026-09-25:dsa:review:1');
select tests.clear_authentication();
select is(
  (select count(*)::int from public.events where plan_id = '70000000-0000-4000-8000-000000000004'),
  2,
  'the user to delete has a system and a learner event naming their plan'
);
select lives_ok(
  format($$delete from auth.users where id = %L$$, :'deleted'),
  'deleting the account raises no error'
);
select results_eq(
  format(
    $$select
        (select count(*)::int from public.day_plans where user_id = %1$L),
        (select count(*)::int from public.plan_block_state where user_id = %1$L),
        (select count(*)::int from public.item_state where user_id = %1$L),
        (select count(*)::int from public.daily_activity where user_id = %1$L),
        (select count(*)::int from public.events
          where plan_id = '70000000-0000-4000-8000-000000000004')$$,
    :'deleted'
  ),
  $$values (0, 0, 0, 0, 0)$$,
  '... and removes their plans, block states, item states, daily activity and plan events'
);

-- ---------------------------------------------------------------------------------------------
-- 8. user_tracks.reset_on (decision 9, set by track.reset in 4.9b) and the new indexes.
-- ---------------------------------------------------------------------------------------------
select has_column('public', 'user_tracks', 'reset_on', 'user_tracks.reset_on exists');
select col_type_is('public', 'user_tracks', 'reset_on', 'date', '... is a date');
select col_hasnt_default('public', 'user_tracks', 'reset_on', '... with no default');
insert into public.user_tracks (user_id, track_id, roadmap_variant, start_date, budget_minutes)
values (:'learner', 'dsa', '10w', '2026-09-25', 60);
select is(
  (select reset_on from public.user_tracks where user_id = :'learner' and track_id = 'dsa'),
  null,
  '... so a new enrollment has reset_on null'
);
select has_index(
  'public', 'item_state', 'item_state_user_due_idx', array['user_id', 'due_on'],
  'item_state has the (user_id, due_on) index'
);
select has_index(
  'public', 'plan_block_state', 'plan_block_state_user_day_idx', array['user_id', 'checked_in_on'],
  'plan_block_state has the (user_id, checked_in_on) index (RLS, account deletion, per-day recompute)'
);

-- ---------------------------------------------------------------------------------------------
-- 9. Plans are permanent (decision 35): a direct delete fails for every role, because the
--    events that name a plan would cascade with it; only the account-deletion cascade (which
--    reaches the trigger from the foreign-key trigger, one level deeper) removes plans.
-- ---------------------------------------------------------------------------------------------
insert into public.plan_block_state
  (plan_id, block_id, user_id, track_id, status, minutes, checked_in_on) values
  ('70000000-0000-4000-8000-000000000005', '2026-09-25:dsa:review:1', :'permanent', 'dsa', 'done',
   20, '2026-09-25');
insert into public.events (id, user_id, source, type, plan_id, payload) values
  ('70000000-0000-4000-8000-000000000131', :'permanent', 'system', 'plan.generated',
   '70000000-0000-4000-8000-000000000005', '{"mode": "baseline", "planVersion": 1}');
select tests.authenticate_as(:'permanent');
insert into public.events (id, user_id, type, plan_id, block_id)
values ('70000000-0000-4000-8000-000000000132', auth.uid(), 'block.checked_in',
        '70000000-0000-4000-8000-000000000005', '2026-09-25:dsa:review:1');
select tests.authenticate_as_service_role();
select throws_ok(
  $$delete from public.day_plans where id = '70000000-0000-4000-8000-000000000005'$$,
  'P0001', 'plans_are_permanent', 'service_role cannot delete a plan'
);
select tests.clear_authentication();
select throws_ok(
  $$delete from public.day_plans where id = '70000000-0000-4000-8000-000000000005'$$,
  'P0001', 'plans_are_permanent', '... nor can postgres'
);
select results_eq(
  $$select
      (select count(*)::int from public.day_plans
        where id = '70000000-0000-4000-8000-000000000005'),
      (select count(*)::int from public.plan_block_state
        where plan_id = '70000000-0000-4000-8000-000000000005'),
      (select count(*)::int from public.events
        where plan_id = '70000000-0000-4000-8000-000000000005')$$,
  $$values (1, 1, 2)$$,
  '... and the plan, its block state and both events that name it are intact'
);
select lives_ok(
  format($$delete from auth.users where id = %L$$, :'permanent'),
  'account deletion still removes the user''s plans, with no error'
);
select results_eq(
  $$select
      (select count(*)::int from public.day_plans
        where id = '70000000-0000-4000-8000-000000000005'),
      (select count(*)::int from public.plan_block_state
        where plan_id = '70000000-0000-4000-8000-000000000005'),
      (select count(*)::int from public.events
        where plan_id = '70000000-0000-4000-8000-000000000005')$$,
  $$values (0, 0, 0)$$,
  '... with their block states and the events that name them'
);

select * from finish();
rollback;
