begin;
set client_min_messages = warning;
create extension if not exists pgtap with schema extensions;
\ir _helpers.psql

select plan(69);

select tests.create_user('learner@hocdeu.test') as learner \gset
select tests.create_user('other@hocdeu.test') as other \gset
select tests.create_user('pending@hocdeu.test', 'pending') as pending \gset
select tests.create_user('history@hocdeu.test') as history \gset
select tests.create_user('tracks@hocdeu.test') as tracks \gset

-- 1. schedule_versions RLS: insert own while active; read own only.
select tests.authenticate_as(:'learner');
select lives_ok(
  $$insert into public.schedule_versions (user_id, effective_at) values (auth.uid(), now())$$,
  'an active user inserts a schedule version for themselves'
);
select results_eq(
  'select timezone, day_starts_at from public.schedule_versions',
  $$values ('Asia/Ho_Chi_Minh'::text, '04:00'::time)$$,
  'the defaults are Asia/Ho_Chi_Minh and 04:00'
);
select throws_ok(
  format(
    'insert into public.schedule_versions (user_id, effective_at) values (%L, now())', :'other'
  ),
  '42501',
  'new row violates row-level security policy for table "schedule_versions"',
  'an active user cannot insert a version for someone else'
);

select tests.authenticate_as(:'pending');
select throws_ok(
  $$insert into public.schedule_versions (user_id, effective_at) values (auth.uid(), now())$$,
  '42501',
  'new row violates row-level security policy for table "schedule_versions"',
  'a pending user cannot insert a schedule version'
);

select tests.authenticate_as(:'other');
select lives_ok(
  $$insert into public.schedule_versions (user_id, effective_at) values (auth.uid(), now())$$,
  'another active user inserts their own version'
);
select is(
  (select count(*)::int from public.schedule_versions),
  1,
  'another user''s schedule versions are invisible'
);
select lives_ok(
  format(
    $$update public.schedule_versions set day_starts_at = '05:00' where user_id = %L$$,
    :'learner'
  ),
  'an update of another user''s version runs'
);
select tests.clear_authentication();
select is(
  (select day_starts_at from public.schedule_versions where user_id = :'learner'),
  '04:00'::time,
  '... but changes nothing'
);

-- Before onboarding (none of these learners onboards) a learner's version takes effect at most 5
-- minutes ahead (4.12, M4-R17), so the pending versions below lie minutes ahead; onboarded
-- learners' versions wait for the next day start (013).

-- 2. day_starts_at: 00:00-12:00 in 30-minute steps (decision 5).
select tests.authenticate_as(:'learner');
select throws_ok(
  $$insert into public.schedule_versions (user_id, effective_at, day_starts_at)
    values (auth.uid(), now() + interval '1 minute', '04:15')$$,
  '23514',
  'new row for relation "schedule_versions" violates check constraint "day_starts_at_step"',
  'day_starts_at 04:15 is not on a 30-minute step'
);
select throws_ok(
  $$insert into public.schedule_versions (user_id, effective_at, day_starts_at)
    values (auth.uid(), now() + interval '1 minute', '13:00')$$,
  '23514',
  'new row for relation "schedule_versions" violates check constraint "day_starts_at_step"',
  'day_starts_at 13:00 is after noon'
);
select throws_ok(
  $$insert into public.schedule_versions (user_id, effective_at, day_starts_at)
    values (auth.uid(), now() + interval '1 minute', '04:00:30')$$,
  '23514',
  'new row for relation "schedule_versions" violates check constraint "day_starts_at_step"',
  'day_starts_at must be on a whole minute'
);
select lives_ok(
  $$insert into public.schedule_versions (user_id, effective_at, day_starts_at)
    values (auth.uid(), now() + interval '1 minute', '12:00')$$,
  'day_starts_at 12:00 is allowed'
);
select lives_ok(
  $$insert into public.schedule_versions (user_id, effective_at, day_starts_at)
    values (auth.uid(), now() + interval '2 minutes', '00:30')$$,
  'day_starts_at 00:30 is allowed'
);

