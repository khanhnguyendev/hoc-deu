begin;
set client_min_messages = warning;
create extension if not exists pgtap with schema extensions;
\ir _helpers.psql

select plan(62);

-- A learner event as the app sends it (lib/events/apply.ts): snake_case keys, rules_version 1 —
-- an older client's; the events trigger stores the current rules_version() (3, task 5.0b).
create function tests.event(
  p_id text, p_type text, p_track text default null, p_payload jsonb default '{}'::jsonb
) returns jsonb language sql immutable as $$
  select jsonb_strip_nulls(jsonb_build_object('id', p_id, 'type', p_type, 'track_id', p_track))
    || jsonb_build_object('payload', p_payload, 'rules_version', 1)
$$;
grant execute on function tests.event(text, text, text, jsonb) to anon, authenticated, service_role;

select tests.create_user('apply-learner@hocdeu.test') as learner \gset
select tests.create_user('apply-other@hocdeu.test') as other \gset
select tests.create_user('apply-pending@hocdeu.test', 'pending') as pending \gset
select tests.create_user('apply-schedule@hocdeu.test') as schedule_user \gset
select tests.create_user('apply-settings@hocdeu.test') as settings_user \gset
select tests.create_user('apply-quota@hocdeu.test') as quota_user \gset

-- 1. track.enrolled creates the user_tracks row and exactly one event, recorded as the learner's.
select tests.authenticate_as(:'learner');
select is(
  public.apply_event(tests.event(
    '40000000-0000-4000-8000-000000000001', 'track.enrolled', 'dsa',
    '{"roadmapVariant": "10w", "budgetMinutes": 60, "startDate": "2026-09-25"}'
  )),
  '{"outcome": "applied", "versions": {}}'::jsonb,
  'track.enrolled returns applied'
);
select results_eq(
  $$select track_id, roadmap_variant, budget_minutes, start_date, status from public.user_tracks$$,
  $$values ('dsa'::text, '10w'::text, 60, '2026-09-25'::date, 'active'::text)$$,
  'it creates the user_tracks row, active'
);
select results_eq(
  $$select id, type, track_id, source, actor_id, rules_version from public.events$$,
  format(
    $$values ('40000000-0000-4000-8000-000000000001'::uuid, 'track.enrolled'::text, 'dsa'::text,
              'learner'::text, %L::uuid, 3)$$,
    :'learner'
  ),
  'and exactly one event: source learner, actor_id the user, the current rules_version'
);

-- 2. Idempotent retries: the same id is a no-op; an id another user already used is a conflict.
--    Neither consumes quota (the id is checked before the insert, whose quota trigger fires even
--    when the insert then conflicts).
select is(
  public.apply_event(tests.event(
    '40000000-0000-4000-8000-000000000001', 'track.enrolled', 'dsa',
    '{"roadmapVariant": "10w", "budgetMinutes": 90, "startDate": "2026-09-25"}'
  )),
  '{"outcome": "duplicate", "versions": {}}'::jsonb,
  'the same event id again returns duplicate'
);
select is((select count(*)::int from public.events), 1, '... still one event');
select is(
  (select budget_minutes from public.user_tracks where track_id = 'dsa'),
  60,
  '... and the retry''s changed budgetMinutes does not change the row'
);
select tests.clear_authentication();
select is(
  (select count from public.event_quota where user_id = :'learner'),
  1,
  '... and the duplicate leaves event_quota.count unchanged'
);

