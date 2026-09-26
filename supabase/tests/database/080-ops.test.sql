begin;
set client_min_messages = warning;
create extension if not exists pgtap with schema extensions;
\ir _helpers.psql

select plan(50);

-- Task 5.7a: ops_metrics, the maintenance functions, health() and the backup_reader role
-- (platform design §2.3, §4.2, §4.5, §8.4 items 3 and 5; implementation plan Part B-M5
-- decision 26; ADR-0034). The maintenance cron calls the ops_* functions with the secret key
-- (service_role); /api/health calls health() with the publishable key and no session (anon).

select tests.create_user('ops-admin@hocdeu.test', 'active', 'admin') as admin \gset
select tests.create_user('ops-suspended-admin@hocdeu.test', 'suspended', 'admin') as suspended_admin \gset
select tests.create_user('ops-learner@hocdeu.test') as learner \gset
select tests.create_user('ops-other@hocdeu.test') as other \gset

-- Runs p_sql as backup_reader, then returns to postgres. Returns the first column of the first
-- row as text, or 'ERROR <sqlstate>: <message>' when the statement fails. pgTAP's functions live
-- in `extensions`, where backup_reader has no USAGE, so the assertions run as postgres. The
-- membership that lets postgres SET ROLE is granted below and rolled back with the test.
create function tests.as_backup_reader(p_sql text) returns text language plpgsql as $$
declare
  v_result text;
begin
  execute 'set local role backup_reader';
  begin
    execute p_sql into v_result;
  exception when others then
    v_result := format('ERROR %s: %s', sqlstate, sqlerrm);
  end;
  execute 'set local role none';
  return v_result;
end $$;

-- A clean slate for the exact counts below (seed.sql writes no ops rows; rolled back anyway).
delete from public.ops_metrics;
delete from public.event_quota;

-- ---------------------------------------------------------------------------------------------
-- 1. ops_metrics (§4.2): admin only; the key is one of four; RLS on, one select policy.
-- ---------------------------------------------------------------------------------------------

select has_table('public', 'ops_metrics', 'ops_metrics exists');
select columns_are(
  'public', 'ops_metrics', array['id', 'key', 'value', 'recorded_at'],
  'ops_metrics has id, key, value and recorded_at'
);
select is(
  (select attidentity::text from pg_attribute
   where attrelid = 'public.ops_metrics'::regclass and attname = 'id'),
  'a',
  'ops_metrics.id is generated always as identity'
);
select col_is_pk('public', 'ops_metrics', 'id', 'ops_metrics.id is the primary key');
select is(
  (select indexdef from pg_indexes
   where schemaname = 'public' and indexname = 'ops_metrics_key_recorded_idx'),
  'CREATE INDEX ops_metrics_key_recorded_idx ON public.ops_metrics USING btree (key, recorded_at DESC)',
  'ops_metrics is indexed by (key, recorded_at desc)'
);
select throws_ok(
  $$insert into public.ops_metrics (key, value) values ('db.size', 1)$$,
  '23514', null,
  'the table rejects a key outside the four metric keys'
);
select lives_ok(
  $$insert into public.ops_metrics (key, value) values
      ('db.size_bytes', 1), ('backup.last_success_at', 2), ('restore_test.last_success_at', 3),
      ('cron.last_run_at', 4)$$,
  'the table accepts the four metric keys'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.ops_metrics'::regclass),
  'ops_metrics has row level security on'
);
select policies_are(
  'public', 'ops_metrics', array['ops_metrics_select_admin'],
  'ops_metrics has only the admin select policy'
);
select policy_cmd_is(
  'public', 'ops_metrics', 'ops_metrics_select_admin', 'select',
  'ops_metrics_select_admin is a select policy'
);
select policy_roles_are(
  'public', 'ops_metrics', 'ops_metrics_select_admin', array['authenticated'],
  'ops_metrics_select_admin applies to authenticated'
);
select table_privs_are(
  'public', 'ops_metrics', 'authenticated', array['SELECT'],
  'authenticated may only select ops_metrics'
);
select table_privs_are(
  'public', 'ops_metrics', 'anon', array[]::text[], 'anon has no privilege on ops_metrics'
);

-- ---------------------------------------------------------------------------------------------
-- 2. A learner cannot read or write ops_metrics; an active admin can read it (and not write).
-- ---------------------------------------------------------------------------------------------

select tests.authenticate_as(:'learner');
select is_empty('select id from public.ops_metrics', 'a learner reads no ops_metrics row');
select throws_ok(
  $$insert into public.ops_metrics (key, value) values ('db.size_bytes', 1)$$,
  '42501', 'permission denied for table ops_metrics', 'a learner cannot insert into ops_metrics'
);
select throws_ok(
  'update public.ops_metrics set value = 0',
  '42501', 'permission denied for table ops_metrics', 'a learner cannot update ops_metrics'
);
select throws_ok(
  'delete from public.ops_metrics',
  '42501', 'permission denied for table ops_metrics', 'a learner cannot delete from ops_metrics'
);