-- 3. Time zones are validated against pg_timezone_names (decision 6).
select throws_ok(
  $$update public.schedule_versions set timezone = 'Mars/Base'
    where effective_at = now() + interval '2 minutes'$$,
  'P0001', 'invalid_timezone', 'an update to an unknown time zone raises invalid_timezone'
);
-- The learner's two pending versions go (as postgres), so the inserts below stay under the cap (§3b).
select tests.clear_authentication();
delete from public.schedule_versions where user_id = :'learner' and effective_at > now();
select tests.authenticate_as(:'learner');
select throws_ok(
  $$insert into public.schedule_versions (user_id, effective_at, timezone)
    values (auth.uid(), now() + interval '3 minutes', 'Mars/Base')$$,
  'P0001', 'invalid_timezone', 'an unknown time zone raises invalid_timezone'
);
select lives_ok(
  $$insert into public.schedule_versions (user_id, effective_at, timezone)
    values (auth.uid(), now() + interval '3 minutes', 'Asia/Saigon')$$,
  'Asia/Saigon is accepted'
);
select lives_ok(
  $$insert into public.schedule_versions (user_id, effective_at, timezone)
    values (auth.uid(), now() + interval '4 minutes', 'Asia/Ho_Chi_Minh')$$,
  'Asia/Ho_Chi_Minh is accepted'
);
select results_eq(
  $$select a.attname::text collate "default" from pg_catalog.pg_trigger t
    join pg_catalog.pg_attribute a on a.attrelid = t.tgrelid and a.attnum = any (t.tgattr)
    where t.tgrelid = 'public.schedule_versions'::regclass and t.tgname = 'check_timezone'$$,
  $$values ('timezone'::text)$$,
  'the time-zone check fires on update of timezone only'
);

-- 3b. At most 2 pending (future) versions per user (ruling R14); upserting one is not a new one.
select throws_ok(
  $$insert into public.schedule_versions (user_id, effective_at)
    values (auth.uid(), now() + interval '5 minutes')$$,
  'P0001', 'too_many_pending_schedules', 'a third pending version raises too_many_pending_schedules'
);
select lives_ok(
  $$insert into public.schedule_versions (user_id, effective_at, day_starts_at)
    values (auth.uid(), now() + interval '4 minutes', '06:00')
    on conflict (user_id, effective_at) do update set day_starts_at = excluded.day_starts_at$$,
  'an upsert of a pending version at the cap is not a new version'
);
select is(
  (select count(*)::int from public.schedule_versions where effective_at > now()),
  2,
  '... and the learner still has 2 pending versions'
);
select tests.authenticate_as(:'other');
select throws_ok(
  $$insert into public.schedule_versions (user_id, effective_at)
    select auth.uid(), now() + g * interval '1 minute' from generate_series(1, 3) g$$,
  'P0001', 'too_many_pending_schedules', 'one statement inserting 3 pending versions raises'
);
select lives_ok(
  $$insert into public.schedule_versions (user_id, effective_at)
    select auth.uid(), now() + g * interval '1 minute' from generate_series(1, 2) g$$,
  'the cap is per user: another user inserts 2 pending versions'
);

-- 3c. authenticated may change only a pending version's timezone and day_starts_at, and never
--     delete a version (no grant: 42501 before any trigger runs).
select tests.authenticate_as(:'learner');
select throws_ok(
  $$update public.schedule_versions set effective_at = now() + interval '6 minutes'
    where effective_at = now() + interval '4 minutes'$$,
  '42501', 'permission denied for table schedule_versions',
  'authenticated cannot update effective_at'
);
select throws_ok(
  format(
    $$update public.schedule_versions set user_id = %L
      where effective_at = now() + interval '4 minutes'$$,
    :'other'
  ),
  '42501', 'permission denied for table schedule_versions', 'authenticated cannot update user_id'
);
select throws_ok(
  $$delete from public.schedule_versions where effective_at = now() + interval '4 minutes'$$,
  '42501', 'permission denied for table schedule_versions',
  'authenticated cannot delete a version, not even a pending one'
);

