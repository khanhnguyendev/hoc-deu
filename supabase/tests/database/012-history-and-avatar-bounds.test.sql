begin;
set client_min_messages = warning;
create extension if not exists pgtap with schema extensions;
\ir _helpers.psql

select plan(19);

select tests.create_user('window@hocdeu.test') as win \gset
select tests.create_user('statement@hocdeu.test') as statement \gset
select tests.create_user('upsert@hocdeu.test') as upsert \gset
select tests.create_user('avatar@hocdeu.test') as avatar \gset

-- 1. Ruling R17: at most 10 versions per user with effective_at in the last day or later. The
--    history guard lets a later version start up to 5 minutes in the past; without this bound,
--    versions inside that window were never counted, so history could grow without limit.
--    (Since 4.12 a learner's version waits for the next day start once onboarded_at is set, and
--    starts at most 5 minutes ahead before that, 013; these learners have not onboarded, so their
--    pending versions sit minutes ahead; postgres keeps the pre-4.12 rules.)
--    (now() is the transaction's start, so every statement below sees the same window; the
--    versions sit 20 seconds apart, and each later insert picks a time none of them uses.)
select tests.authenticate_as(:'win');
select lives_ok(
  $$insert into public.schedule_versions (user_id, effective_at)
    select auth.uid(), now() - g * interval '20 seconds' from generate_series(0, 9) g$$,
  '10 versions inside the 5-minute insert window are allowed'
);
select throws_ok(
  $$insert into public.schedule_versions (user_id, effective_at)
    values (auth.uid(), now() - interval '4 minutes')$$,
  'P0001', 'too_many_pending_schedules',
  'an 11th version inside the window raises too_many_pending_schedules'
);
-- Before onboarding a learner's version starts at most 5 minutes ahead (4.12, M4-R17).
select throws_ok(
  $$insert into public.schedule_versions (user_id, effective_at)
    values (auth.uid(), now() + interval '4 minutes')$$,
  'P0001', 'too_many_pending_schedules', 'a pending version counts against the same bound'
);
select throws_ok(
  $$select public.apply_event(jsonb_build_object(
      'id', '40000000-0000-4000-8000-000000000170', 'type', 'schedule.changed', 'rules_version', 1,
      'payload', jsonb_build_object(
        'timezone', 'Asia/Tokyo', 'dayStartsAt', '05:00',
        'effectiveAt', now() - interval '10 seconds')))$$,
  'P0001', 'too_many_pending_schedules', 'apply_event schedule.changed raises it too'
);
select tests.clear_authentication();
select is(
  (select count(*)::int from public.events where id = '40000000-0000-4000-8000-000000000170'),
  0,
  '... and the rejected apply_event left no event'
);
select throws_ok(
  format(
    $$insert into public.schedule_versions (user_id, effective_at)
      values (%L, now() - interval '50 seconds')$$,
    :'win'
  ),
  'P0001', 'too_many_pending_schedules', 'the bound holds for postgres too'
);
select is(
  (select count(*)::int from public.schedule_versions where user_id = :'win'),
  10,
  '... and the user keeps 10 versions'
);

-- 1b. Counted per row, also within one statement; the bound is per user (win is at 10).
select tests.authenticate_as(:'statement');
select throws_ok(
  $$insert into public.schedule_versions (user_id, effective_at)
    select auth.uid(), now() - g * interval '20 seconds' from generate_series(0, 10) g$$,
  'P0001', 'too_many_pending_schedules', 'one statement inserting 11 versions raises'
);
select lives_ok(
  $$insert into public.schedule_versions (user_id, effective_at)
    select auth.uid(), now() - g * interval '20 seconds' from generate_series(0, 9) g$$,
  '... the failed statement left nothing: this user''s own 10 are fine'
);

-- 1c. Versions older than a day are not counted; upserting an existing version is not a new one;
--     R14's cap of 2 pending versions stays.
select tests.authenticate_as(:'upsert');
select lives_ok(
  $$insert into public.schedule_versions (user_id, effective_at)
    values (auth.uid(), now() - interval '3 days')$$,
  'a first version three days back'
);
select lives_ok(
  $$insert into public.schedule_versions (user_id, effective_at)
    select auth.uid(), now() - g * interval '20 seconds' from generate_series(1, 8) g$$,
  '8 versions inside the window'
);
select lives_ok(
  $$insert into public.schedule_versions (user_id, effective_at)
    select auth.uid(), now() + g * interval '1 minute' from generate_series(1, 2) g$$,
  '2 pending versions: 11 rows, 10 of them counted (the first is older than a day)'
);
select throws_ok(
  $$insert into public.schedule_versions (user_id, effective_at)
    values (auth.uid(), now() - interval '4 minutes')$$,
  'P0001', 'too_many_pending_schedules', 'one more version inside the window raises'
);
select lives_ok(
  $$insert into public.schedule_versions (user_id, effective_at, day_starts_at)
    values (auth.uid(), now() + interval '1 minute', '06:00')
    on conflict (user_id, effective_at) do update set day_starts_at = excluded.day_starts_at$$,
  'an upsert of an existing (pending) version at the bound still works'
);
select results_eq(
  $$select count(*)::int, count(*) filter (where day_starts_at = '06:00')::int
    from public.schedule_versions$$,
  $$values (11, 1)$$,
  '... it added no row and changed the version'
);

-- 2. Ruling R17: avatar URLs are at most 2048 characters (learners may update their own).
select tests.authenticate_as(:'avatar');
select throws_ok(
  format(
    $$update public.profiles set avatar_url = %L where id = auth.uid()$$,
    'https://x.test/' || repeat('a', 2049 - char_length('https://x.test/'))
  ),
  '23514',
  'new row for relation "profiles" violates check constraint "avatar_url_length"',
  'a 2049-character avatar URL is rejected'
);
select lives_ok(
  format(
    $$update public.profiles set avatar_url = %L where id = auth.uid()$$,
    'https://x.test/' || repeat('a', 2048 - char_length('https://x.test/'))
  ),
  'a 2048-character avatar URL is allowed'
);
select tests.clear_authentication();
select is(
  (select char_length(avatar_url) from public.profiles where id = :'avatar'),
  2048,
  '... and stored'
);

-- 2b. Sign-up never fails on a provider avatar: an over-long one is stored as null, like an
--     http:// one (010).
select tests.create_user(
  'long-avatar@hocdeu.test', null, null,
  jsonb_build_object(
    'avatar_url', 'https://x.test/' || repeat('b', 2049 - char_length('https://x.test/'))
  )
) as long_avatar \gset
select results_eq(
  format(
    $$select status, avatar_url from public.profiles where id = %L$$, :'long_avatar'
  ),
  $$values ('pending'::text, null::text)$$,
  'sign-up with a 2049-character avatar creates the profile with avatar_url null'
);

select * from finish();
rollback;
