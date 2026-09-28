begin;
set client_min_messages = warning;
create extension if not exists pgtap with schema extensions;
\ir _helpers.psql

select plan(113);

-- Task 6.2a: the bot tables, the per-user AI tables, content_publish_requests, day_plans' AI
-- columns and the ratelimit.fail_open metric with ops_bump_metric (platform design §4.1, §4.2,
-- §4.5, §4.6, §6.10; implementation plan Part B-M6 decisions 5, 18, 22).

select tests.create_user('bot-learner@hocdeu.test') as learner \gset
select tests.create_user('bot-other@hocdeu.test') as other \gset
select tests.create_user('bot-admin@hocdeu.test', 'active', 'admin') as admin \gset
select tests.create_user('bot-requester@hocdeu.test', 'active', 'admin') as requester \gset

-- anon: the publishable key without a session.
create function tests.authenticate_as_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role": "anon"}', true);
  execute 'set local role anon';
end $$;
grant execute on function tests.authenticate_as_anon() to anon, authenticated, service_role;

-- The learner's local day (default schedule), as YYYY-MM-DD text whatever DateStyle.
select to_char(public.user_local_day(:'learner', now()), 'YYYY-MM-DD') as today \gset
select to_char(public.user_local_day(:'learner', now()) - 1, 'YYYY-MM-DD') as yesterday \gset

-- ---------------------------------------------------------------------------------------------
-- 1. Shape: the six tables exist with RLS on, their policies and grants; day_plans' AI columns.
-- ---------------------------------------------------------------------------------------------
select has_table('public', 'bot_settings', 'bot_settings exists');
select has_table('public', 'bot_runs', 'bot_runs exists');
select has_table('public', 'bot_run_users', 'bot_run_users exists');
select has_table('public', 'user_items', 'user_items exists');
select has_table('public', 'roadmap_overrides', 'roadmap_overrides exists');
select has_table('public', 'content_publish_requests', 'content_publish_requests exists');
select bag_eq(
  $$select c.relname::text from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relrowsecurity
      and c.relname in ('bot_settings', 'bot_runs', 'bot_run_users', 'user_items',
                        'roadmap_overrides', 'content_publish_requests')$$,
  $$values ('bot_settings'), ('bot_runs'), ('bot_run_users'), ('user_items'),
           ('roadmap_overrides'), ('content_publish_requests')$$,
  'the six tables have row level security enabled'
);
select policies_are('public', 'bot_settings', array[]::name[], 'bot_settings has no policy');
select policies_are('public', 'bot_runs', array[]::name[], 'bot_runs has no policy');
select policies_are('public', 'bot_run_users', array[]::name[], 'bot_run_users has no policy');
select policies_are(
  'public', 'user_items', array['user_items_select_own'], 'user_items has only a select-own policy'
);
select policies_are(
  'public', 'roadmap_overrides', array['roadmap_overrides_select_own'],
  'roadmap_overrides has only a select-own policy'
);
select policies_are(
  'public', 'content_publish_requests', array['content_publish_requests_select_admin'],
  'content_publish_requests has only the admin select policy'
);
select table_privs_are(
  'public', 'user_items', 'authenticated', array['SELECT'], 'authenticated may only select user_items'
);
select table_privs_are(
  'public', 'roadmap_overrides', 'authenticated', array['SELECT'],
  'authenticated may only select roadmap_overrides'
);
select table_privs_are(
  'public', 'content_publish_requests', 'authenticated', array['SELECT'],
  'authenticated may only select content_publish_requests'
);
select table_privs_are(
  'public', 'bot_settings', 'authenticated', array[]::text[],
  'authenticated has no privilege on bot_settings'
);
select table_privs_are(
  'public', 'bot_runs', 'authenticated', array[]::text[], 'authenticated has no privilege on bot_runs'
);
select table_privs_are(
  'public', 'bot_run_users', 'authenticated', array[]::text[],
  'authenticated has no privilege on bot_run_users'
);
select is_empty(
  $$select c.relname from pg_class c
    where c.oid in ('public.bot_settings'::regclass, 'public.bot_runs'::regclass,
                    'public.bot_run_users'::regclass, 'public.user_items'::regclass,
                    'public.roadmap_overrides'::regclass,
                    'public.content_publish_requests'::regclass)
      and (has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
        or has_any_column_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,REFERENCES')
        or has_any_column_privilege('authenticated', c.oid, 'INSERT,UPDATE,REFERENCES'))$$,
  'anon has no privilege on the six tables; authenticated has no column write privilege'
);
select is_empty(
  $$select c.relname from pg_class c
    where c.oid in ('public.bot_settings'::regclass, 'public.bot_runs'::regclass,
                    'public.bot_run_users'::regclass, 'public.user_items'::regclass,
                    'public.roadmap_overrides'::regclass,
                    'public.content_publish_requests'::regclass)
      and not has_table_privilege('backup_reader', c.oid, 'SELECT')$$,
  'backup_reader can select every new table (the default privileges of 20260927000200)'
);
select has_column('public', 'day_plans', 'rationale', 'day_plans has rationale');
select has_column('public', 'day_plans', 'bot_run_id', 'day_plans has bot_run_id');
select fk_ok(
  'public', 'day_plans', 'bot_run_id', 'public', 'bot_runs', 'id',
  'day_plans.bot_run_id references bot_runs'
);