select tests.authenticate_as(:'admin');
select results_eq(
  'select key, value from public.ops_metrics order by value',
  $$values ('db.size_bytes'::text, 1::numeric), ('backup.last_success_at', 2),
           ('restore_test.last_success_at', 3), ('cron.last_run_at', 4)$$,
  'an active admin reads every ops_metrics row'
);
select throws_ok(
  $$insert into public.ops_metrics (key, value) values ('db.size_bytes', 1)$$,
  '42501', 'permission denied for table ops_metrics', 'an admin cannot insert into ops_metrics'
);

select tests.authenticate_as(:'suspended_admin');
select is_empty('select id from public.ops_metrics', 'a suspended admin reads no ops_metrics row');
select tests.clear_authentication();

-- ---------------------------------------------------------------------------------------------
-- 3. Function privileges: the three ops functions run for service_role only (SECURITY DEFINER);
--    health() for anon and authenticated (SECURITY INVOKER).
-- ---------------------------------------------------------------------------------------------

select results_eq(
  $$select p.proname::text collate "default", r.rolname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    cross join (values ('anon'::text), ('authenticated'), ('service_role')) as r (rolname)
    where n.nspname = 'public'
      and p.proname in ('ops_record_metric', 'ops_record_db_size', 'ops_prune', 'health')
      and has_function_privilege(r.rolname, p.oid, 'EXECUTE')
    order by 1, 2$$,
  $$values ('health'::text, 'anon'::text),
           ('health', 'authenticated'),
           ('ops_prune', 'service_role'),
           ('ops_record_db_size', 'service_role'),
           ('ops_record_metric', 'service_role')$$,
  'the complete EXECUTE grants of the ops functions and health()'
);
select results_eq(
  $$select p.proname::text collate "default", p.prosecdef
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('ops_record_metric', 'ops_record_db_size', 'ops_prune', 'health')
    order by 1$$,
  $$values ('health'::text, false), ('ops_prune', true), ('ops_record_db_size', true),
           ('ops_record_metric', true)$$,
  'the ops functions are SECURITY DEFINER, health() is SECURITY INVOKER (one overload each)'
);

select tests.authenticate_as(:'learner');
select throws_ok(
  $$select public.ops_record_metric('db.size_bytes', 1)$$,
  '42501', 'permission denied for function ops_record_metric',
  'a learner cannot call ops_record_metric'
);
select tests.authenticate_as(:'admin');
select throws_ok(
  'select public.ops_prune()',
  '42501', 'permission denied for function ops_prune', 'an admin cannot call ops_prune either'
);
select tests.clear_authentication();
set local role anon;
select throws_ok(
  'select public.ops_record_db_size()',
  '42501', 'permission denied for function ops_record_db_size',
  'anon cannot call ops_record_db_size'
);
select tests.clear_authentication();

-- ---------------------------------------------------------------------------------------------
-- 4. ops_record_metric and ops_record_db_size (service_role).
-- ---------------------------------------------------------------------------------------------

delete from public.ops_metrics;
select tests.authenticate_as_service_role();
select lives_ok(
  $$select public.ops_record_metric('backup.last_success_at', 1790000000)$$,
  'service_role records a metric'
);
select throws_ok(
  $$select public.ops_record_metric('backup.last_failure_at', 1)$$,
  '23514', null,
  'an unknown metric key is an error'
);
select throws_ok(
  $$select public.ops_record_metric('cron.last_run_at', null)$$,
  '23502', null,
  'a null value is an error'
);
select public.ops_record_db_size() as db_size \gset
select tests.clear_authentication();
select results_eq(
  'select key, value, recorded_at from public.ops_metrics order by id',
  format(
    $$values ('backup.last_success_at'::text, 1790000000::numeric, now()),
             ('db.size_bytes', %s::numeric, now())$$,
    :'db_size'
  ),
  'ops_record_metric and ops_record_db_size each add one row, recorded now'
);
select ok(:'db_size'::bigint > 0, 'ops_record_db_size returns the (positive) size it records');

-- ---------------------------------------------------------------------------------------------
-- 5. ops_prune: event_quota rows with local_day < current_date - 2 and ops_metrics rows older
--    than 400 days; returns both counts; a second run deletes nothing.
-- ---------------------------------------------------------------------------------------------

delete from public.ops_metrics;
insert into public.event_quota (user_id, local_day, count) values
  (:'learner', current_date, 5),
  (:'learner', current_date - 1, 7),
  (:'learner', current_date - 2, 1),
  (:'learner', current_date - 3, 9),
  (:'other', current_date - 30, 2);
insert into public.ops_metrics (key, value, recorded_at) values
  ('db.size_bytes', 1, now() - interval '401 days'),
  ('db.size_bytes', 2, now() - interval '399 days'),
  ('cron.last_run_at', 3, now());

