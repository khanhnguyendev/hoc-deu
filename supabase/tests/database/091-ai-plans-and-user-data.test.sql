begin;
set client_min_messages = warning;
create extension if not exists pgtap with schema extensions;
\ir _helpers.psql

select plan(90);

-- Task 6.2b: apply_system_event's M6 branches — plan.ai_proposed with the untouched-plan
-- precedence, user_item.created / retired / hidden, roadmap.override_set / revoked — and
-- roadmap_override_active, decision 18's computed expiry (platform design §2.3, §4.4, §5.12,
-- §6.4.3–§6.4.5, §6.10; implementation plan Part B-M6 decisions 8, 13, 17, 18, 33). The server
-- calls apply_system_event with the secret key; it runs as postgres here (001 and 041 check the
-- grants).

-- ---------------------------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------------------------

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

-- The default schedule's local day plus p_n days, as YYYY-MM-DD (every user here has it).
create function tests.d(p_n integer default 0) returns text language sql stable as $$
  select to_char(public.local_day(now(), 'Asia/Ho_Chi_Minh', time '04:00') + p_n, 'YYYY-MM-DD')
$$;

-- A plan's blocks (as 072); p_minutes tells one build from another.
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

-- The roadmap_weeks snapshot; p_extra names an extra_week override (decision 18).
create function tests.weeks(p_week integer, p_extra text default null) returns jsonb
language sql immutable as $$
  select jsonb_build_object('dsa', jsonb_strip_nulls(jsonb_build_object(
    'variant', '10w', 'week', p_week, 'dueCount', 0, 'newPerDay', null, 'throttled', false,
    'reviewDebt', false, 'extraWeek', p_extra)))
$$;

-- plan.generated for p_date (072's shapes).
create function tests.generated(p_id text, p_mode text, p_version integer, p_date text)
returns jsonb language sql immutable as $$
  select jsonb_build_object(
    'id', p_id, 'type', 'plan.generated', 'local_day', p_date, 'rules_version', 3,
    'payload', jsonb_build_object('mode', p_mode, 'planVersion', p_version))
$$;
create function tests.plan_changes(p_date text, p_minutes integer) returns jsonb
language sql immutable as $$
  select jsonb_build_array(jsonb_build_object('table', 'day_plans', 'row', jsonb_build_object(
    'plan_date', p_date, 'blocks', tests.blocks(p_date, p_minutes),
    'roadmap_weeks', tests.weeks(2))))
$$;

-- plan.ai_proposed as lib/bot sends it: source bot, local_day, payload exactly { runId }.
create function tests.ai_event(p_id text, p_run text, p_day text) returns jsonb
language sql immutable as $$
  select jsonb_build_object(
    'id', p_id, 'type', 'plan.ai_proposed', 'source', 'bot', 'local_day', p_day,
    'rules_version', 3, 'payload', jsonb_build_object('runId', p_run))
$$;
create function tests.ai_changes(
  p_date text, p_minutes integer, p_run uuid, p_rationale text default 'Ôn lại trước, học sau.'
) returns jsonb language sql immutable as $$
  select jsonb_build_array(jsonb_build_object('table', 'day_plans', 'row', jsonb_build_object(
    'plan_date', p_date, 'blocks', tests.blocks(p_date, p_minutes),
    'roadmap_weeks', tests.weeks(2), 'rationale', p_rationale, 'bot_run_id', p_run)))
$$;

-- user_item.created (source bot, payload { itemType, slug }, limits { perDay, active }).
create function tests.item_event(
  p_id text, p_ref text, p_slug text, p_limits jsonb default '{"perDay": 10, "active": 200}',
  p_track text default 'dsa', p_type text default 'flashcard'
) returns jsonb language sql immutable as $$
  select jsonb_build_object(
    'id', p_id, 'type', 'user_item.created', 'source', 'bot', 'track_id', p_track,
    'item_id', 'user:' || p_ref || ':' || p_slug, 'rules_version', 3, 'limits', p_limits,
    'payload', jsonb_build_object('itemType', p_type, 'slug', p_slug))
$$;
create function tests.item_changes(p_front text default 'Anagram?') returns jsonb
language sql immutable as $$
  select jsonb_build_array(jsonb_build_object('table', 'user_items', 'row', jsonb_build_object(
    'topic_id', 'arrays-hashing', 'payload', jsonb_build_object('front', p_front, 'back', 'Đếm'),
    'created_by_run', 'run_2001-01-01')))
$$;
-- user_item.retired (bot) / user_item.hidden (the learner, source system, actor the learner).
create function tests.item_status_event(
  p_id text, p_type text, p_item text, p_actor uuid default null
) returns jsonb language sql immutable as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', p_id, 'type', p_type, 'item_id', p_item, 'rules_version', 3,
    'source', case when p_type = 'user_item.hidden' then 'system' else 'bot' end,
    'actor_id', p_actor, 'payload', jsonb_build_object('itemType', 'flashcard')))
$$;

-- roadmap.override_set (source bot, payload { key, kind, params }, limits { perTrack }).
create function tests.ovr_event(
  p_id text, p_key text, p_kind text, p_params jsonb, p_limits jsonb default '{"perTrack": 3}',
  p_track text default 'dsa'
) returns jsonb language sql immutable as $$
  select jsonb_build_object(
    'id', p_id, 'type', 'roadmap.override_set', 'source', 'bot', 'track_id', p_track,
    'rules_version', 3, 'limits', p_limits,
    'payload', jsonb_build_object('key', p_key, 'kind', p_kind, 'params', p_params))
$$;
create function tests.ovr_changes(p_until text default null, p_study_days integer default null)
returns jsonb language sql immutable as $$
  select jsonb_build_array(jsonb_build_object('table', 'roadmap_overrides', 'row',
    jsonb_strip_nulls(jsonb_build_object(
      'until_local_day', p_until, 'study_days', p_study_days,
      'created_by_run', 'run_2001-01-01'))))
$$;
create function tests.ib_params(p_until text, p_minutes integer default 15) returns jsonb
language sql immutable as $$
  select jsonb_build_object(
    'topicId', 'arrays-hashing', 'weekdays', jsonb_build_array('mon', 'wed'),
    'minutes', p_minutes, 'until', p_until)
$$;
create function tests.ew_params(p_days integer default 2) returns jsonb
language sql immutable as $$
  select jsonb_build_object('topicId', 'arrays-hashing', 'studyDays', p_days)
$$;
-- roadmap.override_revoked: the learner's (source system, actor the learner) or, with p_actor
-- null, the bot's (source bot — ruling M6-R17).
create function tests.revoke_event(p_id text, p_key text, p_kind text, p_actor uuid)
returns jsonb language sql immutable as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', p_id, 'type', 'roadmap.override_revoked',
    'source', case when p_actor is null then 'bot' else 'system' end, 'actor_id', p_actor,
    'track_id', 'dsa', 'rules_version', 3)) || jsonb_build_object(
    'payload', jsonb_build_object('key', p_key, 'kind', p_kind))
$$;

-- The message an apply_system_event call raises, or 'no error'.
create function tests.sys_error(
  p_user uuid, p_event jsonb, p_changes jsonb default '[]'::jsonb,
  p_expected jsonb default '{}'::jsonb
) returns text language plpgsql as $$
begin
  perform public.apply_system_event(p_user, p_event, p_changes, p_expected);
  return 'no error';