-- 4. user_tracks: insert and update own while active; checks; no delete.
select lives_ok(
  $$insert into public.user_tracks (user_id, track_id, roadmap_variant, start_date, budget_minutes)
    values (auth.uid(), 'dsa', '10w', current_date, 60)$$,
  'an active user inserts their own track'
);
select results_eq(
  'select status, include_bonus, new_per_day, throttle, weekly_template from public.user_tracks',
  $$values ('active'::text, false, null::integer, null::jsonb, null::jsonb)$$,
  'a new track is active, without bonus, on the track defaults'
);
select lives_ok(
  $$update public.user_tracks set status = 'paused', budget_minutes = 90 where track_id = 'dsa'$$,
  'an active user updates their own track'
);
select results_eq(
  'select status, budget_minutes from public.user_tracks',
  $$values ('paused'::text, 90)$$,
  'the update is stored'
);
select throws_ok(
  $$update public.user_tracks set budget_minutes = 7 where track_id = 'dsa'$$,
  '23514', null, 'budget_minutes 7 is below 10'
);
select throws_ok(
  $$update public.user_tracks set budget_minutes = 245 where track_id = 'dsa'$$,
  '23514', null, 'budget_minutes 245 is above 240'
);
select throws_ok(
  $$update public.user_tracks set budget_minutes = 62 where track_id = 'dsa'$$,
  '23514', null, 'budget_minutes 62 is not a multiple of 5'
);
select throws_ok(
  $$update public.user_tracks set status = 'deleted' where track_id = 'dsa'$$,
  '23514', null, 'status deleted is not a track status'
);
select throws_ok(
  $$update public.user_tracks set throttle = jsonb_build_array(repeat('x', 2100))
    where track_id = 'dsa'$$,
  '23514',
  'new row for relation "user_tracks" violates check constraint "throttle_size"',
  'a throttle over 2048 bytes is rejected'
);
select throws_ok(
  $$update public.user_tracks set weekly_template = jsonb_build_object('mon', repeat('x', 2100))
    where track_id = 'dsa'$$,
  '23514',
  'new row for relation "user_tracks" violates check constraint "weekly_template_size"',
  'a weekly_template over 2048 bytes is rejected'
);
select lives_ok(
  $$update public.user_tracks
    set throttle = jsonb_build_array(repeat('x', 2000)),
        weekly_template = jsonb_build_object('mon', repeat('x', 1990))
    where track_id = 'dsa'$$,
  'a throttle and a weekly_template of about 2000 bytes are allowed'
);
select throws_ok(
  $$update public.user_tracks set throttle = '{"a": 1}' where track_id = 'dsa'$$,
  '23514', null, 'a throttle that is not an array is still rejected'
);
select throws_ok(
  $$insert into public.user_tracks (user_id, track_id, roadmap_variant, start_date, budget_minutes)
    values (auth.uid(), 'DSA', '10w', current_date, 60)$$,
  '23514', null, 'track_id DSA is not a lowercase slug'
);
select throws_ok(
  $$delete from public.user_tracks where track_id = 'dsa'$$,
  '42501', 'permission denied for table user_tracks', 'a user cannot delete a track'
);

select tests.authenticate_as(:'pending');
select throws_ok(
  $$insert into public.user_tracks (user_id, track_id, roadmap_variant, start_date, budget_minutes)
    values (auth.uid(), 'dsa', '10w', current_date, 60)$$,
  '42501',
  'new row violates row-level security policy for table "user_tracks"',
  'a pending user cannot insert a track'
);

select tests.authenticate_as(:'other');
select lives_ok(
  $$insert into public.user_tracks (user_id, track_id, roadmap_variant, start_date, budget_minutes)
    values (auth.uid(), 'english', '10w', current_date, 45)$$,
  'another active user inserts their own track'
);
select tests.authenticate_as(:'learner');
select is(
  (select count(*)::int from public.user_tracks where user_id = :'other'),
  0,
  'another user''s track is invisible'
);
select lives_ok(
  format('update public.user_tracks set budget_minutes = 30 where user_id = %L', :'other'),
  'an update of another user''s track runs'
);
select tests.clear_authentication();
select is(
  (select budget_minutes from public.user_tracks where user_id = :'other'),
  45,
  '... but changes nothing'
);

-- 4b. At most 16 tracks per user (ruling R14), counted per row, also within one statement;
--     re-enrolling an existing track (upsert) is not a new track.
select tests.authenticate_as(:'tracks');
select throws_ok(
  $$insert into public.user_tracks (user_id, track_id, roadmap_variant, start_date, budget_minutes)
    select auth.uid(), 't' || g, '10w', current_date, 60 from generate_series(1, 17) g$$,
  'P0001', 'too_many_tracks', 'one statement inserting 17 tracks raises too_many_tracks'
);
select lives_ok(
  $$insert into public.user_tracks (user_id, track_id, roadmap_variant, start_date, budget_minutes)
    select auth.uid(), 't' || g, '10w', current_date, 60 from generate_series(1, 16) g$$,
  '16 tracks are allowed'
);
select throws_ok(
  $$insert into public.user_tracks (user_id, track_id, roadmap_variant, start_date, budget_minutes)
    values (auth.uid(), 't17', '10w', current_date, 60)$$,
  'P0001', 'too_many_tracks', 'a 17th track raises too_many_tracks'
);
select lives_ok(
  $$insert into public.user_tracks (user_id, track_id, roadmap_variant, start_date, budget_minutes)
    values (auth.uid(), 't16', '12w', current_date, 90)
    on conflict (user_id, track_id) do update set
      roadmap_variant = excluded.roadmap_variant, budget_minutes = excluded.budget_minutes$$,
  'an upsert of an existing track at the cap is not a new track'
);
select throws_ok(
  $$select public.apply_event(jsonb_build_object(
      'id', gen_random_uuid(), 'type', 'track.enrolled', 'track_id', 't17',
      'payload', jsonb_build_object(
        'roadmapVariant', '10w', 'budgetMinutes', 60, 'startDate', current_date)))$$,
  'P0001', 'too_many_tracks', 'apply_event track.enrolled for a 17th track raises too_many_tracks'
);
select tests.clear_authentication();
select results_eq(
  format(
    $$select count(*)::int, count(*) filter (where track_id = 't16' and budget_minutes = 90)::int
      from public.user_tracks where user_id = %L$$,
    :'tracks'
  ),
  $$values (16, 1)$$,
  '... the user keeps 16 tracks, the upsert changed its track'
);
select is(
  (select count(*)::int from public.events where user_id = :'tracks'),
  0,
  '... and the rejected apply_event left no event'
);