select tests.authenticate_as(:'other');
select is(
  public.apply_event(tests.event(
    '40000000-0000-4000-8000-000000000002', 'track.enrolled', 'english',
    '{"roadmapVariant": "10w", "budgetMinutes": 30, "startDate": "2026-09-25"}'
  )),
  '{"outcome": "applied", "versions": {}}'::jsonb,
  'another user records an event'
);
select tests.authenticate_as(:'learner');
select throws_ok(
  $$select public.apply_event(tests.event(
      '40000000-0000-4000-8000-000000000002', 'track.enrolled', 'english',
      '{"roadmapVariant": "10w", "budgetMinutes": 45, "startDate": "2026-09-25"}'))$$,
  'P0001', 'id_conflict',
  'an id already used by another user''s event raises id_conflict'
);
select is(
  (select count(*)::int from public.user_tracks where track_id = 'english'),
  0,
  '... and the learner has no english track'
);
select tests.clear_authentication();
select results_eq(
  $$select e.user_id, t.budget_minutes
    from public.events e join public.user_tracks t on t.user_id = e.user_id and t.track_id = e.track_id
    where e.id = '40000000-0000-4000-8000-000000000002'$$,
  format($$values (%L::uuid, 30)$$, :'other'),
  '... the other user''s event and track are unchanged'
);
select is(
  (select count from public.event_quota where user_id = :'learner'),
  1,
  '... and the conflicting call leaves event_quota.count unchanged'
);

-- 3. Only the caller's own events; only signed-in callers.
select tests.authenticate_as(:'learner');
select throws_ok(
  format(
    $$select public.apply_event(tests.event(gen_random_uuid()::text, 'track.paused', 'dsa')
        || jsonb_build_object('user_id', %L::text))$$,
    :'other'
  ),
  '42501', 'forbidden', 'p_event.user_id of another user raises forbidden'
);
select is(
  public.apply_event(
    tests.event(gen_random_uuid()::text, 'track.updated', 'dsa', '{"budgetMinutes": 60}')
      || jsonb_build_object('user_id', upper(auth.uid()::text))
  ),
  '{"outcome": "applied", "versions": {}}'::jsonb,
  'p_event.user_id of the caller (in any letter case) is accepted'
);
select tests.clear_authentication();
set local role anon;
select throws_ok(
  $$select public.apply_event('{}'::jsonb)$$,
  '42501', 'permission denied for function apply_event', 'anon cannot execute apply_event'
);
select tests.clear_authentication();
set local role authenticated;
select throws_ok(
  $$select public.apply_event(tests.event(gen_random_uuid()::text, 'track.paused', 'dsa'))$$,
  '42501', 'not_authenticated', 'without a user id in the JWT, apply_event raises not_authenticated'
);