-- ---------------------------------------------------------------------------------------------
-- 2. bot_settings: one row, seeded off (decision 5: nothing turns on by merging).
-- ---------------------------------------------------------------------------------------------
select results_eq(
  $$select id, enabled, dry_run, content_proposals, per_run_user_cap, limits, token_hash,
           token_prev_hash, token_prev_valid_until, token_rotated_at, updated_by
      from public.bot_settings$$,
  $$values (true, false, true, false, 10, '{}'::jsonb, null::text, null::text,
            null::timestamptz, null::timestamptz, null::uuid)$$,
  'the seeded bot_settings row is off: disabled, dry-run, no content proposals, cap 10, no token'
);
select throws_ok(
  $$insert into public.bot_settings (id) values (true)$$,
  '23505', null, 'a second bot_settings row is refused (primary key)'
);
select throws_ok(
  $$insert into public.bot_settings (id) values (false)$$,
  '23514', null, '... and so is a row with id false (check)'
);
select throws_ok(
  $$update public.bot_settings set per_run_user_cap = 101$$,
  '23514', null, 'per_run_user_cap is at most 100'
);
select throws_ok(
  $$update public.bot_settings set token_hash = 'ABC'$$,
  '23514', null, 'token_hash is 64 lowercase hex characters'
);
select throws_ok(
  $$update public.bot_settings set limits = '[]'::jsonb$$,
  '23514', null, 'limits is an object'
);

-- ---------------------------------------------------------------------------------------------
-- 3. Fixtures (as postgres: the tables have no learner writes).
-- ---------------------------------------------------------------------------------------------
insert into public.bot_runs (id, run_key, kind, ops_date, mode) values
  ('90000000-0000-4000-8000-000000000001', 'run_2026-09-28', 'plan', '2026-09-28', 'dry_run'),
  ('90000000-0000-4000-8000-000000000002', 'run_2026-09-28_publish-1', 'publish', '2026-09-28',
   'live');
insert into public.bot_run_users (run_id, user_id, user_ref) values
  ('90000000-0000-4000-8000-000000000001', :'learner', 'u_abcdefghijklmnop'),
  ('90000000-0000-4000-8000-000000000001', :'other', 'u_234567abcdefghij');
insert into public.user_items
  (user_id, item_id, item_type, track_id, topic_id, payload, created_by_run, created_on) values
  (:'learner', 'user:0123456789abcdef:two-sum-recap', 'flashcard', 'dsa', 'arrays',
   '{"front": "a", "back": "b"}', 'run_2026-09-28', '2026-09-28'),
  (:'other', 'user:fedcba9876543210:stack-recap', 'prompt', 'dsa', 'stack', '{"text": "c"}',
   'run_2026-09-28', '2026-09-28');
insert into public.roadmap_overrides
  (user_id, track_id, key, kind, params, until_local_day, study_days, start_local_day,
   created_by_run) values
  (:'learner', 'dsa', 'recap-arrays', 'insert_block', '{"topicId": "arrays"}', '2026-10-05', null,
   '2026-09-28', 'run_2026-09-28'),
  (:'other', 'dsa', 'extra-week-1', 'extra_week', '{}', null, 5, '2026-09-28', 'run_2026-09-28');
insert into public.content_publish_requests (target, requested_by) values
  ('dsa:lc-0001', :'requester'),
  ('dsa:lc-0002#note', :'admin');