select tests.authenticate_as_service_role();
select is(
  public.ops_prune(),
  '{"event_quota": 2, "ops_metrics": 1}'::jsonb,
  'ops_prune deletes the 3- and 30-day-old quota rows and the 401-day-old metric'
);
select tests.clear_authentication();
select results_eq(
  'select user_id, local_day from public.event_quota order by local_day desc',
  format(
    $$values (%1$L::uuid, current_date), (%1$L::uuid, current_date - 1),
             (%1$L::uuid, current_date - 2)$$,
    :'learner'
  ),
  '... and keeps today''s, yesterday''s and the day before''s quota rows'
);
select results_eq(
  'select value from public.ops_metrics order by value',
  $$values (2::numeric), (3::numeric)$$,
  '... and the metrics of the last 400 days'
);
select tests.authenticate_as_service_role();
select is(
  public.ops_prune(),
  '{"event_quota": 0, "ops_metrics": 0}'::jsonb,
  'running ops_prune again deletes nothing'
);
select tests.clear_authentication();
select is(
  (select count(*) from public.event_quota), 3::bigint, '... and leaves the quota rows alone'
);

-- ---------------------------------------------------------------------------------------------
-- 6. health(): the cheap query of /api/health, for anon (the publishable key, no session).
-- ---------------------------------------------------------------------------------------------

select set_config('request.jwt.claims', '{"role": "anon"}', true);
set local role anon;
select is(public.health(), true, 'anon calls health()');
select tests.clear_authentication();
select tests.authenticate_as(:'learner');
select is(public.health(), true, 'authenticated calls health()');
select tests.clear_authentication();

-- ---------------------------------------------------------------------------------------------
-- 7. backup_reader (5.7b's pg_dump role): no login from the migration, BYPASSRLS, SELECT on
--    every public table but event_quota and on every sequence, nothing else.
-- ---------------------------------------------------------------------------------------------

select results_eq(
  $$select rolbypassrls, rolsuper, rolcreaterole, rolcreatedb, rolreplication, rolinherit
    from pg_roles where rolname = 'backup_reader'$$,
  $$values (true, false, false, false, false, true)$$,
  'backup_reader exists with BYPASSRLS and no other power'
);
select ok(
  has_schema_privilege('backup_reader', 'public', 'USAGE'),
  'backup_reader has USAGE on schema public'
);
select ok(
  not has_schema_privilege('backup_reader', 'auth', 'USAGE'),
  'the migration grants backup_reader nothing on schema auth (5.7b''s runbook does)'
);

-- Rows of two users in profiles (created above), events and day_plans. RLS lets `authenticated`
-- see only its own rows, so a count below 2 would mean RLS still filters backup_reader.
insert into public.events (id, user_id, source, type) values
  ('80000000-0000-4000-8000-000000000001', :'learner', 'system', 'onboarding.completed'),
  ('80000000-0000-4000-8000-000000000002', :'other', 'system', 'onboarding.completed');
insert into public.day_plans (user_id, plan_date, blocks) values
  (:'learner', current_date, '[]'), (:'other', current_date, '[]');
insert into public.ops_metrics (key, value) values ('cron.last_run_at', 5);
grant backup_reader to postgres;

select is(
  tests.as_backup_reader(format(
    'select count(*) from public.profiles where id in (%L, %L)', :'learner', :'other'
  )),
  '2',
  'backup_reader reads both users'' profiles'
);
select is(
  tests.as_backup_reader(format(
    'select count(distinct user_id) from public.events where user_id in (%L, %L)',
    :'learner', :'other'
  )),
  '2',
  'backup_reader reads both users'' events'
);
select is(
  tests.as_backup_reader(format(
    'select count(distinct user_id) from public.day_plans where user_id in (%L, %L)',
    :'learner', :'other'
  )),
  '2',
  'backup_reader reads both users'' day_plans'
);
select is(
  tests.as_backup_reader('select count(*) from public.ops_metrics'),
  '3',
  'backup_reader reads ops_metrics past its admin-only policy'
);
select matches(
  tests.as_backup_reader($$select last_value from public.ops_metrics_id_seq$$),
  '^[0-9]+$',
  'backup_reader reads the ops_metrics identity sequence (pg_dump emits its setval)'
);
select is(
  tests.as_backup_reader('select count(*) from public.event_quota'),
  'ERROR 42501: permission denied for table event_quota',
  'backup_reader cannot read event_quota'
);
select is(
  tests.as_backup_reader(
    $$insert into public.ops_metrics (key, value) values ('db.size_bytes', 1) returning 1$$
  ),
  'ERROR 42501: permission denied for table ops_metrics',
  'backup_reader cannot insert into ops_metrics'
);
select is(
  tests.as_backup_reader(format(
    $$insert into public.day_plans (user_id, plan_date, blocks, rules_version)
      values (%L, current_date + 1, '[]', 1) returning 1$$,
    :'learner'
  )),
  'ERROR 42501: permission denied for table day_plans',
  'backup_reader cannot insert into day_plans (rules_version given: its default needs EXECUTE)'
);
select is(
  tests.as_backup_reader($$update public.profiles set display_name = 'x' returning 1$$),
  'ERROR 42501: permission denied for table profiles',
  'backup_reader cannot update profiles'
);
select is(
  tests.as_backup_reader('select public.ops_prune()::text'),
  'ERROR 42501: permission denied for function ops_prune',
  'backup_reader cannot call ops_prune'
);

select * from finish();
rollback;