-- 4. Learner types only, with the keys their type needs (4.9b: every learner type is applied, and
--    p_changes / p_expected must match the type's derived tables); active users only.
select tests.authenticate_as(:'learner');
select throws_ok(
  $$select public.apply_event(tests.event(
      gen_random_uuid()::text, 'admin.user_approved', null,
      jsonb_build_object('targetUserId', auth.uid()::text, 'from', 'pending', 'to', 'active')))$$,
  'P0001', 'invalid_event', 'admin.user_approved raises invalid_event'
);
select throws_ok(
  $$select public.apply_event(jsonb_build_object('id', gen_random_uuid(), 'payload', '{}'::jsonb))$$,
  'P0001', 'invalid_event', 'an event without a type raises invalid_event'
);
select throws_ok(
  $$select public.apply_event(tests.event('not-a-uuid', 'track.paused', 'dsa'))$$,
  'P0001', 'invalid_event', 'an id that is not a uuid raises invalid_event'
);
select throws_ok(
  $$select public.apply_event(tests.event(gen_random_uuid()::text, 'track.paused'))$$,
  'P0001', 'invalid_event', 'a track event without track_id raises invalid_event'
);
select throws_ok(
  $$select public.apply_event(tests.event(
      gen_random_uuid()::text, 'item.result', null, '{"result": "solved"}'))$$,
  'P0001', 'invalid_event', 'item.result without item_id raises invalid_event'
);
select throws_ok(
  $$select public.apply_event(tests.event(gen_random_uuid()::text, 'track.reset', 'english'))$$,
  'P0001', 'track_not_enrolled', 'track.reset on a track not enrolled raises track_not_enrolled'
);
select throws_ok(
  $$select public.apply_event(
      tests.event(gen_random_uuid()::text, 'track.paused', 'dsa'),
      '[{"table": "item_state"}]'::jsonb)$$,
  'P0001', 'invalid_event', 'a p_changes entry on track.paused (no derived table) raises invalid_event'
);
select throws_ok(
  $$select public.apply_event(
      tests.event(gen_random_uuid()::text, 'track.paused', 'dsa'),
      p_expected => '{"item_state:x": 1}'::jsonb)$$,
  'P0001', 'invalid_event', 'a p_expected key without its change raises invalid_event'
);
select tests.authenticate_as(:'pending');
select throws_ok(
  $$select public.apply_event(tests.event(
      gen_random_uuid()::text, 'track.enrolled', 'dsa',
      '{"roadmapVariant": "10w", "budgetMinutes": 60, "startDate": "2026-09-25"}'))$$,
  '42501', 'inactive', 'a pending user raises inactive'
);

-- 5. track.updated changes only the keys present; a track that is not enrolled is an error that
--    leaves no event behind.
select tests.authenticate_as(:'learner');
select is(
  public.apply_event(tests.event(
    '40000000-0000-4000-8000-000000000005', 'track.updated', 'dsa', '{"budgetMinutes": 90}'
  )),
  '{"outcome": "applied", "versions": {}}'::jsonb,
  'track.updated {budgetMinutes: 90} returns applied'
);
select results_eq(
  $$select roadmap_variant, budget_minutes, start_date, status, new_per_day, throttle,
           weekly_template, include_bonus
    from public.user_tracks where track_id = 'dsa'$$,
  $$values ('10w'::text, 90, '2026-09-25'::date, 'active'::text, null::int, null::jsonb,
            null::jsonb, false)$$,
  '... and changes only budget_minutes'
);
select is(
  public.apply_event(tests.event(
    gen_random_uuid()::text, 'track.updated', 'dsa',
    '{"roadmapVariant": "12w", "newPerDay": 2, "throttle": [{"dueAbove": 30, "newPerDay": 1}],
      "weeklyTemplate": {"sat": 90}, "includeBonus": true}'
  )),
  '{"outcome": "applied", "versions": {}}'::jsonb,
  'track.updated with every other key returns applied'
);
select results_eq(
  $$select roadmap_variant, budget_minutes, new_per_day, throttle, weekly_template, include_bonus
    from public.user_tracks where track_id = 'dsa'$$,
  $$values ('12w'::text, 90, 2, '[{"dueAbove": 30, "newPerDay": 1}]'::jsonb, '{"sat": 90}'::jsonb,
            true)$$,
  '... and sets each of them, keeping budget_minutes'
);
select lives_ok(
  $$select public.apply_event(tests.event(
      gen_random_uuid()::text, 'track.updated', 'dsa',
      '{"newPerDay": null, "throttle": null, "weeklyTemplate": null}'))$$,
  'track.updated with null values runs'
);
select results_eq(
  $$select roadmap_variant, new_per_day, throttle, weekly_template, include_bonus
    from public.user_tracks where track_id = 'dsa'$$,
  $$values ('12w'::text, null::int, null::jsonb, null::jsonb, true)$$,
  '... and resets those keys to the track default (SQL null)'
);
select throws_ok(
  $$select public.apply_event(tests.event(
      '40000000-0000-4000-8000-000000000006', 'track.updated', 'english', '{"budgetMinutes": 30}'))$$,
  'P0001', 'track_not_enrolled', 'track.updated on a track not enrolled raises track_not_enrolled'
);
select is(
  (select count(*)::int from public.events where id = '40000000-0000-4000-8000-000000000006'),
  0,
  '... and no event row remains'
);

