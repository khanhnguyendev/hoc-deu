begin;
set client_min_messages = warning;
create extension if not exists pgtap with schema extensions;
\ir _helpers.psql

select plan(43);

-- Task 6.2b: the bot's admin and run functions (platform design §2.3, §4.2, §4.3, §5.12,
-- §6.2–§6.4; implementation plan Part B-M6 decisions 8–11, 31, 33, 34): admin_bot_settings,
-- admin_update_bot_settings, admin_rotate_bot_token, admin_set_ai_flag, admin_list_users (with
-- ai_personalization), admin_bot_runs, bot_eligible_users, bot_timeout_runs, bot_record_write,
-- bot_prune_details and bot_track_positions.

-- The message a statement raises, or 'no error' (runs as the current role).
create function tests.err(p_sql text) returns text language plpgsql as $$
begin
  execute p_sql;
  return 'no error';
exception when others then
  return sqlerrm;
end $$;

-- anon: the publishable key without a session.
create function tests.authenticate_as_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role": "anon"}', true);
  execute 'set local role anon';
end $$;

grant execute on function tests.err(text), tests.authenticate_as_anon()
to anon, authenticated, service_role;

select tests.create_user('bot-fn-learner@hocdeu.test') as learner \gset
select tests.create_user('bot-fn-admin@hocdeu.test', 'active', 'admin') as admin \gset
select tests.create_user('bot-fn-target@hocdeu.test') as target \gset
select tests.create_user('bot-fn-pending@hocdeu.test', 'pending') as pending \gset
select to_char(public.user_local_day(:'target', now()), 'YYYY-MM-DD') as today \gset

-- ---------------------------------------------------------------------------------------------
-- 1. Who may call what: every admin_* function refuses a learner; the service_role functions
--    are the secret key's only.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_as(:'learner');
select results_eq(
  $$select tests.err(s.sql) from (values
      (1, 'select public.admin_bot_settings()'),
      (2, 'select public.admin_update_bot_settings(true, null, null, null, null)'),
      (3, 'select public.admin_rotate_bot_token(repeat(''a'', 64))'),
      (4, 'select public.admin_set_ai_flag(auth.uid(), true)'),
      (5, 'select * from public.admin_list_users()'),
      (6, 'select public.admin_bot_runs(10)')
    ) as s (n, sql) order by s.n$$,
  $$select 'forbidden'::text from generate_series(1, 6)$$,
  'every admin_* function refuses a learner with forbidden'
);
select tests.clear_authentication();

select results_eq(
  $$select f.name,
      array(select r from unnest(array['anon', 'authenticated', 'service_role']) as r
            where has_function_privilege(r, f.sig, 'EXECUTE'))
    from (values
      ('admin_bot_settings', 'public.admin_bot_settings()'),
      ('admin_update_bot_settings',
       'public.admin_update_bot_settings(boolean, boolean, boolean, integer, jsonb)'),
      ('admin_rotate_bot_token', 'public.admin_rotate_bot_token(text)'),
      ('admin_set_ai_flag', 'public.admin_set_ai_flag(uuid, boolean)'),
      ('admin_list_users', 'public.admin_list_users()'),
      ('admin_bot_runs', 'public.admin_bot_runs(integer)'),
      ('bot_eligible_users', 'public.bot_eligible_users()'),
      ('bot_timeout_runs', 'public.bot_timeout_runs()'),
      ('bot_record_write', 'public.bot_record_write(uuid, text, text, jsonb)'),
      ('bot_prune_details', 'public.bot_prune_details()'),
      ('bot_track_positions', 'public.bot_track_positions()'),
      ('roadmap_override_active',
       'public.roadmap_override_active(public.roadmap_overrides, date)')
    ) as f (name, sig)
    order by 1$$,
  $$values
    ('admin_bot_runs', '{authenticated}'::text[]),
    ('admin_bot_settings', '{authenticated}'),
    ('admin_list_users', '{authenticated}'),
    ('admin_rotate_bot_token', '{authenticated}'),
    ('admin_set_ai_flag', '{authenticated}'),
    ('admin_update_bot_settings', '{authenticated}'),
    ('bot_eligible_users', '{service_role}'),
    ('bot_prune_details', '{service_role}'),
    ('bot_record_write', '{service_role}'),
    ('bot_timeout_runs', '{service_role}'),
    ('bot_track_positions', '{service_role}'),
    ('roadmap_override_active', '{}')$$,
  'EXECUTE: the admin functions for authenticated, the bot functions for service_role, '
  'roadmap_override_active for nobody'
);