select results_eq(
  $$select status, created_at is not null from public.user_items order by item_id$$,
  $$values ('active'::text, true), ('active', true)$$,
  'user_items default to active'
);
select results_eq(
  $$select status, revoked_at from public.roadmap_overrides order by key$$,
  $$values ('active'::text, null::timestamptz), ('active', null)$$,
  'roadmap_overrides default to active, not revoked'
);
select results_eq(
  $$select status, users_eligible, users_deferred, finished_at from public.bot_runs order by run_key$$,
  $$values ('running'::text, 0, 0, null::timestamptz), ('running', 0, 0, null)$$,
  'bot_runs default to running with zero counts'
);
select results_eq(
  $$select outcome, writes, detail, processed_at from public.bot_run_users limit 1$$,
  $$values (null::text, '{}'::jsonb, null::jsonb, null::timestamptz)$$,
  'bot_run_users default to pending (outcome null) with empty writes'
);
select results_eq(
  $$select status, pr_url from public.content_publish_requests order by id$$,
  $$values ('pending'::text, null::text), ('pending', null)$$,
  'content_publish_requests default to pending without a PR'
);

-- ---------------------------------------------------------------------------------------------
-- 4. RLS: a learner reads only their own user_items / roadmap_overrides and writes none.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_as(:'learner');
select results_eq(
  $$select item_id from public.user_items$$,
  $$values ('user:0123456789abcdef:two-sum-recap'::text)$$,
  'a learner reads only their own user_items'
);
select results_eq(
  $$select key from public.roadmap_overrides$$,
  $$values ('recap-arrays'::text)$$,
  'a learner reads only their own roadmap_overrides'
);
select throws_ok(
  format(
    $$insert into public.user_items
        (user_id, item_id, item_type, track_id, topic_id, payload, created_by_run, created_on)
      values (%L, 'user:0123456789abcdef:mine', 'prompt', 'dsa', 'arrays', '{}',
              'run_2026-09-28', '2026-09-28')$$,
    :'learner'
  ),
  '42501', 'permission denied for table user_items', 'a learner cannot insert into user_items'
);
select throws_ok(
  $$update public.user_items set status = 'hidden'$$,
  '42501', 'permission denied for table user_items', 'a learner cannot update user_items'
);
select throws_ok(
  $$delete from public.user_items$$,
  '42501', 'permission denied for table user_items', 'a learner cannot delete from user_items'
);
select throws_ok(
  format(
    $$insert into public.roadmap_overrides
        (user_id, track_id, key, kind, params, start_local_day, created_by_run)
      values (%L, 'dsa', 'mine', 'reorder_topics', '{}', '2026-09-28', 'run_2026-09-28')$$,
    :'learner'
  ),
  '42501', 'permission denied for table roadmap_overrides',
  'a learner cannot insert into roadmap_overrides'
);
select throws_ok(
  $$update public.roadmap_overrides set status = 'revoked'$$,
  '42501', 'permission denied for table roadmap_overrides', 'a learner cannot update roadmap_overrides'
);
select throws_ok(
  $$delete from public.roadmap_overrides$$,
  '42501', 'permission denied for table roadmap_overrides',
  'a learner cannot delete from roadmap_overrides'
);
select is_empty(
  $$select id from public.content_publish_requests$$,
  'a learner reads no content_publish_requests'
);
select throws_ok(
  $$insert into public.content_publish_requests (target) values ('dsa:lc-0003')$$,
  '42501', 'permission denied for table content_publish_requests',
  'a learner cannot insert into content_publish_requests'
);
select throws_ok(
  $$select * from public.bot_settings$$,
  '42501', 'permission denied for table bot_settings', 'a learner cannot read bot_settings'
);
select throws_ok(
  $$select * from public.bot_runs$$,
  '42501', 'permission denied for table bot_runs', 'a learner cannot read bot_runs'
);
select throws_ok(
  $$select * from public.bot_run_users$$,
  '42501', 'permission denied for table bot_run_users', 'a learner cannot read bot_run_users'
);
-- A learner reads their own plan's AI columns (day_plans' table-level select).
select lives_ok(
  $$select rationale, bot_run_id from public.day_plans$$,
  'a learner may select day_plans.rationale and bot_run_id'
);