-- 6. Status transitions: active -> paused -> active -> removed; anything else is an error.
select is(
  public.apply_event(tests.event(gen_random_uuid()::text, 'track.paused', 'dsa')),
  '{"outcome": "applied", "versions": {}}'::jsonb,
  'track.paused returns applied'
);
select is(
  (select status from public.user_tracks where track_id = 'dsa'), 'paused', '... and pauses the track'
);
select throws_ok(
  $$select public.apply_event(tests.event(gen_random_uuid()::text, 'track.paused', 'dsa'))$$,
  'P0001', 'invalid_transition', 'pausing a paused track raises invalid_transition'
);
select is(
  public.apply_event(tests.event(
    gen_random_uuid()::text, 'track.resumed', 'dsa', '{"pausedDays": 3}'
  )),
  '{"outcome": "applied", "versions": {}}'::jsonb,
  'track.resumed returns applied'
);
select is(
  (select status from public.user_tracks where track_id = 'dsa'), 'active', '... and resumes it'
);
select throws_ok(
  $$select public.apply_event(tests.event(
      gen_random_uuid()::text, 'track.resumed', 'dsa', '{"pausedDays": 0}'))$$,
  'P0001', 'invalid_transition', 'resuming an active track raises invalid_transition'
);
select is(
  public.apply_event(tests.event(gen_random_uuid()::text, 'track.removed', 'dsa')),
  '{"outcome": "applied", "versions": {}}'::jsonb,
  'track.removed returns applied'
);
select is(
  (select status from public.user_tracks where track_id = 'dsa'), 'removed', '... and removes it'
);
select throws_ok(
  $$select public.apply_event(tests.event(gen_random_uuid()::text, 'track.removed', 'dsa'))$$,
  'P0001', 'invalid_transition', 'removing a removed track raises invalid_transition'
);
select throws_ok(
  $$select public.apply_event(tests.event(gen_random_uuid()::text, 'track.paused', 'english'))$$,
  'P0001', 'track_not_enrolled', 'pausing a track not enrolled raises track_not_enrolled'
);
select lives_ok(
  $$select public.apply_event(tests.event(
      gen_random_uuid()::text, 'track.enrolled', 'dsa',
      '{"roadmapVariant": "14w", "budgetMinutes": 45, "startDate": "2026-10-01"}'))$$,
  'enrolling a removed track again runs'
);
select results_eq(
  $$select roadmap_variant, budget_minutes, start_date, status
    from public.user_tracks where track_id = 'dsa'$$,
  $$values ('14w'::text, 45, '2026-10-01'::date, 'active'::text)$$,
  '... and makes it active with the new settings (one row)'
);

-- 7. schedule.changed upserts the version for effectiveAt; the history and time-zone triggers
--    still apply, and their errors leave no event behind. (Before onboarding a learner's version
--    takes effect at most 5 minutes ahead, 4.12: the pending versions here lie minutes ahead.)
select tests.authenticate_as(:'schedule_user');
select is(
  public.apply_event(tests.event(
    gen_random_uuid()::text, 'schedule.changed', null,
    jsonb_build_object(
      'timezone', 'Asia/Tokyo', 'dayStartsAt', '05:00', 'effectiveAt', now() + interval '1 minute'
    )
  )),
  '{"outcome": "applied", "versions": {}}'::jsonb,
  'schedule.changed returns applied'
);
select results_eq(
  $$select effective_at, timezone, day_starts_at from public.schedule_versions$$,
  $$values (now() + interval '1 minute', 'Asia/Tokyo'::text, '05:00'::time)$$,
  '... and inserts the version'
);
select is(
  public.apply_event(tests.event(
    gen_random_uuid()::text, 'schedule.changed', null,
    jsonb_build_object(
      'timezone', 'Europe/Berlin', 'dayStartsAt', '06:30',
      'effectiveAt', now() + interval '1 minute'
    )
  )),
  '{"outcome": "applied", "versions": {}}'::jsonb,
  'a second change with the same effectiveAt returns applied'
);
select results_eq(
  $$select effective_at, timezone, day_starts_at from public.schedule_versions$$,
  $$values (now() + interval '1 minute', 'Europe/Berlin'::text, '06:30'::time)$$,
  '... and replaces the first (one row)'
);
select throws_ok(
  $$select public.apply_event(tests.event(
      '40000000-0000-4000-8000-000000000007', 'schedule.changed', null,
      jsonb_build_object(
        'timezone', 'Mars/Base', 'dayStartsAt', '05:00',
        'effectiveAt', now() + interval '2 minutes')))$$,
  'P0001', 'invalid_timezone', 'timezone Mars/Base raises invalid_timezone'
);
select is(
  (select count(*)::int from public.events where id = '40000000-0000-4000-8000-000000000007'),
  0,
  '... and no event row remains'
);
select throws_ok(
  $$select public.apply_event(tests.event(
      gen_random_uuid()::text, 'schedule.changed', null,
      jsonb_build_object(
        'timezone', 'Asia/Tokyo', 'dayStartsAt', '05:00', 'effectiveAt', now() - interval '1 day')))$$,
  'P0001', 'schedule_backdated', 'a later version in the past raises schedule_backdated'
);