exception when others then
  return sqlerrm;
end $$;

-- ---------------------------------------------------------------------------------------------
-- Fixtures: AI-flagged, onboarded learners enrolled in dsa; the flag-off learners too. Plans and
-- overrides inserted directly are written as postgres.
-- ---------------------------------------------------------------------------------------------
select tests.create_user('ai-fresh@hocdeu.test') as fresh \gset
select tests.create_user('ai-untouched@hocdeu.test') as untouched \gset
select tests.create_user('ai-touched@hocdeu.test') as touched \gset
select tests.create_user('ai-resume@hocdeu.test') as resumed \gset
select tests.create_user('ai-off@hocdeu.test') as flag_off \gset
select tests.create_user('ai-items@hocdeu.test') as items \gset
select tests.create_user('ai-items-full@hocdeu.test') as items_full \gset
select tests.create_user('ai-ovr@hocdeu.test') as ovr \gset
select tests.create_user('ai-ovr-cap@hocdeu.test') as ovr_cap \gset
select tests.create_user('ai-ovr-ew@hocdeu.test') as ovr_ew \gset
select tests.create_user('ai-ovr-cool@hocdeu.test') as ovr_cool \gset
select tests.create_user('ai-ovr-reset@hocdeu.test') as ovr_reset \gset
select tests.create_user('ai-ovr-kind@hocdeu.test') as ovr_kind \gset
select tests.create_user('ai-ovr-bot@hocdeu.test') as ovr_bot \gset

update public.profiles set ai_personalization = true, onboarded_at = now()
where id in (:'fresh', :'untouched', :'touched', :'resumed', :'items', :'items_full', :'ovr',
             :'ovr_cap', :'ovr_ew', :'ovr_cool', :'ovr_reset', :'ovr_kind', :'ovr_bot');
update public.profiles set onboarded_at = now() where id = :'flag_off';
insert into public.user_tracks (user_id, track_id, roadmap_variant, start_date, budget_minutes)
select u, 'dsa', '10w', '2026-09-01', 60
from unnest(array[:'fresh', :'untouched', :'touched', :'resumed', :'flag_off', :'items',
                  :'items_full', :'ovr', :'ovr_cap', :'ovr_ew', :'ovr_cool', :'ovr_reset',
                  :'ovr_kind', :'ovr_bot']::uuid[])
  as u;
select bot_ref as items_ref from public.profiles where id = :'items' \gset
select bot_ref as full_ref from public.profiles where id = :'items_full' \gset
select bot_ref as off_ref from public.profiles where id = :'flag_off' \gset
select tests.d() as today \gset
select tests.d(-1) as yesterday \gset

-- Writes are live (the seeded row is dry-run, decision 5). Runs: a live running plan run, a
-- dry-run one, a completed one and a publish run.
update public.bot_settings set dry_run = false;
insert into public.bot_runs (id, run_key, kind, ops_date, mode, status) values
  ('91000000-0000-4000-8000-00000000f001', 'run_2001-01-01', 'plan', '2001-01-01', 'live',
   'running'),
  ('91000000-0000-4000-8000-00000000f002', 'run_2001-01-02', 'plan', '2001-01-02', 'dry_run',
   'running'),
  ('91000000-0000-4000-8000-00000000f003', 'run_2001-01-03', 'plan', '2001-01-03', 'live',
   'completed'),
  ('91000000-0000-4000-8000-00000000f004', 'run_2001-01-01_publish-1', 'publish', '2001-01-01',
   'live', 'running');
\set live_run '91000000-0000-4000-8000-00000000f001'

-- ---------------------------------------------------------------------------------------------
-- 1. No plan for the date → inserted (source ai, version 1), one plan.ai_applied event under the
--    caller's id naming the plan; plan.ai_proposed itself is never stored (decision 13).
-- ---------------------------------------------------------------------------------------------
select ok(
  not tests.holds_advisory_lock(public.plan_lock_key(:'fresh', :'today')),
  'no transaction holds the fresh learner''s plan lock yet'
);
select public.apply_system_event(
  :'fresh', tests.ai_event('91000000-0000-4000-8000-000000000001', 'run_2001-01-01', :'today'),
  tests.ai_changes(:'today', 40, :'live_run')
) as fresh_result \gset
select is(
  :'fresh_result'::jsonb - 'plan_id',
  jsonb_build_object('outcome', 'applied', 'versions',
    jsonb_build_object('day_plans:' || :'today', 1)),
  'plan.ai_proposed without a plan returns applied, version 1'
);
select results_eq(
  format(
    $$select id::text, source, version, rationale, bot_run_id, blocks, seen_at
      from public.day_plans where user_id = %L$$, :'fresh'),
  format(
    $$values (%L::text, 'ai'::text, 1, 'Ôn lại trước, học sau.'::text, %L::uuid,
              tests.blocks(%L, 40), null::timestamptz)$$,
    :'fresh_result'::jsonb ->> 'plan_id', :'live_run', :'today'),
  '... inserts the plan with the returned plan_id: source ai, version 1, the rationale and run'
);
select results_eq(
  format(
    $$select id::text, type, source, plan_id::text, payload
      from public.events where user_id = %L$$, :'fresh'),
  format(
    $$values ('91000000-0000-4000-8000-000000000001'::text, 'plan.ai_applied'::text, 'bot'::text,
              %L::text, '{"runId": "run_2001-01-01", "outcome": "applied", "planVersion": 1}'::jsonb)$$,
    :'fresh_result'::jsonb ->> 'plan_id'),
  '... and stores one plan.ai_applied event under the caller''s id, naming the plan'
);
select ok(
  tests.holds_advisory_lock(public.plan_lock_key(:'fresh', :'today')),
  '... under the (user, plan_date) lock an item result naming the plan also takes (§4.4)'
);
select is(
  public.apply_system_event(
    :'fresh', tests.ai_event('91000000-0000-4000-8000-000000000001', 'run_2001-01-01', :'today'),
    tests.ai_changes(:'today', 50, :'live_run')),
  '{"outcome": "duplicate", "versions": {}}'::jsonb,
  'the same event id again is a duplicate'
);
select is(
  (select version from public.day_plans where user_id = :'fresh'), 1,
  '... which changes nothing'
);