-- ---------------------------------------------------------------------------------------------
-- 5. An admin reads content_publish_requests and nothing of the bot tables; writes go through
--    6.2b's functions.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_as(:'admin');
select results_eq(
  $$select target from public.content_publish_requests order by id$$,
  $$values ('dsa:lc-0001'::text), ('dsa:lc-0002#note')$$,
  'an admin reads every content_publish_request'
);
select throws_ok(
  $$update public.content_publish_requests set status = 'cancelled'$$,
  '42501', 'permission denied for table content_publish_requests',
  'an admin cannot update content_publish_requests directly'
);
select throws_ok(
  $$select * from public.bot_settings$$,
  '42501', 'permission denied for table bot_settings', 'an admin cannot read bot_settings'
);
select throws_ok(
  $$select * from public.bot_runs$$,
  '42501', 'permission denied for table bot_runs', 'an admin cannot read bot_runs'
);
select throws_ok(
  $$select * from public.bot_run_users$$,
  '42501', 'permission denied for table bot_run_users', 'an admin cannot read bot_run_users'
);
select is_empty(
  $$select item_id from public.user_items$$, 'an admin reads no other user''s user_items'
);
select is_empty(
  $$select key from public.roadmap_overrides$$, 'an admin reads no other user''s roadmap_overrides'
);

-- ---------------------------------------------------------------------------------------------
-- 6. anon reads nothing anywhere.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_as_anon();
select throws_ok(
  $$select * from public.bot_settings$$,
  '42501', 'permission denied for table bot_settings', 'anon cannot read bot_settings'
);
select throws_ok(
  $$select * from public.bot_runs$$,
  '42501', 'permission denied for table bot_runs', 'anon cannot read bot_runs'
);
select throws_ok(
  $$select * from public.bot_run_users$$,
  '42501', 'permission denied for table bot_run_users', 'anon cannot read bot_run_users'
);
select throws_ok(
  $$select * from public.user_items$$,
  '42501', 'permission denied for table user_items', 'anon cannot read user_items'
);
select throws_ok(
  $$select * from public.roadmap_overrides$$,
  '42501', 'permission denied for table roadmap_overrides', 'anon cannot read roadmap_overrides'
);
select throws_ok(
  $$select * from public.content_publish_requests$$,
  '42501', 'permission denied for table content_publish_requests',
  'anon cannot read content_publish_requests'
);
select tests.clear_authentication();