-- ---------------------------------------------------------------------------------------------
-- 2. Bot settings: read and update (no hash ever), token rotation (decisions 5, 7, 31).
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_as(:'admin');
select public.admin_bot_settings() as settings \gset
select is(
  array(select jsonb_object_keys(:'settings'::jsonb) order by 1),
  array['contentProposals', 'dryRun', 'enabled', 'hasToken', 'limits', 'perRunUserCap',
        'prevValidUntil', 'rotatedAt', 'updatedAt'],
  'admin_bot_settings returns the settings and the token state, never a hash'
);
select is(
  :'settings'::jsonb - 'updatedAt',
  '{"enabled": false, "dryRun": true, "contentProposals": false, "perRunUserCap": 10,
    "limits": {}, "hasToken": false, "prevValidUntil": null, "rotatedAt": null}'::jsonb,
  '... the seeded row: off, dry-run, no content proposals, cap 10, no token (decision 5)'
);
select is(
  public.admin_update_bot_settings(true, null, null, 20, '{"perDay": 5, "perTrack": 2}')
    - 'updatedAt',
  '{"enabled": true, "dryRun": true, "contentProposals": false, "perRunUserCap": 20,
    "limits": {"perDay": 5, "perTrack": 2}, "hasToken": false, "prevValidUntil": null,
    "rotatedAt": null}'::jsonb,
  'admin_update_bot_settings changes the given fields, keeps the null ones and returns the result'
);
select results_eq(
  $$select tests.err(s.sql) from (values
      (1, 'select public.admin_update_bot_settings(null, null, null, 0, null)'),
      (2, 'select public.admin_update_bot_settings(null, null, null, 101, null)'),
      (3, 'select public.admin_update_bot_settings(null, null, null, null, ''[]'')'),
      (4, 'select public.admin_update_bot_settings(null, null, null, null, ''{"perDay": -1}'')'),
      (5, 'select public.admin_update_bot_settings(null, null, null, null, ''{"perDay": "5"}'')')
    ) as s (n, sql) order by s.n$$,
  $$select 'invalid_settings'::text from generate_series(1, 5)$$,
  '... and refuses a cap outside 1–100 or limits that are not an object of whole numbers ≥ 0'
);
select tests.clear_authentication();
select results_eq(
  $$select enabled, dry_run, per_run_user_cap, updated_by::text, updated_at
    from public.bot_settings$$,
  format($$values (true, true, 20, %L::text, now())$$, :'admin'),
  '... storing who changed the row and when; no event (decision 31)'
);

select tests.authenticate_as(:'admin');
select is(
  public.admin_rotate_bot_token(repeat('a', 64)),
  jsonb_build_object('rotatedAt', now(), 'prevValidUntil', null),
  'the first rotation stores the hash, with no previous one'
);
select is(
  public.admin_rotate_bot_token(repeat('b', 64)),
  jsonb_build_object('rotatedAt', now(), 'prevValidUntil', now() + interval '24 hours'),
  'a second rotation keeps the previous hash valid for 24 hours'
);
select results_eq(
  $$select tests.err(s.sql) from (values
      (1, 'select public.admin_rotate_bot_token(''xyz'')'),
      (2, 'select public.admin_rotate_bot_token(repeat(''B'', 64))'),
      (3, 'select public.admin_rotate_bot_token(repeat(''b'', 64))'),
      (4, 'select public.admin_rotate_bot_token(null)')
    ) as s (n, sql) order by s.n$$,
  $$select 'invalid_token'::text from generate_series(1, 4)$$,
  '... and a hash that is not 64 lowercase hex digits, or the current one, is refused'
);
select public.admin_bot_settings() as rotated \gset
select ok(
  (:'rotated'::jsonb ->> 'hasToken')::boolean
    and :'rotated'::jsonb ->> 'prevValidUntil' is not null
    and :'rotated'::text !~ '[0-9a-f]{64}',
  'the settings then show a token and its previous one''s validity, and no hash'
);
select tests.clear_authentication();
select results_eq(
  $$select token_hash, token_prev_hash, token_prev_valid_until, token_rotated_at
    from public.bot_settings$$,
  $$values (repeat('b', 64), repeat('a', 64), now() + interval '24 hours', now())$$,
  '... with the hashes stored in bot_settings'
);
select results_eq(
  format(
    $$select user_id::text, actor_id::text, source, payload from public.events
      where type = 'admin.bot_token_rotated' and user_id = %L$$, :'admin'),
  format($$values (%1$L::text, %1$L::text, 'admin'::text, '{}'::jsonb),
                  (%1$L, %1$L, 'admin', '{}')$$, :'admin'),
  'each rotation writes one admin.bot_token_rotated event for the admin'
);