-- ---------------------------------------------------------------------------------------------
-- 2. An untouched baseline plan → replaced: version + 1, seen_at kept, source ai (§2.3).
-- ---------------------------------------------------------------------------------------------
select public.apply_system_event(
  :'untouched', tests.generated('91000000-0000-4000-8000-000000000011', 'baseline', 1, :'today'),
  tests.plan_changes(:'today', 30), jsonb_build_object('day_plans:' || :'today', 0)
) ->> 'plan_id' as untouched_plan \gset
update public.day_plans set seen_at = '2026-01-02T00:00:00Z' where id = :'untouched_plan';
select is(
  public.apply_system_event(
    :'untouched',
    tests.ai_event('91000000-0000-4000-8000-000000000012', 'run_2001-01-01', :'today'),
    tests.ai_changes(:'today', 45, :'live_run')),
  jsonb_build_object('outcome', 'applied', 'plan_id', :'untouched_plan', 'versions',
    jsonb_build_object('day_plans:' || :'today', 2)),
  'plan.ai_proposed on an untouched baseline plan returns applied, version 2'
);
select results_eq(
  format(
    $$select source, version, seen_at, rationale, bot_run_id, blocks
      from public.day_plans where user_id = %L$$, :'untouched'),
  format(
    $$values ('ai'::text, 2, '2026-01-02T00:00:00Z'::timestamptz,
              'Ôn lại trước, học sau.'::text, %L::uuid, tests.blocks(%L, 45))$$,
    :'live_run', :'today'),
  '... replaces it: source ai, version 2, seen_at kept, the rationale, run and blocks'
);
select results_eq(
  format(
    $$select type, plan_id::text, payload from public.events
      where user_id = %L and type like 'plan.ai_%%'$$, :'untouched'),
  format(
    $$values ('plan.ai_applied'::text, %L::text,
              '{"runId": "run_2001-01-01", "outcome": "applied", "planVersion": 2}'::jsonb)$$,
    :'untouched_plan'),
  '... with one plan.ai_applied event naming it'
);

-- A settings rebuild of the untouched AI plan makes it a baseline plan again (§5.4).
select is(
  public.apply_system_event(
    :'untouched',
    tests.generated('91000000-0000-4000-8000-000000000013', 'rebuild', 3, :'today'),
    tests.plan_changes(:'today', 35), jsonb_build_object('day_plans:' || :'today', 2)) - 'plan_id',
  jsonb_build_object('outcome', 'applied', 'versions',
    jsonb_build_object('day_plans:' || :'today', 3)),
  'a plan.generated rebuild of the untouched AI plan is applied (its plan.ai_applied event does '
  'not touch it)'
);
select results_eq(
  format(
    $$select source, version, rationale, bot_run_id, seen_at
      from public.day_plans where user_id = %L$$, :'untouched'),
  $$values ('baseline'::text, 3, null::text, null::uuid, '2026-01-02T00:00:00Z'::timestamptz)$$,
  '... and makes it baseline: rationale and bot_run_id null, seen_at kept'
);

-- ---------------------------------------------------------------------------------------------
-- 3. A baseline plan with an item.result but no check-in → not replaced (§6.10).
-- ---------------------------------------------------------------------------------------------
select public.apply_system_event(
  :'touched', tests.generated('91000000-0000-4000-8000-000000000021', 'baseline', 1, :'today'),
  tests.plan_changes(:'today', 30), jsonb_build_object('day_plans:' || :'today', 0)
) ->> 'plan_id' as touched_plan \gset
insert into public.events (id, user_id, source, type, item_id, plan_id, payload) values (
  '91000000-0000-4000-8000-000000000022', :'touched', 'learner', 'item.result', 'dsa:lc-0001',
  :'touched_plan', '{"result": "solved"}');
select is(
  public.apply_system_event(
    :'touched',
    tests.ai_event('91000000-0000-4000-8000-000000000023', 'run_2001-01-01', :'today'),
    tests.ai_changes(:'today', 45, :'live_run')),
  jsonb_build_object('outcome', 'plan_in_use', 'plan_id', :'touched_plan', 'versions', '{}'::jsonb),
  'plan.ai_proposed on a plan with an item.result but no check-in returns plan_in_use'
);
select results_eq(
  format(
    $$select source, version, rationale, blocks from public.day_plans where user_id = %L$$,
    :'touched'),
  format($$values ('baseline'::text, 1, null::text, tests.blocks(%L, 30))$$, :'today'),
  '... and leaves the plan as it is'
);
select results_eq(
  format(
    $$select id::text, type, source, plan_id::text, payload from public.events
      where user_id = %L and type like 'plan.ai_%%'$$, :'touched'),
  format(
    $$values ('91000000-0000-4000-8000-000000000023'::text, 'plan.ai_skipped'::text, 'bot'::text,
              %L::text, '{"runId": "run_2001-01-01", "outcome": "skipped_plan_in_use"}'::jsonb)$$,
    :'touched_plan'),
  '... with one plan.ai_skipped event naming it'
);