-- ---------------------------------------------------------------------------------------------
-- 7. The checks.
-- ---------------------------------------------------------------------------------------------
-- bot_runs: the run key's two forms, and kind agrees with the form.
select lives_ok(
  $$insert into public.bot_runs (run_key, kind, ops_date, mode) values
      ('run_2026-09-29', 'plan', '2026-09-29', 'live'),
      ('run_2026-09-29_publish-999', 'publish', '2026-09-29', 'live')$$,
  'a run key run_<date> (plan) and run_<date>_publish-<n> (publish) are accepted'
);
select throws_ok(
  $$insert into public.bot_runs (run_key, kind, ops_date, mode)
    values ('run_2026-9-30', 'plan', '2026-09-30', 'live')$$,
  '23514', null, 'a run key with a one-digit month is refused'
);
select throws_ok(
  $$insert into public.bot_runs (run_key, kind, ops_date, mode)
    values ('run_2026-09-30_publish-0', 'publish', '2026-09-30', 'live')$$,
  '23514', null, 'a publish number 0 is refused'
);
select throws_ok(
  $$insert into public.bot_runs (run_key, kind, ops_date, mode)
    values ('run_2026-09-30_publish-1000', 'publish', '2026-09-30', 'live')$$,
  '23514', null, 'a publish number over 999 is refused'
);
select throws_ok(
  $$insert into public.bot_runs (run_key, kind, ops_date, mode)
    values ('run_2026-09-30', 'publish', '2026-09-30', 'live')$$,
  '23514', null, 'a publish run with a plan run key is refused'
);
select throws_ok(
  $$insert into public.bot_runs (run_key, kind, ops_date, mode)
    values ('run_2026-09-30_publish-2', 'plan', '2026-09-30', 'live')$$,
  '23514', null, 'a plan run with a publish run key is refused'
);
select throws_ok(
  $$insert into public.bot_runs (run_key, kind, ops_date, mode)
    values ('run_2026-09-28', 'plan', '2026-09-28', 'live')$$,
  '23505', null, 'a run key is unique'
);
select throws_ok(
  $$update public.bot_runs set content_pr_url = 'https://github.com/someone/else/pull/1'
    where run_key = 'run_2026-09-28_publish-1'$$,
  '23514', null, 'content_pr_url is a pull request of this repository'
);
select throws_ok(
  $$update public.bot_runs set failure_reason = repeat('x', 65) where run_key = 'run_2026-09-28'$$,
  '23514', null, 'failure_reason is at most 64 characters'
);
-- bot_run_users: the user ref's form; one row per user and per ref in a run.
select throws_ok(
  format(
    $$insert into public.bot_run_users (run_id, user_id, user_ref)
      values ('90000000-0000-4000-8000-000000000002', %L, 'u_ABCDEFGHIJKLMNOP')$$,
    :'learner'
  ),
  '23514', null, 'an upper-case user_ref is refused'
);
select throws_ok(
  format(
    $$insert into public.bot_run_users (run_id, user_id, user_ref)
      values ('90000000-0000-4000-8000-000000000002', %L, 'u_abcdefghijklmno1')$$,
    :'learner'
  ),
  '23514', null, 'a user_ref outside base32 (a 1) is refused'
);
select throws_ok(
  format(
    $$insert into public.bot_run_users (run_id, user_id, user_ref)
      values ('90000000-0000-4000-8000-000000000001', %L, 'u_zzzzzzzzzzzzzzzz')$$,
    :'learner'
  ),
  '23505', null, 'a second row for one user in a run is refused'
);
select throws_ok(
  format(
    $$insert into public.bot_run_users (run_id, user_id, user_ref)
      values ('90000000-0000-4000-8000-000000000001', %L, 'u_abcdefghijklmnop')$$,
    :'admin'
  ),
  '23505', null, 'a second row for one ref in a run is refused'
);
select throws_ok(
  $$update public.bot_run_users set outcome = 'done'$$,
  '23514', null, 'an unknown outcome is refused'
);
-- user_items: the item id's form and the payload's size.
select throws_ok(
  format(
    $$insert into public.user_items
        (user_id, item_id, item_type, track_id, topic_id, payload, created_by_run, created_on)
      values (%L, 'dsa:lc-0001', 'prompt', 'dsa', 'arrays', '{}', 'run_2026-09-28', '2026-09-28')$$,
    :'learner'
  ),
  '23514', null, 'an item_id not user:<16 hex>:<slug> is refused'
);
select throws_ok(
  format(
    $$insert into public.user_items
        (user_id, item_id, item_type, track_id, topic_id, payload, created_by_run, created_on)
      values (%L, 'user:0123456789abcdeg:recap', 'prompt', 'dsa', 'arrays', '{}',
              'run_2026-09-28', '2026-09-28')$$,
    :'learner'
  ),
  '23514', null, '... also with a non-hex bot ref'
);
select is(
  octet_length(jsonb_build_object('a', repeat('x', 2040))::text), 2049,
  'the payload fixture below is 2049 bytes'
);
select throws_ok(
  format(
    $$insert into public.user_items
        (user_id, item_id, item_type, track_id, topic_id, payload, created_by_run, created_on)
      values (%L, 'user:0123456789abcdef:big', 'prompt', 'dsa', 'arrays',
              jsonb_build_object('a', repeat('x', 2040)), 'run_2026-09-28', '2026-09-28')$$,
    :'learner'
  ),
  '23514', null, 'a 2049-byte payload is refused'
);
select lives_ok(
  format(
    $$insert into public.user_items
        (user_id, item_id, item_type, track_id, topic_id, payload, created_by_run, created_on)
      values (%L, 'user:0123456789abcdef:big', 'prompt', 'dsa', 'arrays',
              jsonb_build_object('a', repeat('x', 2039)), 'run_2026-09-28', '2026-09-28')$$,
    :'learner'
  ),
  '... a 2048-byte payload is accepted'
);
select throws_ok(
  format(
    $$insert into public.user_items
        (user_id, item_id, item_type, track_id, topic_id, payload, created_by_run, created_on)
      values (%L, 'user:0123456789abcdef:lesson', 'lesson', 'dsa', 'arrays', '{}',
              'run_2026-09-28', '2026-09-28')$$,
    :'learner'
  ),
  '23514', null, 'an item type other than flashcard, exercise or prompt is refused'
);
select throws_ok(
  $$update public.user_items set created_by_run = 'run_2026-09-28_publish-1'$$,
  '23514', null, 'created_by_run is a plan run key'
);
-- roadmap_overrides: kind and its expiry column agree; status never 'expired' (decision 18).
select throws_ok(
  format(
    $$insert into public.roadmap_overrides
        (user_id, track_id, key, kind, params, start_local_day, created_by_run)
      values (%L, 'dsa', 'recap-stack', 'insert_block', '{}', '2026-09-28', 'run_2026-09-28')$$,
    :'learner'
  ),
  '23514', null, 'an insert_block without until_local_day is refused'
);
select throws_ok(
  format(
    $$insert into public.roadmap_overrides
        (user_id, track_id, key, kind, params, until_local_day, start_local_day, created_by_run)
      values (%L, 'dsa', 'reorder-1', 'reorder_topics', '{}', '2026-10-01', '2026-09-28',
              'run_2026-09-28')$$,
    :'learner'
  ),
  '23514', null, '... and until_local_day on another kind'
);
select throws_ok(
  format(
    $$insert into public.roadmap_overrides
        (user_id, track_id, key, kind, params, study_days, start_local_day, created_by_run)
      values (%L, 'dsa', 'extra-week-2', 'extra_week', '{}', 6, '2026-09-28', 'run_2026-09-28')$$,
    :'learner'
  ),
  '23514', null, 'an extra_week of 6 study days is refused'
);
select throws_ok(
  format(
    $$insert into public.roadmap_overrides
        (user_id, track_id, key, kind, params, start_local_day, created_by_run)
      values (%L, 'dsa', 'extra-week-3', 'extra_week', '{}', '2026-09-28', 'run_2026-09-28')$$,
    :'learner'
  ),
  '23514', null, '... and one without study_days'
);
select throws_ok(
  $$update public.roadmap_overrides set status = 'expired' where key = 'recap-arrays'$$,
  '23514', null, 'status expired is refused (expiry is computed, decision 18)'
);
select lives_ok(
  $$update public.roadmap_overrides set status = 'suspended' where key = 'recap-arrays'$$,
  '... suspended is allowed'
);
select throws_ok(
  format(
    $$insert into public.roadmap_overrides
        (user_id, track_id, key, kind, params, until_local_day, start_local_day, created_by_run)
      values (%L, 'dsa', 'recap-arrays', 'insert_block', '{}', '2026-10-01', '2026-09-28',
              'run_2026-09-28')$$,
    :'learner'
  ),
  '23505', null, 'a key is unique per user and track'
);
-- content_publish_requests: one pending request per target; the target's form.
select throws_ok(
  $$insert into public.content_publish_requests (target) values ('dsa:lc-0001')$$,
  '23505', null, 'a second pending request for one target is refused'
);
update public.content_publish_requests set status = 'cancelled' where target = 'dsa:lc-0001';
select lives_ok(
  $$insert into public.content_publish_requests (target) values ('dsa:lc-0001')$$,
  '... and accepted once the first is no longer pending'
);
select throws_ok(
  $$insert into public.content_publish_requests (target) values ('DSA lc 1')$$,
  '23514', null, 'a malformed target is refused'
);
select throws_ok(
  $$insert into public.content_publish_requests (target) values ('dsa:lc-0009#other')$$,
  '23514', null, '... and so is a fragment other than #note'
);
-- day_plans.rationale: at most 280 characters.
insert into public.day_plans (id, user_id, plan_date, blocks, source, bot_run_id) values
  ('90000000-0000-4000-8000-0000000000a1', :'learner', :'today',
   '[{"id": "b1"}, {"id": "b2"}, {"id": "b3"}, {"id": "b4"}]', 'ai',
   '90000000-0000-4000-8000-000000000001');