-- ---------------------------------------------------------------------------------------------
-- 3. admin_set_ai_flag (decisions 34, 18): off suspends the active overrides and turns notes
--    sharing off; on resumes them; both with their events.
-- ---------------------------------------------------------------------------------------------
update public.profiles set ai_personalization = true, share_notes_with_ai = true
where id = :'target';
insert into public.roadmap_overrides
  (user_id, track_id, key, kind, params, until_local_day, start_local_day, created_by_run, status)
values
  (:'target', 'dsa', 'ib-a', 'insert_block', '{}', :'today'::date + 3, :'today'::date,
   'run_2001-01-01', 'active'),
  (:'target', 'dsa', 'rt-b', 'reorder_topics', '{"order": []}', null, :'today'::date,
   'run_2001-01-01', 'active'),
  (:'target', 'english', 'ib-c', 'insert_block', '{}', :'today'::date + 3, :'today'::date,
   'run_2001-01-01', 'active'),
  (:'target', 'dsa', 'ib-old', 'insert_block', '{}', :'today'::date + 3, :'today'::date,
   'run_2001-01-01', 'revoked'),
  (:'target', 'dsa', 'ib-exp', 'insert_block', '{}', :'today'::date - 1, :'today'::date - 5,
   'run_2001-01-01', 'active');

select tests.authenticate_as(:'admin');
select is(
  public.admin_set_ai_flag(:'target', false),
  '{"from": "on", "to": "off"}'::jsonb,
  'admin_set_ai_flag turns the flag off'
);
select tests.clear_authentication();
select results_eq(
  format(
    $$select ai_personalization, share_notes_with_ai from public.profiles where id = %L$$,
    :'target'),
  $$values (false, false)$$,
  '... and notes sharing with it (decision 34)'
);
select results_eq(
  format(
    $$select key, status from public.roadmap_overrides where user_id = %L order by key$$,
    :'target'),
  $$values ('ib-a'::text, 'suspended'::text), ('ib-c', 'suspended'), ('ib-exp', 'active'),
           ('ib-old', 'revoked'), ('rt-b', 'suspended')$$,
  '... suspending the active overrides (an expired or revoked one stays as it is)'
);
select results_eq(
  format(
    $$select type, source, actor_id::text, track_id, payload from public.events
      where user_id = %L order by type, track_id nulls first$$, :'target'),
  format(
    $$values ('admin.ai_flag_changed'::text, 'admin'::text, %1$L::text, null::text,
              jsonb_build_object('targetUserId', %2$L::uuid, 'from', 'on', 'to', 'off')),
             ('roadmap.override_suspended', 'system', %1$L, 'dsa',
              '{"keys": ["ib-a", "rt-b"]}'::jsonb),
             ('roadmap.override_suspended', 'system', %1$L, 'english', '{"keys": ["ib-c"]}')$$,
    :'admin', :'target'),
  '... with admin.ai_flag_changed and one roadmap.override_suspended per track'
);
select tests.authenticate_as(:'admin');
select is(
  tests.err(format('select public.admin_set_ai_flag(%L, false)', :'target')), 'no_change',
  'the same value again → no_change'
);
select is(
  public.admin_set_ai_flag(:'target', true),
  '{"from": "off", "to": "on"}'::jsonb,
  'turning it on again'
);
select tests.clear_authentication();
select results_eq(
  format(
    $$select key, status from public.roadmap_overrides where user_id = %L order by key$$,
    :'target'),
  $$values ('ib-a'::text, 'active'::text), ('ib-c', 'active'), ('ib-exp', 'active'),
           ('ib-old', 'revoked'), ('rt-b', 'active')$$,
  '... resumes the suspended overrides'
);
select results_eq(
  format(
    $$select track_id, payload, share from (
        select e.track_id, e.payload, p.share_notes_with_ai as share
        from public.events e join public.profiles p on p.id = e.user_id
        where e.user_id = %L and e.type = 'roadmap.override_resumed') x
      order by track_id$$, :'target'),
  $$values ('dsa'::text, '{"keys": ["ib-a", "rt-b"]}'::jsonb, false),
           ('english', '{"keys": ["ib-c"]}', false)$$,
  '... with one roadmap.override_resumed per track; notes sharing stays off'
);
select tests.authenticate_as(:'admin');
select results_eq(
  format(
    $$select tests.err(s.sql) from (values
        (1, 'select public.admin_set_ai_flag(''%1$s'', true)'),
        (2, 'select public.admin_set_ai_flag(''%2$s'', true)'),
        (3, 'select public.admin_set_ai_flag(''%3$s'', null)')
      ) as s (n, sql) order by s.n$$,
    :'pending', gen_random_uuid(), :'target'),
  $$values ('invalid_transition'), ('not_found'), ('invalid_transition')$$,
  'a pending account → invalid_transition, an unknown one → not_found, a null value → '
  'invalid_transition'
);
select is(
  public.admin_set_ai_flag(:'admin', true),
  '{"from": "off", "to": "on"}'::jsonb,
  'an admin may turn the flag on for their own account (decision 34)'
);
select results_eq(
  format(
    $$select ai_personalization from public.admin_list_users() where id in (%L, %L)
      order by email$$, :'admin', :'learner'),
  $$values (true), (false)$$,
  'admin_list_users returns ai_personalization'
);
select tests.clear_authentication();