-- A "Học tiếp hôm nay" plan, untouched, is never replaced (M5 decision 11's reason).
select public.apply_system_event(
  :'resumed', tests.generated('91000000-0000-4000-8000-000000000031', 'resume', 1, :'today'),
  tests.plan_changes(:'today', 30), jsonb_build_object('day_plans:' || :'today', 0)
) ->> 'plan_id' as resume_plan \gset
select is(
  public.apply_system_event(
    :'resumed',
    tests.ai_event('91000000-0000-4000-8000-000000000032', 'run_2001-01-01', :'today'),
    tests.ai_changes(:'today', 45, :'live_run')),
  jsonb_build_object('outcome', 'plan_in_use', 'plan_id', :'resume_plan', 'versions', '{}'::jsonb),
  'plan.ai_proposed on an untouched resume plan returns plan_in_use'
);
select is(
  (select source || ':' || version from public.day_plans where user_id = :'resumed'),
  'baseline:1', '... and leaves it as it is'
);

-- ---------------------------------------------------------------------------------------------
-- 4. Refusals: the flag, the run, the day, the shape.
-- ---------------------------------------------------------------------------------------------
select is(
  tests.sys_error(:'flag_off',
    tests.ai_event('91000000-0000-4000-8000-000000000041', 'run_2001-01-01', :'today'),
    tests.ai_changes(:'today', 45, :'live_run')),
  'ai_off', 'the AI flag off → ai_off'
);
select results_eq(
  format(
    $$select tests.sys_error(%1$L, tests.ai_event(gen_random_uuid()::text, r.key, %2$L),
        tests.ai_changes(%2$L, 45, r.id))
      from (values ('run_2001-01-02', '91000000-0000-4000-8000-00000000f002'::uuid, 1),
                   ('run_2001-01-03', '91000000-0000-4000-8000-00000000f003'::uuid, 2),
                   ('run_2001-01-02', '91000000-0000-4000-8000-00000000f001'::uuid, 3),
                   ('run_2001-01-01', '91000000-0000-4000-8000-00000000f004'::uuid, 4),
                   ('run_2001-01-01', '91000000-0000-4000-8000-00000000f0ff'::uuid, 5))
        as r (key, id, n)
      order by r.n$$,
    :'resumed', :'today'),
  $$values ('invalid_event'), ('invalid_event'), ('invalid_event'), ('invalid_event'),
           ('invalid_event')$$,
  'a dry-run run, a completed run, another run''s key, a publish run and an unknown run → '
  'invalid_event'
);
select is(
  tests.sys_error(:'fresh',
    tests.ai_event('91000000-0000-4000-8000-000000000042', 'run_2001-01-01', :'yesterday'),
    tests.ai_changes(:'yesterday', 45, :'live_run')),
  'day_changed', 'a plan for another local day than the database''s → day_changed'
);
select results_eq(
  format(
    $$select tests.sys_error(%1$L, e.event, e.changes, e.expected)
      from (values
        (1, tests.ai_event(gen_random_uuid()::text, 'run_2001-01-01', %2$L),
         tests.ai_changes(%2$L, 45, %3$L, repeat('a', 281)), '{}'::jsonb),
        (2, tests.ai_event(gen_random_uuid()::text, 'run_2001-01-01', %2$L),
         tests.ai_changes(%2$L, 45, %3$L, 'một' || chr(10) || 'hai'), '{}'),
        (3, tests.ai_event(gen_random_uuid()::text, 'run_2001-01-01', %2$L)
              || '{"payload": {"runId": "run_2001-01-01", "outcome": "applied"}}',
         tests.ai_changes(%2$L, 45, %3$L), '{}'),
        (4, tests.ai_event(gen_random_uuid()::text, 'run_2001-01-01', %2$L)
              || jsonb_build_object('plan_id', gen_random_uuid()),
         tests.ai_changes(%2$L, 45, %3$L), '{}'),
        (5, tests.ai_event(gen_random_uuid()::text, 'run_2001-01-01', %2$L) - 'local_day',
         tests.ai_changes(%2$L, 45, %3$L), '{}'),
        (6, tests.ai_event(gen_random_uuid()::text, 'run_2001-01-01', %4$L),
         tests.ai_changes(%2$L, 45, %3$L), '{}'),
        (7, tests.ai_event(gen_random_uuid()::text, 'run_2001-01-01', %2$L),
         tests.ai_changes(%2$L, 45, %3$L), jsonb_build_object('day_plans:' || %2$L, 1)),
        (8, tests.ai_event(gen_random_uuid()::text, 'run_2001-01-01', %2$L)
              || '{"source": "system"}',
         tests.ai_changes(%2$L, 45, %3$L), '{}'),
        (9, tests.ai_event(gen_random_uuid()::text, 'run_2001-01-01', %2$L),
         jsonb_set(tests.ai_changes(%2$L, 45, %3$L), '{0,row,bot_run_id}', '"run_2001-01-01"'),
         '{}'),
        (10, tests.ai_event(gen_random_uuid()::text, 'run_2001-01-01', %2$L),
         jsonb_set(tests.ai_changes(%2$L, 45, %3$L), '{0,row}',
           (tests.ai_changes(%2$L, 45, %3$L) -> 0 -> 'row') - 'rationale'), '{}'),
        (11, tests.ai_event(gen_random_uuid()::text, 'run_1', %2$L),
         tests.ai_changes(%2$L, 45, %3$L), '{}')
      ) as e (n, event, changes, expected)
      order by e.n$$,
    :'resumed', :'today', :'live_run', :'yesterday'),
  $$select 'invalid_event'::text from generate_series(1, 11)$$,
  'a rationale over 280 characters or with a control character, a payload other than { runId }, '
  'a plan_id, no local_day, a plan_date other than local_day, an expected version, another '
  'source, a bot_run_id that is not a UUID, no rationale or a runId that is no plan run key → '
  'invalid_event'
);
select is(
  (select count(*)::integer from public.events where user_id = :'resumed' and type like 'plan.ai%'),
  1, '... and no refusal stores an event (the one is the resume plan''s plan.ai_skipped)'
);
select is(
  tests.sys_error(:'resumed',
    tests.ai_event(gen_random_uuid()::text, 'run_2001-01-01', :'today'),
    tests.ai_changes(:'today', 45, :'live_run', repeat('ạ', 280))),
  'no error', 'a rationale of exactly 280 characters is accepted'
);

-- ---------------------------------------------------------------------------------------------
-- 5. user_item.created (§6.4.4, decision 17): the ID formula, unchanged, slug_taken, the limits.
-- ---------------------------------------------------------------------------------------------
select is(
  public.apply_system_event(
    :'items', tests.item_event('91000000-0000-4000-8000-000000000051', :'items_ref', 'ah-drill'),
    tests.item_changes()),
  '{"outcome": "applied", "versions": {}}'::jsonb,
  'user_item.created with item_id user:<bot_ref>:<slug> returns applied'
);
select results_eq(
  format(
    $$select item_id, item_type, track_id, topic_id, payload, status, created_by_run, created_on
      from public.user_items where user_id = %L$$, :'items'),
  format(
    $$values ('user:' || %L || ':ah-drill', 'flashcard'::text, 'dsa'::text,
              'arrays-hashing'::text, '{"front": "Anagram?", "back": "Đếm"}'::jsonb,
              'active'::text, 'run_2001-01-01'::text, %L::date)$$,
    :'items_ref', :'today'),
  '... stores the item: active, created on the event''s local day'
);
select results_eq(
  format(
    $$select id::text, type, source, track_id, item_id, payload
      from public.events where user_id = %L$$, :'items'),
  format(
    $$values ('91000000-0000-4000-8000-000000000051'::text, 'user_item.created'::text,
              'bot'::text, 'dsa'::text, 'user:' || %L || ':ah-drill',
              '{"itemType": "flashcard", "slug": "ah-drill"}'::jsonb)$$,
    :'items_ref'),
  '... and one user_item.created event'
);
select is(
  public.apply_system_event(
    :'items', tests.item_event('91000000-0000-4000-8000-000000000052', :'items_ref', 'ah-drill'),
    tests.item_changes()),
  '{"outcome": "unchanged", "versions": {}}'::jsonb,
  'the same slug with the same type, topic and payload returns unchanged'
);
select is(
  (select count(*)::integer from public.events where user_id = :'items'), 1,
  '... and stores no event'
);
select is(
  tests.sys_error(:'items',
    tests.item_event('91000000-0000-4000-8000-000000000053', :'items_ref', 'ah-drill'),
    tests.item_changes('Another front')),
  'slug_taken', 'the same slug with another payload → slug_taken'
);
select results_eq(
  format(
    $$select tests.sys_error(%1$L, e.event, e.changes)
      from (values
        (1, tests.item_event(gen_random_uuid()::text, %3$L, 'ah-other'), tests.item_changes()),
        (2, tests.item_event(gen_random_uuid()::text, %2$L, 'AH'), tests.item_changes()),
        (3, tests.item_event(gen_random_uuid()::text, %2$L, 'ah-type', p_type => 'lesson'),
         tests.item_changes()),
        (4, tests.item_event(gen_random_uuid()::text, %2$L, 'ah-extra')
              || '{"payload": {"itemType": "flashcard", "slug": "ah-extra", "x": 1}}',
         tests.item_changes()),
        (5, tests.item_event(gen_random_uuid()::text, %2$L, 'ah-nolimit') - 'limits',
         tests.item_changes()),
        (6, tests.item_event(gen_random_uuid()::text, %2$L, 'ah-neg', '{"perDay": -1, "active": 1}'),
         tests.item_changes()),
        (7, tests.item_event(gen_random_uuid()::text, %2$L, 'ah-src') || '{"source": "system"}',
         tests.item_changes()),
        (8, tests.item_event(gen_random_uuid()::text, %2$L, 'ah-run'),
         jsonb_set(tests.item_changes(), '{0,row,created_by_run}', '"run_2001-01-01_publish-1"')),
        (9, tests.item_event(gen_random_uuid()::text, %2$L, 'ah-plan')
              || jsonb_build_object('plan_id', gen_random_uuid()),
         tests.item_changes())
      ) as e (n, event, changes)
      order by e.n$$,
    :'items', :'items_ref', :'full_ref'),
  $$select 'invalid_event'::text from generate_series(1, 9)$$,
  'another user''s bot_ref, a bad slug, an unknown itemType, an extra payload key, no limits, '
  'a negative limit, another source, a publish run or a plan_id → invalid_event'
);
select is(
  tests.sys_error(:'items',
    tests.item_event('91000000-0000-4000-8000-000000000054', :'items_ref', 'en-drill',
      p_track => 'english'),
    tests.item_changes()),
  'not_enrolled', 'a track the user is not enrolled in → not_enrolled'
);
select is(
  tests.sys_error(:'flag_off',
    tests.item_event('91000000-0000-4000-8000-000000000055', :'off_ref', 'ah-drill'),
    tests.item_changes()),
  'ai_off', 'the AI flag off → ai_off'
);

-- 10 new items per local day: a limits.perDay of 50 is clamped to 10 (decision 33).
select is(
  (select count(*)::integer from generate_series(2, 10) as n
   where public.apply_system_event(
     :'items',
     tests.item_event(gen_random_uuid()::text, :'items_ref', 'ah-day-' || n,
       '{"perDay": 50, "active": 200}'),
     tests.item_changes()) ->> 'outcome' = 'applied'),
  9, 'nine more items the same day are applied (10 in all)'
);
select is(
  tests.sys_error(:'items',
    tests.item_event('91000000-0000-4000-8000-000000000056', :'items_ref', 'ah-day-11',
      '{"perDay": 50, "active": 200}'),
    tests.item_changes()),
  'limit_reached', '... and the 11th → limit_reached (a perDay of 50 is clamped to 10)'
);

-- 200 active items: a limits.active of 500 is clamped to 200.
insert into public.user_items
  (user_id, item_id, item_type, track_id, topic_id, payload, created_by_run, created_on)
select :'items_full', 'user:' || :'full_ref' || ':old-' || n, 'flashcard', 'dsa', 'arrays-hashing',
  '{"front": "f", "back": "b"}', 'run_2001-01-01', :'yesterday'::date
from generate_series(1, 199) as n;
select is(
  public.apply_system_event(
    :'items_full',
    tests.item_event('91000000-0000-4000-8000-000000000057', :'full_ref', 'new-1',
      '{"perDay": 10, "active": 500}'),
    tests.item_changes()) ->> 'outcome',
  'applied', 'the 200th active item is applied'
);
select is(
  tests.sys_error(:'items_full',
    tests.item_event('91000000-0000-4000-8000-000000000058', :'full_ref', 'new-2',
      '{"perDay": 10, "active": 500}'),
    tests.item_changes()),
  'limit_reached', '... and the 201st → limit_reached (an active of 500 is clamped to 200)'
);

-- ---------------------------------------------------------------------------------------------
-- 6. user_item.hidden (the learner) and user_item.retired (the bot).
-- ---------------------------------------------------------------------------------------------
\set drill '''user:' :items_ref ':ah-drill'''
select is(
  public.apply_system_event(:'items',
    tests.item_status_event('91000000-0000-4000-8000-000000000061', 'user_item.hidden', :drill,
      :'items')),
  '{"outcome": "applied", "versions": {}}'::jsonb,
  'the learner hides an active item'
);
select is(
  public.apply_system_event(:'items',
    tests.item_status_event('91000000-0000-4000-8000-000000000062', 'user_item.hidden', :drill,
      :'items')),
  '{"outcome": "unchanged", "versions": {}}'::jsonb,
  '... hiding it again returns unchanged'
);
select is(
  public.apply_system_event(:'items',
    tests.item_status_event('91000000-0000-4000-8000-000000000063', 'user_item.retired', :drill)),
  '{"outcome": "applied", "versions": {}}'::jsonb,
  'the bot retires the hidden item'
);
select is(
  public.apply_system_event(:'items',
    tests.item_status_event('91000000-0000-4000-8000-000000000064', 'user_item.retired', :drill)),
  '{"outcome": "unchanged", "versions": {}}'::jsonb,
  '... retiring it again returns unchanged'
);
select is(
  (select status from public.user_items where user_id = :'items' and item_id = :drill), 'retired',
  '... and the item is retired'
);
select results_eq(
  format(
    $$select type, source, actor_id::text, track_id, item_id from public.events
      where user_id = %L and type in ('user_item.hidden', 'user_item.retired') order by type$$,
    :'items'),
  format(
    $$values ('user_item.hidden'::text, 'system'::text, %1$L::text, 'dsa'::text, %2$L::text),
             ('user_item.retired', 'bot', %1$L, 'dsa', %2$L)$$,
    :'items', :drill),
  '... one user_item.hidden (the learner''s) and one user_item.retired event'
);
select is(
  tests.sys_error(:'items',
    tests.item_status_event('91000000-0000-4000-8000-000000000065', 'user_item.hidden', :drill,
      :'items')),
  'invalid_transition', 'a retired item cannot be hidden'
);
select results_eq(
  format(
    $$select tests.sys_error(%1$L, e.event)
      from (values
        (1, tests.item_status_event(gen_random_uuid()::text, 'user_item.retired',
              'user:' || %3$L || ':old-1')),
        (2, tests.item_status_event(gen_random_uuid()::text, 'user_item.hidden',
              'user:' || %2$L || ':ah-day-2', %4$L)),
        (3, tests.item_status_event(gen_random_uuid()::text, 'user_item.hidden',
              'user:' || %2$L || ':ah-day-2') || '{"source": "bot"}'),
        (4, tests.item_status_event(gen_random_uuid()::text, 'user_item.retired',
              'user:' || %2$L || ':ah-day-2')
              || '{"payload": {"itemType": "prompt"}}')
      ) as e (n, event)
      order by e.n$$,
    :'items', :'items_ref', :'full_ref', :'items_full'),
  $$select 'invalid_event'::text from generate_series(1, 4)$$,
  'another user''s item, a hide by another actor or by the bot, or another itemType → '
  'invalid_event'
);

-- ---------------------------------------------------------------------------------------------
-- 7. roadmap.override_set / roadmap.override_revoked (§6.4.5, decision 18).
-- ---------------------------------------------------------------------------------------------
select is(
  public.apply_system_event(:'ovr',
    tests.ovr_event('91000000-0000-4000-8000-000000000071', 'ib-one', 'insert_block',
      tests.ib_params(tests.d(7))),
    tests.ovr_changes(tests.d(7))),
  '{"outcome": "applied", "versions": {}}'::jsonb,
  'roadmap.override_set of a new insert_block returns applied'
);
select results_eq(
  format(
    $$select track_id, key, kind, params, status, start_local_day, until_local_day, study_days,
             created_by_run, revoked_at
      from public.roadmap_overrides where user_id = %L$$, :'ovr'),
  format(
    $$values ('dsa'::text, 'ib-one'::text, 'insert_block'::text, tests.ib_params(%1$L),
              'active'::text, %2$L::date, %1$L::date, null::integer, 'run_2001-01-01'::text,
              null::timestamptz)$$,
    tests.d(7), :'today'),
  '... stores it active, started on the event''s local day'
);
select results_eq(
  format(
    $$select type, source, track_id, payload from public.events where user_id = %L$$, :'ovr'),
  format(
    $$values ('roadmap.override_set'::text, 'bot'::text, 'dsa'::text,
              jsonb_build_object('key', 'ib-one', 'kind', 'insert_block',
                'params', tests.ib_params(%L)))$$,
    tests.d(7)),
  '... with one roadmap.override_set event'
);
select is(
  public.apply_system_event(:'ovr',
    tests.ovr_event('91000000-0000-4000-8000-000000000072', 'ib-one', 'insert_block',
      tests.ib_params(tests.d(7))),
    tests.ovr_changes(tests.d(7))),
  '{"outcome": "unchanged", "versions": {}}'::jsonb,
  'the same key, kind and params while active returns unchanged'
);
select is(
  public.apply_system_event(:'ovr',
    tests.ovr_event('91000000-0000-4000-8000-000000000073', 'ib-one', 'insert_block',
      tests.ib_params(tests.d(10), 20)),
    tests.ovr_changes(tests.d(10))),
  '{"outcome": "applied", "versions": {}}'::jsonb,
  'the same key with other params is upserted'
);
select results_eq(
  format(
    $$select count(*)::integer, min(params ->> 'minutes'), min(until_local_day)
      from public.roadmap_overrides where user_id = %L$$, :'ovr'),
  format($$values (1, '20'::text, %L::date)$$, tests.d(10)),
  '... one row, with the new params and until'
);
select is(
  (select count(*)::integer from public.events
   where user_id = :'ovr' and type = 'roadmap.override_set'),
  2, '... two roadmap.override_set events in all (unchanged stores none)'
);
select results_eq(
  format(
    $$select tests.sys_error(%1$L, e.event, e.changes)
      from (values
        (1, tests.ovr_event(gen_random_uuid()::text, 'ib-far', 'insert_block',
              tests.ib_params(tests.d(15))), tests.ovr_changes(tests.d(15))),
        (2, tests.ovr_event(gen_random_uuid()::text, 'ib-past', 'insert_block',
              tests.ib_params(tests.d(-1))), tests.ovr_changes(tests.d(-1))),
        (3, tests.ovr_event(gen_random_uuid()::text, 'ew-six', 'extra_week', tests.ew_params(6)),
         tests.ovr_changes(null, 6)),
        (4, tests.ovr_event(gen_random_uuid()::text, 'ib-no-until', 'insert_block',
              tests.ib_params(tests.d(3))), tests.ovr_changes()),
        (5, tests.ovr_event(gen_random_uuid()::text, 'ew-until', 'extra_week', tests.ew_params()),
         tests.ovr_changes(tests.d(3), 2)),
        (6, tests.ovr_event(gen_random_uuid()::text, 'IB', 'insert_block',
              tests.ib_params(tests.d(3))), tests.ovr_changes(tests.d(3))),
        (7, tests.ovr_event(gen_random_uuid()::text, 'xx-kind', 'skip_topic', '{}'),
         tests.ovr_changes()),
        (8, tests.ovr_event(gen_random_uuid()::text, 'ib-nolimit', 'insert_block',
              tests.ib_params(tests.d(3))) - 'limits', tests.ovr_changes(tests.d(3))),
        (9, tests.ovr_event(gen_random_uuid()::text, 'ib-src', 'insert_block',
              tests.ib_params(tests.d(3))) || '{"source": "system"}',
         tests.ovr_changes(tests.d(3)))
      ) as e (n, event, changes)
      order by e.n$$,
    :'ovr'),
  $$select 'invalid_event'::text from generate_series(1, 9)$$,
  'an until more than 14 days ahead or before today, 6 study days, an insert_block without '
  'until, an extra_week with one, a bad key, an unknown kind, no limits or another source → '
  'invalid_event'
);
select is(
  tests.sys_error(:'ovr',
    tests.ovr_event('91000000-0000-4000-8000-000000000074', 'ib-en', 'insert_block',
      tests.ib_params(tests.d(3)), p_track => 'english'),
    tests.ovr_changes(tests.d(3))),
  'not_enrolled', 'a track the user is not enrolled in → not_enrolled'
);
select is(
  tests.sys_error(:'flag_off',
    tests.ovr_event('91000000-0000-4000-8000-000000000075', 'ib-one', 'insert_block',
      tests.ib_params(tests.d(3))),
    tests.ovr_changes(tests.d(3))),
  'ai_off', 'the AI flag off → ai_off'
);

-- The learner revokes it; the bot may not set a revoked key again.
select is(
  public.apply_system_event(:'ovr',
    tests.revoke_event('91000000-0000-4000-8000-000000000076', 'ib-one', 'insert_block', :'ovr')),
  '{"outcome": "applied", "versions": {}}'::jsonb,
  'the learner revokes the override'
);
select results_eq(
  format(
    $$select status, revoked_at, revoked_by from public.roadmap_overrides where user_id = %L$$,
    :'ovr'),
  $$values ('revoked'::text, now(), 'learner'::text)$$,
  '... which is revoked now, by the learner'
);
select is(
  public.apply_system_event(:'ovr',
    tests.revoke_event('91000000-0000-4000-8000-000000000077', 'ib-one', 'insert_block', :'ovr')),
  '{"outcome": "unchanged", "versions": {}}'::jsonb,
  '... revoking it again returns unchanged'
);
select is(
  tests.sys_error(:'ovr',
    tests.ovr_event('91000000-0000-4000-8000-000000000078', 'ib-one', 'insert_block',
      tests.ib_params(tests.d(3))),
    tests.ovr_changes(tests.d(3))),
  'revoked_key', 'setting a key the learner revoked → revoked_key'
);
select results_eq(
  format(
    $$select tests.sys_error(%1$L, e.event)
      from (values
        (1, tests.revoke_event(gen_random_uuid()::text, 'ib-none', 'insert_block', %1$L)),
        (2, tests.revoke_event(gen_random_uuid()::text, 'ib-one', 'extra_week', %1$L)),
        (3, tests.revoke_event(gen_random_uuid()::text, 'ib-one', 'insert_block', %2$L)),
        (4, tests.revoke_event(gen_random_uuid()::text, 'ib-one', 'insert_block', %1$L)
              || '{"source": "admin"}'),
        (5, tests.revoke_event(gen_random_uuid()::text, 'ib-one', 'insert_block', null)
              || jsonb_build_object('actor_id', %2$L))
      ) as e (n, event)
      order by e.n$$,
    :'ovr', :'ovr_cap'),
  $$select 'invalid_event'::text from generate_series(1, 5)$$,
  'revoking an unknown key, with another kind, by another actor, with another source or by the '
  'bot naming another actor → invalid_event'
);

-- The bot revokes too (ruling M6-R17): revoked_by bot; a key the bot revoked may be set again
-- (a new start); one the learner revoked may not; the bot's revoke needs the AI flag.
select is(
  public.apply_system_event(:'ovr_bot',
    tests.ovr_event('91000000-0000-4000-8000-0000000000b1', 'ib-bot', 'insert_block',
      tests.ib_params(tests.d(3))),
    tests.ovr_changes(tests.d(3))) ->> 'outcome',
  'applied', 'the bot sets an insert_block'
);
select is(
  public.apply_system_event(:'ovr_bot',
    tests.revoke_event('91000000-0000-4000-8000-0000000000b2', 'ib-bot', 'insert_block', null)),
  '{"outcome": "applied", "versions": {}}'::jsonb,
  '... and revokes it (source bot)'
);
select results_eq(
  format(
    $$select o.status, o.revoked_by, e.source, e.actor_id::text
      from public.roadmap_overrides o
      join public.events e on e.user_id = o.user_id and e.type = 'roadmap.override_revoked'
      where o.user_id = %1$L$$, :'ovr_bot'),
  format($$values ('revoked'::text, 'bot'::text, 'bot'::text, %L::text)$$, :'ovr_bot'),
  '... revoked by the bot, with one roadmap.override_revoked event from the bot'
);
select is(
  public.apply_system_event(:'ovr_bot',
    tests.ovr_event('91000000-0000-4000-8000-0000000000b3', 'ib-bot', 'insert_block',
      tests.ib_params(tests.d(4))),
    tests.ovr_changes(tests.d(4))) ->> 'outcome',
  'applied', 'a key the bot revoked may be set again'
);
select results_eq(
  format(
    $$select status, revoked_at, revoked_by, start_local_day, until_local_day
      from public.roadmap_overrides where user_id = %L$$, :'ovr_bot'),
  format($$values ('active'::text, null::timestamptz, null::text, %L::date, %L::date)$$,
    :'today', tests.d(4)),
  '... active again as a new start, revoked_at and revoked_by cleared'
);
select is(
  public.apply_system_event(:'ovr_bot',
    tests.revoke_event('91000000-0000-4000-8000-0000000000b4', 'ib-bot', 'insert_block',
      :'ovr_bot')) ->> 'outcome',
  'applied', 'the learner revokes it'
);
select is(
  tests.sys_error(:'ovr_bot',
    tests.ovr_event('91000000-0000-4000-8000-0000000000b5', 'ib-bot', 'insert_block',
      tests.ib_params(tests.d(3))),
    tests.ovr_changes(tests.d(3))),
  'revoked_key', '... after which setting it → revoked_key'
);
select is(
  tests.sys_error(:'flag_off',
    tests.revoke_event('91000000-0000-4000-8000-0000000000b6', 'ib-one', 'insert_block', null)),
  'ai_off', 'the bot''s revoke with the AI flag off → ai_off'
);
select throws_ok(
  format($$update public.roadmap_overrides set status = 'active'
           where user_id = %L and key = 'ib-one'$$, :'ovr'),
  '23514', null, 'revoked_by is null unless the override is revoked'
);

-- A key keeps its kind (§6.4.5: idempotent by (trackId, key)), so a kind change cannot dodge
-- the extra_week cooldown.
select is(
  public.apply_system_event(:'ovr_kind',
    tests.ovr_event('91000000-0000-4000-8000-0000000000c1', 'ew-k', 'extra_week',
      tests.ew_params()),
    tests.ovr_changes(null, 2)) ->> 'outcome',
  'applied', 'the bot sets an extra_week K'
);
select is(
  tests.sys_error(:'ovr_kind',
    tests.ovr_event('91000000-0000-4000-8000-0000000000c2', 'ew-k', 'reorder_topics',
      '{"order": ["trees"]}'),
    tests.ovr_changes()),
  'invalid_event', '... re-setting K as a reorder_topics → invalid_event'
);
select is(
  public.apply_system_event(:'ovr_kind',
    tests.revoke_event('91000000-0000-4000-8000-0000000000c3', 'ew-k', 'extra_week', null))
    ->> 'outcome',
  'applied', '... the bot revokes K'
);
select is(
  tests.sys_error(:'ovr_kind',
    tests.ovr_event('91000000-0000-4000-8000-0000000000c4', 'ew-j', 'extra_week',
      tests.ew_params()),
    tests.ovr_changes(null, 2)),
  'cooldown', '... and an extra_week J within 21 days of K''s start → cooldown'
);
select is(
  tests.sys_error(:'ovr_kind',
    tests.ovr_event('91000000-0000-4000-8000-0000000000c5', 'ew-k', 'extra_week',
      tests.ew_params()),
    tests.ovr_changes(null, 2)),
  'cooldown', '... as is setting K again (the bot revoked it, but its start is recent)'
);

-- ≤ 3 active per track; an expired insert_block does not count.
insert into public.roadmap_overrides
  (user_id, track_id, key, kind, params, until_local_day, start_local_day, created_by_run)
values (:'ovr', 'dsa', 'ib-old', 'insert_block', tests.ib_params(tests.d(-1)), tests.d(-1)::date,
        tests.d(-5)::date, 'run_2001-01-01');
select results_eq(
  format(
    $$select public.apply_system_event(%1$L, e.event, e.changes) ->> 'outcome'
      from (values
        (1, tests.ovr_event(gen_random_uuid()::text, 'ib-a', 'insert_block',
              tests.ib_params(tests.d(3))), tests.ovr_changes(tests.d(3))),
        (2, tests.ovr_event(gen_random_uuid()::text, 'ib-b', 'insert_block',
              tests.ib_params(tests.d(4))), tests.ovr_changes(tests.d(4))),
        (3, tests.ovr_event(gen_random_uuid()::text, 'rt-c', 'reorder_topics',
              '{"order": ["trees", "linked-list"]}'), tests.ovr_changes())
      ) as e (n, event, changes)
      order by e.n$$,
    :'ovr'),
  $$values ('applied'), ('applied'), ('applied')$$,
  'three active overrides in the track are applied (the expired insert_block does not count)'
);
select is(
  tests.sys_error(:'ovr',
    tests.ovr_event('91000000-0000-4000-8000-000000000079', 'ib-d', 'insert_block',
      tests.ib_params(tests.d(3))),
    tests.ovr_changes(tests.d(3))),
  'limit_reached', '... and the fourth → limit_reached'
);
select is(
  (select count(*)::integer from public.roadmap_overrides where user_id = :'ovr' and key = 'ib-d'),
  0, '... which stores nothing'
);

-- perTrack 2 → the third is refused; a perTrack of 5 is clamped to 3.
select results_eq(
  format(
    $$select tests.sys_error(%1$L, e.event, e.changes)
      from (values
        (1, tests.ovr_event(gen_random_uuid()::text, 'ib-a', 'insert_block',
              tests.ib_params(tests.d(3)), '{"perTrack": 2}'), tests.ovr_changes(tests.d(3))),
        (2, tests.ovr_event(gen_random_uuid()::text, 'ib-b', 'insert_block',
              tests.ib_params(tests.d(3)), '{"perTrack": 2}'), tests.ovr_changes(tests.d(3))),
        (3, tests.ovr_event(gen_random_uuid()::text, 'ib-c', 'insert_block',
              tests.ib_params(tests.d(3)), '{"perTrack": 2}'), tests.ovr_changes(tests.d(3))),
        (4, tests.ovr_event(gen_random_uuid()::text, 'ib-c', 'insert_block',
              tests.ib_params(tests.d(3)), '{"perTrack": 5}'), tests.ovr_changes(tests.d(3))),
        (5, tests.ovr_event(gen_random_uuid()::text, 'ib-d', 'insert_block',
              tests.ib_params(tests.d(3)), '{"perTrack": 5}'), tests.ovr_changes(tests.d(3)))
      ) as e (n, event, changes)
      order by e.n$$,
    :'ovr_cap'),
  $$values ('no error'), ('no error'), ('limit_reached'), ('no error'), ('limit_reached')$$,
  'with perTrack 2 the third → limit_reached; a perTrack of 5 allows a third, not a fourth'
);

-- extra_week (decision 18): used by the plans dated on or after its start whose snapshot names
-- it; a plan before its start is not counted. One active per track.
insert into public.roadmap_overrides
  (id, user_id, track_id, key, kind, params, study_days, start_local_day, created_by_run)
values ('91000000-0000-4000-8000-0000000000e1', :'ovr_ew', 'dsa', 'ew-old', 'extra_week',
        tests.ew_params(), 2, tests.d(-25)::date, 'run_2001-01-01');
insert into public.day_plans (user_id, plan_date, blocks, roadmap_weeks) values
  (:'ovr_ew', tests.d(-26)::date, tests.blocks(tests.d(-26), 30), tests.weeks(2, 'ew-old')),
  (:'ovr_ew', tests.d(-24)::date, tests.blocks(tests.d(-24), 30), tests.weeks(2, 'ew-old')),
  (:'ovr_ew', tests.d(-22)::date, tests.blocks(tests.d(-22), 30), tests.weeks(2, 'ew-other'));
select ok(
  (select public.roadmap_override_active(o, :'today'::date) from public.roadmap_overrides o
   where o.id = '91000000-0000-4000-8000-0000000000e1'),
  'an extra_week of 2 study days named by one plan since its start (and one before it) is active'
);
select is(
  tests.sys_error(:'ovr_ew',
    tests.ovr_event('91000000-0000-4000-8000-000000000081', 'ew-new', 'extra_week',
      tests.ew_params()),
    tests.ovr_changes(null, 2)),
  'limit_reached', '... so a second extra_week in the track → limit_reached'
);
insert into public.day_plans (user_id, plan_date, blocks, roadmap_weeks) values
  (:'ovr_ew', tests.d(-23)::date, tests.blocks(tests.d(-23), 30), tests.weeks(2, 'ew-old'));
select ok(
  not (select public.roadmap_override_active(o, :'today'::date) from public.roadmap_overrides o
       where o.id = '91000000-0000-4000-8000-0000000000e1'),
  'named by two plans since its start, it has expired'
);
select is(
  public.apply_system_event(:'ovr_ew',
    tests.ovr_event('91000000-0000-4000-8000-000000000082', 'ew-new', 'extra_week',
      tests.ew_params()),
    tests.ovr_changes(null, 2)) ->> 'outcome',
  'applied', '... so a new extra_week is applied (its start is over 21 days ago)'
);
select results_eq(
  format(
    $$select public.roadmap_override_active(o, %L::date) from public.roadmap_overrides o
      where o.user_id = %L order by o.key$$, :'today', :'ovr_cap'),
  $$values (true), (true), (true)$$,
  'insert_blocks until a later day are active'
);
select ok(
  not (select public.roadmap_override_active(o, :'today'::date) from public.roadmap_overrides o
       where o.user_id = :'ovr' and o.key = 'ib-old'),
  '... an insert_block until yesterday is not'
);
select ok(
  (select public.roadmap_override_active(o, (tests.d(10))::date) from public.roadmap_overrides o
   where o.user_id = :'ovr' and o.key = 'ib-b') is false
  and (select public.roadmap_override_active(o, (tests.d(4))::date) from public.roadmap_overrides o
       where o.user_id = :'ovr' and o.key = 'ib-b'),
  '... and one is active through its until day, not after it'
);
select ok(
  not (select public.roadmap_override_active(o, :'today'::date) from public.roadmap_overrides o
       where o.user_id = :'ovr' and o.key = 'ib-one'),
  '... and a revoked override is not active'
);

-- The 21-day cooldown: a new key after an extra_week started 10 days ago (even revoked).
insert into public.roadmap_overrides
  (user_id, track_id, key, kind, params, study_days, start_local_day, created_by_run, status,
   revoked_at)
values (:'ovr_cool', 'dsa', 'ew-recent', 'extra_week', tests.ew_params(1), 1, tests.d(-10)::date,
        'run_2001-01-01', 'revoked', now());
select is(
  tests.sys_error(:'ovr_cool',
    tests.ovr_event('91000000-0000-4000-8000-000000000083', 'ew-other', 'extra_week',
      tests.ew_params()),
    tests.ovr_changes(null, 2)),
  'cooldown', 'a new extra_week key within 21 days of the track''s last start → cooldown'
);

-- ... and a re-set of an expired key is a new start, refused within 21 days of its previous one.
insert into public.roadmap_overrides
  (user_id, track_id, key, kind, params, study_days, start_local_day, created_by_run)
values (:'ovr_reset', 'dsa', 'ew-used', 'extra_week', tests.ew_params(1), 1, tests.d(-10)::date,
        'run_2001-01-01');
insert into public.day_plans (user_id, plan_date, blocks, roadmap_weeks) values
  (:'ovr_reset', tests.d(-9)::date, tests.blocks(tests.d(-9), 30), tests.weeks(2, 'ew-used'));
select is(
  tests.sys_error(:'ovr_reset',
    tests.ovr_event('91000000-0000-4000-8000-000000000084', 'ew-used', 'extra_week',
      tests.ew_params(1)),
    tests.ovr_changes(null, 1)),
  'cooldown', 're-setting a used extra_week key within 21 days of its start → cooldown'
);
update public.roadmap_overrides set start_local_day = tests.d(-21)::date
where user_id = :'ovr_reset' and key = 'ew-used';
update public.day_plans set plan_date = tests.d(-20)::date where user_id = :'ovr_reset';
select is(
  public.apply_system_event(:'ovr_reset',
    tests.ovr_event('91000000-0000-4000-8000-000000000085', 'ew-used', 'extra_week',
      tests.ew_params(1)),
    tests.ovr_changes(null, 1)) ->> 'outcome',
  'applied', '... and applied 21 days after it, as a new start'
);
select results_eq(
  format(
    $$select status, start_local_day, public.roadmap_override_active(o, %L::date)
      from public.roadmap_overrides o where o.user_id = %L$$, :'today', :'ovr_reset'),
  format($$values ('active'::text, %L::date, true)$$, :'today'),
  '... which starts today and is active again'
);

-- ---------------------------------------------------------------------------------------------
-- 8. bot_settings.dry_run on → invalid_event for every bot write type (decision 8).
-- ---------------------------------------------------------------------------------------------
update public.bot_settings set dry_run = true;
select results_eq(
  format(
    $$select tests.sys_error(%1$L,
        tests.ai_event(gen_random_uuid()::text, 'run_2001-01-01', %3$L),
        tests.ai_changes(%3$L, 45, '91000000-0000-4000-8000-00000000f001'))
      union all
      select tests.sys_error(%1$L,
        tests.item_event(gen_random_uuid()::text, %2$L, 'dry-item'), tests.item_changes())
      union all
      select tests.sys_error(%1$L,
        tests.ovr_event(gen_random_uuid()::text, 'ib-dry', 'insert_block',
          tests.ib_params(tests.d(3))), tests.ovr_changes(tests.d(3)))
      union all
      select tests.sys_error(%1$L,
        tests.revoke_event(gen_random_uuid()::text, 'ib-dry', 'insert_block', null))$$,
    :'items', :'items_ref', :'today'),
  $$values ('invalid_event'), ('invalid_event'), ('invalid_event'), ('invalid_event')$$,
  'with bot_settings.dry_run on, plan.ai_proposed, user_item.created, roadmap.override_set and '
  'the bot''s roadmap.override_revoked → invalid_event'
);

select * from finish();
rollback;