select lives_ok(
  $$update public.day_plans set rationale = repeat('ô', 280)
    where id = '90000000-0000-4000-8000-0000000000a1'$$,
  'a 280-character rationale is accepted'
);
select throws_ok(
  $$update public.day_plans set rationale = repeat('ô', 281)
    where id = '90000000-0000-4000-8000-0000000000a1'$$,
  '23514', null, 'a 281-character rationale is refused'
);

-- ---------------------------------------------------------------------------------------------
-- 8. ops_metrics' ratelimit.fail_open and ops_bump_metric (decision 22): service_role only.
-- ---------------------------------------------------------------------------------------------
delete from public.ops_metrics where key = 'ratelimit.fail_open';
select tests.authenticate_as_service_role();
select is(public.ops_bump_metric('ratelimit.fail_open'), 1::numeric, 'the first bump of a day returns 1');
select is(public.ops_bump_metric('ratelimit.fail_open'), 2::numeric, '... the second returns 2');
select tests.clear_authentication();
select results_eq(
  $$select value from public.ops_metrics where key = 'ratelimit.fail_open'$$,
  $$values (2::numeric)$$,
  '... in one row'
);
-- A row of an earlier (UTC) day is not bumped: today's count starts again at 1.
update public.ops_metrics set recorded_at = date_trunc('day', now(), 'UTC') - interval '1 second'
where key = 'ratelimit.fail_open';
select tests.authenticate_as_service_role();
select is(
  public.ops_bump_metric('ratelimit.fail_open'), 1::numeric,
  'a bump after the UTC day start inserts a new row with 1'
);
select tests.clear_authentication();
select results_eq(
  $$select value from public.ops_metrics where key = 'ratelimit.fail_open' order by recorded_at$$,
  $$values (2::numeric), (1::numeric)$$,
  '... and leaves yesterday''s row as it was'
);
select throws_ok(
  $$select public.ops_bump_metric('no.such.key')$$,
  '23514', null, 'an unknown key is refused by the table check'
);
select tests.authenticate_as(:'learner');
select throws_ok(
  $$select public.ops_bump_metric('ratelimit.fail_open')$$,
  '42501', 'permission denied for function ops_bump_metric', 'a learner cannot call ops_bump_metric'
);
select tests.authenticate_as(:'admin');
select throws_ok(
  $$select public.ops_bump_metric('ratelimit.fail_open')$$,
  '42501', 'permission denied for function ops_bump_metric', '... nor can an admin'
);
select tests.authenticate_as_anon();
select throws_ok(
  $$select public.ops_bump_metric('ratelimit.fail_open')$$,
  '42501', 'permission denied for function ops_bump_metric', '... nor anon'
);
select tests.clear_authentication();
select ok(
  (select prosecdef and proconfig @> array['search_path=""']
   from pg_proc where oid = 'public.ops_bump_metric(text)'::regprocedure),
  'ops_bump_metric is SECURITY DEFINER with an empty search_path'
);