-- ---------------------------------------------------------------------------------------------
-- 4. bot_track_positions: admin_track_positions for the secret key.
-- ---------------------------------------------------------------------------------------------
insert into public.user_tracks (user_id, track_id, roadmap_variant, start_date, budget_minutes)
values (:'target', 'dsa', '10w', '2026-09-01', 60);
insert into public.day_plans (user_id, plan_date, blocks, roadmap_weeks) values
  (:'target', :'today', '[]', '{"dsa": {"variant": "10w", "week": 3}}');
select tests.authenticate_as_service_role();
select ok(
  exists (select 1 from public.bot_track_positions() p
          where p.track_id = 'dsa' and p.variant = '10w' and p.week = 3 and p.learners >= 1),
  'bot_track_positions counts learners per track, variant and week for service_role'
);
select tests.clear_authentication();
select tests.authenticate_as(:'admin');
select is(
  tests.err('select * from public.bot_track_positions()'),
  'permission denied for function bot_track_positions',
  '... and is not callable by a signed-in user, even an admin'
);
select tests.clear_authentication();

-- ---------------------------------------------------------------------------------------------
-- 5. Runs: eligibility, the lazy timeout, the write record, the detail prune (decisions 8–12).
-- ---------------------------------------------------------------------------------------------
select tests.create_user('bot-fn-e1@hocdeu.test') as e1 \gset
select tests.create_user('bot-fn-e2@hocdeu.test') as e2 \gset
select tests.create_user('bot-fn-e3@hocdeu.test') as e3 \gset
select tests.create_user('bot-fn-e4@hocdeu.test') as e4 \gset
select tests.create_user('bot-fn-suspended@hocdeu.test', 'suspended') as x_suspended \gset
select tests.create_user('bot-fn-new@hocdeu.test') as x_new \gset
select tests.create_user('bot-fn-off@hocdeu.test') as x_off \gset
update public.profiles set ai_personalization = true, onboarded_at = now()
where id in (:'e1', :'e2', :'e3', :'e4', :'x_suspended');
update public.profiles set ai_personalization = true where id = :'x_new';
update public.profiles set onboarded_at = now() where id = :'x_off';

insert into public.bot_runs (id, run_key, kind, ops_date, mode, status, started_at) values
  ('92000000-0000-4000-8000-00000000f001', 'run_2001-02-01', 'plan', '2001-02-01', 'live',
   'completed', now() - interval '40 days'),
  ('92000000-0000-4000-8000-00000000f002', 'run_2001-02-02', 'plan', '2001-02-02', 'live',
   'completed', now() - interval '29 days'),
  ('92000000-0000-4000-8000-00000000f003', 'run_2001-02-03', 'plan', '2001-02-03', 'live',
   'running', now() - interval '2 hours 1 minute'),
  ('92000000-0000-4000-8000-00000000f004', 'run_2001-02-04', 'plan', '2001-02-04', 'dry_run',
   'running', now() - interval '1 hour 59 minutes'),
  ('92000000-0000-4000-8000-00000000f005', 'run_2001-02-05', 'plan', '2001-02-05', 'live',
   'running', now() - interval '3 hours');