-- 5. Deleting the auth user cascades through profiles to versions and tracks (§4.6), even past
--    the history guard: the learner's first version (effective now) is in force.
select lives_ok(
  format('delete from auth.users where id = %L', :'learner'),
  'deleting the auth user succeeds with an in-force schedule version'
);
select is(
  (select count(*)::int from public.profiles where id = :'learner'), 0, 'the profile is gone'
);
select is(
  (select count(*)::int from public.schedule_versions where user_id = :'learner'),
  0,
  'the schedule versions are gone'
);
select is(
  (select count(*)::int from public.user_tracks where user_id = :'learner'),
  0,
  'the tracks are gone'
);

-- 6. History (owner review MF3): past days are never rewritten (§5.9), for every role. This
--    learner has not onboarded, so the 5-minute rules apply; onboarded learners: 013 (4.12).
select tests.authenticate_as(:'history');
select lives_ok(
  $$insert into public.schedule_versions (user_id, effective_at)
    values (auth.uid(), now() - interval '3 days')$$,
  'a user''s first version may be backdated'
);
select throws_ok(
  $$insert into public.schedule_versions (user_id, effective_at)
    values (auth.uid(), now() - interval '1 hour')$$,
  'P0001', 'schedule_backdated', 'a backdated second version raises (authenticated)'
);
select throws_ok(
  $$insert into public.schedule_versions (user_id, effective_at, day_starts_at)
    values (auth.uid(), now() - interval '3 days', '06:00')
    on conflict (user_id, effective_at) do update set day_starts_at = excluded.day_starts_at$$,
  'P0001', 'schedule_backdated', 'the insert half of an upsert is checked too'
);
select lives_ok(
  $$insert into public.schedule_versions (user_id, effective_at)
    values (auth.uid(), now() - interval '4 minutes')$$,
  'a version up to 5 minutes in the past is not backdated'
);
select lives_ok(
  $$insert into public.schedule_versions (user_id, effective_at)
    values (auth.uid(), now() + interval '1 minute')$$,
  'a pending version inserts'
);
select lives_ok(
  $$update public.schedule_versions set day_starts_at = '05:00'
    where effective_at = now() + interval '1 minute'$$,
  'a pending version may be updated'
);
select is(
  (select day_starts_at from public.schedule_versions
    where effective_at = now() + interval '1 minute'),
  '05:00'::time,
  '... and the update is stored'
);
select throws_ok(
  $$update public.schedule_versions set day_starts_at = '06:00'
    where effective_at = now() - interval '3 days'$$,
  'P0001', 'schedule_in_force', 'an update of the in-force version raises (authenticated)'
);

select tests.clear_authentication();
select throws_ok(
  format(
    $$insert into public.schedule_versions (user_id, effective_at)
      values (%L, now() - interval '1 hour')$$,
    :'history'
  ),
  'P0001', 'schedule_backdated', 'a backdated second version raises (postgres)'
);
select throws_ok(
  format(
    $$update public.schedule_versions set effective_at = now() - interval '1 hour'
      where user_id = %L and effective_at = now() + interval '1 minute'$$,
    :'history'
  ),
  'P0001', 'schedule_backdated', 'a pending version cannot be moved into the past (postgres)'
);
select throws_ok(
  format(
    $$update public.schedule_versions set timezone = 'Asia/Bangkok'
      where user_id = %L and effective_at = now() - interval '3 days'$$,
    :'history'
  ),
  'P0001', 'schedule_in_force', 'an update of the in-force version raises (postgres)'
);
select throws_ok(
  format(
    $$delete from public.schedule_versions
      where user_id = %L and effective_at = now() - interval '3 days'$$,
    :'history'
  ),
  'P0001', 'schedule_in_force', 'a direct delete of the in-force version raises (postgres)'
);
select lives_ok(
  format(
    $$delete from public.schedule_versions
      where user_id = %L and effective_at = now() + interval '1 minute'$$,
    :'history'
  ),
  'a pending version may be deleted'
);

select * from finish();
rollback;