-- ---------------------------------------------------------------------------------------------
-- 9. Deletion cascade (§4.6): a user's bot_run_users, user_items and roadmap_overrides go; a
--     deleted requester's publish request stays with requested_by null; bot_runs stay.
-- ---------------------------------------------------------------------------------------------
delete from auth.users where id = :'learner';
delete from auth.users where id = :'requester';
select is(
  (select count(*)::int from public.bot_run_users where user_id = :'learner'), 0,
  'the deleted user''s bot_run_users rows are gone'
);
select is(
  (select count(*)::int from public.user_items where user_id = :'learner'), 0,
  '... their user_items'
);
select is(
  (select count(*)::int from public.roadmap_overrides where user_id = :'learner'), 0,
  '... and their roadmap_overrides'
);
select results_eq(
  $$select (select count(*)::int from public.bot_run_users),
           (select count(*)::int from public.user_items),
           (select count(*)::int from public.roadmap_overrides)$$,
  $$values (1, 1, 1)$$,
  'another user''s rows stay'
);
select results_eq(
  $$select target, requested_by from public.content_publish_requests
    where target = 'dsa:lc-0001' and status = 'cancelled'$$,
  $$values ('dsa:lc-0001'::text, null::uuid)$$,
  'a deleted requester''s publish request stays, requested_by null'
);
select is(
  (select count(*)::int from public.bot_runs where id = '90000000-0000-4000-8000-000000000001'), 1,
  'the run stays'
);
-- A run's deletion (never done, but the FK must not block it) nulls day_plans.bot_run_id.
insert into public.day_plans (id, user_id, plan_date, blocks, source, bot_run_id) values
  ('90000000-0000-4000-8000-0000000000a2', :'other', :'today', '[]', 'ai',
   '90000000-0000-4000-8000-000000000002');
delete from public.bot_runs where id = '90000000-0000-4000-8000-000000000002';
select is(
  (select bot_run_id from public.day_plans where id = '90000000-0000-4000-8000-0000000000a2'),
  null::uuid,
  'deleting a run nulls day_plans.bot_run_id'
);

select * from finish();
rollback;