insert into public.bot_run_users (id, run_id, user_id, user_ref, outcome, processed_at, detail)
values
  ('92000000-0000-4000-8000-0000000000a1', '92000000-0000-4000-8000-00000000f001', :'e1',
   'u_aaaaaaaaaaaaaaaa', 'applied', now() - interval '40 days', '{"plan": {"x": 1}}'),
  ('92000000-0000-4000-8000-0000000000a2', '92000000-0000-4000-8000-00000000f002', :'e1',
   'u_bbbbbbbbbbbbbbbb', 'applied', now() - interval '2 days', '{"plan": {"x": 1}}'),
  ('92000000-0000-4000-8000-0000000000a3', '92000000-0000-4000-8000-00000000f002', :'e3',
   'u_cccccccccccccccc', 'skipped_unseen', now() - interval '5 days', null),
  ('92000000-0000-4000-8000-0000000000a4', '92000000-0000-4000-8000-00000000f004', :'e2',
   'u_dddddddddddddddd', null, null, null),
  ('92000000-0000-4000-8000-0000000000a5', '92000000-0000-4000-8000-00000000f005', :'e4',
   'u_eeeeeeeeeeeeeeee', null, null, null),
  ('92000000-0000-4000-8000-0000000000a6', '92000000-0000-4000-8000-00000000f005', :'e3',
   'u_ffffffffffffffff', 'dry_run', null, null);

select tests.authenticate_as_service_role();
select results_eq(
  format(
    $$select user_id::text, last_processed_at from public.bot_eligible_users()
      where user_id in (%1$L, %2$L, %3$L, %4$L, %5$L, %6$L, %7$L)$$,
    :'e1', :'e2', :'e3', :'e4', :'x_suspended', :'x_new', :'x_off'),
  format(
    $$select u::text, t from (values (%1$L::uuid, now() - interval '2 days'),
                                     (%2$L::uuid, null::timestamptz),
                                     (%3$L::uuid, now() - interval '5 days'),
                                     (%4$L::uuid, null)) as x (u, t)
      order by t nulls first, u$$,
    :'e1', :'e2', :'e3', :'e4'),
  'bot_eligible_users: AI-flagged, active and onboarded users, never processed first (by id), '
  'then least recently processed; suspended, not onboarded and flag-off users excluded'
);

select is(
  public.bot_timeout_runs(), 2, 'bot_timeout_runs fails the two runs running over 2 hours'
);
select results_eq(
  $$select run_key, status, failure_reason, finished_at from public.bot_runs
    where run_key in ('run_2001-02-03', 'run_2001-02-04', 'run_2001-02-05') order by run_key$$,
  $$values ('run_2001-02-03'::text, 'failed'::text, 'timeout'::text, now()),
           ('run_2001-02-04', 'running', null, null),
           ('run_2001-02-05', 'failed', 'timeout', now())$$,
  '... 2 h 1 min → failed / timeout; 1 h 59 min → still running'
);