-- 8. settings.changed updates the profile columns for the keys present; theme is ignored.
select tests.authenticate_as(:'settings_user');
select is(
  public.apply_event(tests.event(
    gen_random_uuid()::text, 'settings.changed', null, '{"codeLanguage": "go"}'
  )),
  '{"outcome": "applied", "versions": {}}'::jsonb,
  'settings.changed {codeLanguage: go} returns applied'
);
select results_eq(
  $$select code_language, share_notes_with_ai from public.profiles$$,
  $$values ('go'::text, false)$$,
  '... and updates code_language only'
);
select lives_ok(
  $$select public.apply_event(tests.event(
      gen_random_uuid()::text, 'settings.changed', null, '{"theme": "dark"}'))$$,
  'settings.changed {theme: dark} runs'
);
select results_eq(
  $$select code_language, share_notes_with_ai from public.profiles$$,
  $$values ('go'::text, false)$$,
  '... and changes nothing (theme stays client-side, decision 7)'
);
select throws_ok(
  $$select public.apply_event(tests.event(
      gen_random_uuid()::text, 'settings.changed', null, '{"shareNotesWithAi": true}'))$$,
  'P0001', 'ai_personalization_off',
  'settings.changed {shareNotesWithAi: true} without AI personalization raises ai_personalization_off'
);

-- 9. Learner events count against event_quota on the user's local day; a duplicate does not,
--    even once the quota is spent.
select tests.authenticate_as(:'quota_user');
select lives_ok(
  $sql$
    do $do$
    declare
      v_enrolled constant jsonb := tests.event(
        '40000000-0000-4000-8000-000000000009', 'track.enrolled', 'dsa',
        '{"roadmapVariant": "10w", "budgetMinutes": 60, "startDate": "2026-09-25"}');
    begin
      perform public.apply_event(v_enrolled);
      perform public.apply_event(tests.event(gen_random_uuid()::text, 'track.paused', 'dsa'));
      perform public.apply_event(tests.event(
        gen_random_uuid()::text, 'track.resumed', 'dsa', '{"pausedDays": 1}'));
      perform public.apply_event(v_enrolled);
    end $do$
  $sql$,
  'three learner events and a duplicate run'
);
select tests.clear_authentication();
select results_eq(
  format($$select local_day, count from public.event_quota where user_id = %L$$, :'quota_user'),
  format($$values (public.user_local_day(%L, now()), 3)$$, :'quota_user'),
  '... and event_quota counts 3 on the user''s local day'
);
update public.event_quota set count = 500 where user_id = :'quota_user';
select tests.authenticate_as(:'quota_user');
select throws_ok(
  $$select public.apply_event(tests.event(gen_random_uuid()::text, 'track.paused', 'dsa'))$$,
  'P0001', 'quota_exceeded', 'the 501st learner event of the day raises quota_exceeded'
);
select is(
  public.apply_event(tests.event(
    '40000000-0000-4000-8000-000000000009', 'track.enrolled', 'dsa',
    '{"roadmapVariant": "10w", "budgetMinutes": 60, "startDate": "2026-09-25"}'
  )),
  '{"outcome": "duplicate", "versions": {}}'::jsonb,
  '... but a retry of an event already recorded still returns duplicate'
);
select is(
  (select status from public.user_tracks where track_id = 'dsa'),
  'active',
  '... and the rejected pause changed nothing'
);

select * from finish();
rollback;
