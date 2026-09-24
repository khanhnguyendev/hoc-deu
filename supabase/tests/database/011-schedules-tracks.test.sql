begin;
create extension if not exists pgtap with schema extensions;
\ir _helpers.psql

select plan(49);

select tests.create_user('learner@hocdeu.test') as learner \gset
select tests.create_user('other@hocdeu.test') as other \gset
select tests.create_user('pending@hocdeu.test', 'pending') as pending \gset
select tests.create_user('history@hocdeu.test') as history \gset

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

-- 2. day_starts_at: 00:00-12:00 in 30-minute steps (decision 5).
select tests.authenticate_as(:'learner');
select throws_ok(
  $$insert into public.schedule_versions (user_id, effective_at, day_starts_at)
    values (auth.uid(), now() + interval '1 day', '04:15')$$,
  '23514',
  'new row for relation "schedule_versions" violates check constraint "day_starts_at_step"',
  'day_starts_at 04:15 is not on a 30-minute step'
);
select throws_ok(
  $$insert into public.schedule_versions (user_id, effective_at, day_starts_at)
    values (auth.uid(), now() + interval '1 day', '13:00')$$,
  '23514',
  'new row for relation "schedule_versions" violates check constraint "day_starts_at_step"',
  'day_starts_at 13:00 is after noon'
);
select throws_ok(
  $$insert into public.schedule_versions (user_id, effective_at, day_starts_at)
    values (auth.uid(), now() + interval '1 day', '04:00:30')$$,
  '23514',
  'new row for relation "schedule_versions" violates check constraint "day_starts_at_step"',
  'day_starts_at must be on a whole minute'
);
select lives_ok(
  $$insert into public.schedule_versions (user_id, effective_at, day_starts_at)
    values (auth.uid(), now() + interval '1 day', '12:00')$$,
  'day_starts_at 12:00 is allowed'
);
select lives_ok(
  $$insert into public.schedule_versions (user_id, effective_at, day_starts_at)
    values (auth.uid(), now() + interval '2 days', '00:30')$$,
  'day_starts_at 00:30 is allowed'
);

-- 3. Time zones are validated against pg_timezone_names (decision 6).
select throws_ok(
  $$insert into public.schedule_versions (user_id, effective_at, timezone)
    values (auth.uid(), now() + interval '3 days', 'Mars/Base')$$,
  'P0001', 'invalid_timezone', 'an unknown time zone raises invalid_timezone'
);
select throws_ok(
  $$update public.schedule_versions set timezone = 'Mars/Base'
    where effective_at = now() + interval '2 days'$$,
  'P0001', 'invalid_timezone', 'an update to an unknown time zone raises invalid_timezone'
);
select lives_ok(
  $$insert into public.schedule_versions (user_id, effective_at, timezone)
    values (auth.uid(), now() + interval '3 days', 'Asia/Saigon')$$,
  'Asia/Saigon is accepted'
);
select lives_ok(
  $$insert into public.schedule_versions (user_id, effective_at, timezone)
    values (auth.uid(), now() + interval '4 days', 'Asia/Ho_Chi_Minh')$$,
  'Asia/Ho_Chi_Minh is accepted'
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

-- 6. History (owner review MF3): past days are never rewritten (§5.9), for every role.
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
    values (auth.uid(), now() + interval '1 day')$$,
  'a pending version inserts'
);
select lives_ok(
  $$update public.schedule_versions set day_starts_at = '05:00'
    where effective_at = now() + interval '1 day'$$,
  'a pending version may be updated'
);
select is(
  (select day_starts_at from public.schedule_versions where effective_at = now() + interval '1 day'),
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
      where user_id = %L and effective_at = now() + interval '1 day'$$,
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
      where user_id = %L and effective_at = now() + interval '1 day'$$,
    :'history'
  ),
  'a pending version may be deleted'
);

select * from finish();
rollback;