-- bot_record_write (decision 10): insert-if-absent; invalid answers do not bind the key.
\set ru '92000000-0000-4000-8000-0000000000a4'
select is(
  public.bot_record_write(:'ru', 'plan', repeat('1', 64),
    '{"outcome": "applied", "status": 200, "body": {"outcome": "applied", "planVersion": 1}}'),
  jsonb_build_object('stored', true, 'entry', jsonb_build_object('bodyHash', repeat('1', 64),
    'outcome', 'applied', 'status', 200, 'body', '{"outcome": "applied", "planVersion": 1}'::jsonb)),
  'bot_record_write stores { bodyHash, …entry } when the kind has none'
);
select results_eq(
  $$select outcome, processed_at, writes ? 'plan' from public.bot_run_users
    where id = '92000000-0000-4000-8000-0000000000a4'$$,
  $$values ('applied'::text, now(), true)$$,
  '... sets processed_at and, for plan, the user''s outcome'
);
select is(
  public.bot_record_write(:'ru', 'plan', repeat('2', 64), '{"outcome": "applied", "status": 200}'),
  jsonb_build_object('stored', false, 'entry', jsonb_build_object('bodyHash', repeat('1', 64),
    'outcome', 'applied', 'status', 200, 'body', '{"outcome": "applied", "planVersion": 1}'::jsonb)),
  '... and returns the stored entry, unchanged, when the kind has one'
);
select is(
  public.bot_record_write(:'ru', 'custom-items', repeat('3', 64), '{"outcome": "dry_run"}')
    ->> 'stored',
  'true', 'another kind is recorded on its own'
);
select results_eq(
  $$select outcome, processed_at from public.bot_run_users
    where id = '92000000-0000-4000-8000-0000000000a4'$$,
  $$values ('applied'::text, now())$$,
  '... which keeps the user''s plan outcome'
);
select results_eq(
  format(
    $$select public.bot_record_write(%L, 'overrides', repeat('4', 64), '{"outcome": "invalid"}')
      from generate_series(1, 3)$$, :'ru'),
  $$values ('{"stored": false, "invalidAttempts": 1}'::jsonb),
           ('{"stored": false, "invalidAttempts": 2}'),
           ('{"stored": false, "invalidAttempts": 3}')$$,
  'an invalid answer is not stored: it counts detail[kind].invalidAttempts'
);
select is(
  tests.err(format(
    $$select public.bot_record_write(%L, 'overrides', repeat('4', 64), '{"outcome": "invalid"}')$$,
    :'ru')),
  'too_many_attempts', '... and the 4th → too_many_attempts'
);
select results_eq(
  $$select writes ? 'overrides', detail -> 'overrides' -> 'invalidAttempts', processed_at
    from public.bot_run_users where id = '92000000-0000-4000-8000-0000000000a4'$$,
  $$values (false, '3'::jsonb, now())$$,
  '... leaving the key unbound and the count at 3'
);
select results_eq(
  format(
    $$select tests.err(s.sql) from (values
        (1, format('select public.bot_record_write(%%L, ''review'', repeat(''1'', 64), ''{"outcome": "applied"}'')', %1$L)),
        (2, format('select public.bot_record_write(%%L, ''plan'', ''abc'', ''{"outcome": "applied"}'')', %1$L)),
        (3, format('select public.bot_record_write(%%L, ''plan'', repeat(''1'', 64), ''{"outcome": "error"}'')', %1$L)),
        (4, format('select public.bot_record_write(%%L, ''plan'', repeat(''1'', 64), ''{}'')', %1$L)),
        (5, format('select public.bot_record_write(%%L, ''plan'', repeat(''1'', 64), ''{"outcome": "applied"}'')', gen_random_uuid()))
      ) as s (n, sql) order by s.n$$,
    :'ru'),
  $$values ('invalid_event'), ('invalid_event'), ('invalid_event'), ('invalid_event'),
           ('not_found')$$,
  'an unknown kind, a bad hash, an outcome that binds no key or none → invalid_event; an '
  'unknown run user → not_found'
);

select is(public.bot_prune_details(), 1, 'bot_prune_details clears one detail');
select results_eq(
  $$select id::text, detail from public.bot_run_users
    where id in ('92000000-0000-4000-8000-0000000000a1', '92000000-0000-4000-8000-0000000000a2')
    order by id$$,
  $$values ('92000000-0000-4000-8000-0000000000a1'::text, null::jsonb),
           ('92000000-0000-4000-8000-0000000000a2', '{"plan": {"x": 1}}')$$,
  '... of a run started over 30 days ago, and keeps a 29-day-old one'
);
select tests.clear_authentication();

-- admin_bot_runs: the latest runs with their counts, no user ids or refs; it times runs out.
update public.bot_runs set status = 'running', failure_reason = null, finished_at = null
where run_key = 'run_2001-02-05';
select tests.authenticate_as(:'admin');
select public.admin_bot_runs(3) as runs \gset
select tests.clear_authentication();
select is(
  (select jsonb_agg(r ->> 'runKey' order by n)
   from jsonb_array_elements(:'runs'::jsonb) with ordinality as x (r, n)),
  '["run_2001-02-04", "run_2001-02-03", "run_2001-02-05"]'::jsonb,
  'admin_bot_runs returns the latest runs first, up to the limit'
);
select is(
  (select r from jsonb_array_elements(:'runs'::jsonb) as x (r)
   where r ->> 'runKey' = 'run_2001-02-05'),
  jsonb_build_object(
    'runKey', 'run_2001-02-05', 'kind', 'plan', 'mode', 'live', 'status', 'failed',
    'failureReason', 'timeout', 'usersEligible', 0, 'usersDeferred', 0,
    'outcomes', '{"pending": 1, "dry_run": 1}'::jsonb, 'contentPrUrl', null, 'summary', null,
    'startedAt', now() - interval '3 hours', 'finishedAt', now()),
  '... each with its counts per outcome, after timing out the stale ones'
);
select ok(
  :'runs'::text !~ 'u_[a-z2-7]{16}' and :'runs'::text !~* 'user_?id'
    and :'runs'::text not like '%' || :'e3' || '%',
  '... and no user id or ref'
);

select * from finish();
rollback;
