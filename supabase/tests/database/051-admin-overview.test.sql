begin;
set client_min_messages = warning;
create extension if not exists pgtap with schema extensions;
\ir _helpers.psql

select plan(32);

-- Task 5.6: the /admin readers and the expected-status check (platform design §2.4, §4.3, §4.5,
-- §8.4 item 5; implementation plan Part B-M5 decision 25; the M2 2.8 minor). admin_overview() and
-- admin_track_positions() are aggregate SECURITY DEFINER readers — counts only, never a learner
-- row or a note (§4.5). admin_set_status gains p_expected_from: a stale "Duyệt" or "Kích hoạt
-- lại" (another admin decided first) raises status_changed instead of overriding that decision.

select tests.create_user('overview-admin@hocdeu.test', 'active', 'admin') as admin \gset
select tests.create_user('overview-suspended-admin@hocdeu.test', 'suspended', 'admin') as suspended_admin \gset
-- Learners with plans (see 3 below). The track positions use a variant no other fixture or seed
-- row has, so the counts of that variant are exact whatever else the database holds.
select tests.create_user('overview-week3@hocdeu.test') as week3 \gset
select tests.create_user('overview-week2@hocdeu.test') as week2 \gset
select tests.create_user('overview-old-plan@hocdeu.test') as old_plan \gset
select tests.create_user('overview-paused@hocdeu.test') as paused \gset
select tests.create_user('overview-suspended@hocdeu.test', 'suspended') as suspended \gset
select tests.create_user('overview-no-dsa-today@hocdeu.test') as no_dsa_today \gset
-- admin_set_status targets.
select tests.create_user('overview-pending@hocdeu.test', 'pending') as pending \gset
select tests.create_user('overview-rejected-meanwhile@hocdeu.test', 'pending') as stale \gset

-- ---------------------------------------------------------------------------------------------
-- 1. Grants and shape: authenticated only (R5); SECURITY DEFINER with an empty search_path.
-- ---------------------------------------------------------------------------------------------

select results_eq(
  $$select p.proname::text collate "default", r.rolname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    cross join (values ('anon'::text), ('authenticated'), ('service_role')) as r (rolname)
    where n.nspname = 'public'
      and p.proname in ('admin_overview', 'admin_track_positions', 'admin_set_status')
      and has_function_privilege(r.rolname, p.oid, 'EXECUTE')
    order by 1, 2$$,
  $$values ('admin_overview'::text, 'authenticated'::text),
           ('admin_set_status', 'authenticated'),
           ('admin_track_positions', 'authenticated')$$,
  'only authenticated may execute admin_overview, admin_track_positions and admin_set_status'
);
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('admin_overview', 'admin_track_positions')
      and p.prosecdef and 'search_path=""' = any (p.proconfig)),
  2,
  'admin_overview and admin_track_positions are SECURITY DEFINER with an empty search_path'
);
select results_eq(
  $$select pg_catalog.pg_get_function_identity_arguments(p.oid), p.prosecdef,
      'search_path=""' = any (p.proconfig)
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'admin_set_status'$$,
  $$values ('p_user_id uuid, p_status text, p_expected_from text'::text, true, true)$$,
  'admin_set_status has one signature, (uuid, text, text), SECURITY DEFINER with an empty '
  'search_path: the two-argument function is gone'
);
select is(
  (select pg_catalog.pg_get_function_arguments(p.oid) from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'admin_set_status'),
  'p_user_id uuid, p_status text, p_expected_from text DEFAULT NULL::text',
  '... and p_expected_from is optional'
);

-- ---------------------------------------------------------------------------------------------
-- 2. Only an active admin reads the aggregates.
-- ---------------------------------------------------------------------------------------------

select tests.authenticate_as(:'week3');
select throws_ok(
  'select public.admin_overview()', '42501', 'forbidden',
  'a learner calling admin_overview raises forbidden'
);
select throws_ok(
  'select * from public.admin_track_positions()', '42501', 'forbidden',
  'a learner calling admin_track_positions raises forbidden'
);
select tests.authenticate_as(:'suspended_admin');
select throws_ok(
  'select public.admin_overview()', '42501', 'forbidden',
  'a suspended admin calling admin_overview raises forbidden'
);
select throws_ok(
  'select * from public.admin_track_positions()', '42501', 'forbidden',
  'a suspended admin calling admin_track_positions raises forbidden'
);
select tests.clear_authentication();

-- ---------------------------------------------------------------------------------------------
-- 3. Fixtures. The activity and plan counts are compared before and after they are added, so
--    rows the seed or another run left behind do not matter (plans cannot be deleted).
-- ---------------------------------------------------------------------------------------------

select tests.authenticate_as(:'admin');
create temporary table _before on commit drop as select public.admin_overview() as overview;
select tests.clear_authentication();

-- Enrollments (variant pgtap-051): every learner in DSA, active unless noted; week3 also in
-- English, removed since.
insert into public.user_tracks (user_id, track_id, roadmap_variant, status, start_date, budget_minutes)
values
  (:'week3', 'dsa', 'pgtap-051', 'active', current_date - 30, 60),
  (:'week3', 'english', 'pgtap-051', 'removed', current_date - 30, 30),
  (:'week2', 'dsa', 'pgtap-051', 'active', current_date - 30, 60),
  (:'old_plan', 'dsa', 'pgtap-051', 'active', current_date - 60, 60),
  (:'paused', 'dsa', 'pgtap-051', 'paused', current_date - 30, 60),
  (:'suspended', 'dsa', 'pgtap-051', 'active', current_date - 30, 60),
  (:'no_dsa_today', 'dsa', 'pgtap-051', 'active', current_date - 30, 60),
  (:'no_dsa_today', 'english', 'pgtap-051', 'active', current_date - 30, 30);

-- A plan snapshot: roadmap_weeks[track] = { variant, week, … } (trackSnapshotSchema).
create function pg_temp.snapshot(p_week integer) returns jsonb language sql as $$
  select jsonb_build_object('variant', 'pgtap-051', 'week', p_week, 'dueCount', 0,
    'newPerDay', null, 'throttled', false, 'reviewDebt', false)
$$;

insert into public.day_plans (user_id, plan_date, blocks, roadmap_weeks, created_at) values
  -- week3: an older plan in week 2, the latest in week 3 (and English, whose enrollment is removed).
  (:'week3', current_date - 5, '[]', jsonb_build_object('dsa', pg_temp.snapshot(2)), now()),
  (:'week3', current_date - 1, '[]',
   jsonb_build_object('dsa', pg_temp.snapshot(3), 'english', pg_temp.snapshot(7)), now()),
  -- week2: the latest plan (two days ago) in week 2.
  (:'week2', current_date - 2, '[]', jsonb_build_object('dsa', pg_temp.snapshot(2)), now()),
  -- old_plan: a plan 20 days ago only — outside the 14 days, and not created in the last 7.
  (:'old_plan', current_date - 20, '[]', jsonb_build_object('dsa', pg_temp.snapshot(5)),
   now() - interval '20 days'),
  -- paused: its DSA enrollment is paused.
  (:'paused', current_date - 1, '[]', jsonb_build_object('dsa', pg_temp.snapshot(4)), now()),
  -- suspended: the profile is suspended.
  (:'suspended', current_date, '[]', jsonb_build_object('dsa', pg_temp.snapshot(6)), now()),
  -- no_dsa_today: today's plan holds only English; DSA's latest plan (3 days ago) is in week 1.
  (:'no_dsa_today', current_date - 3, '[]', jsonb_build_object('dsa', pg_temp.snapshot(1)), now()),
  (:'no_dsa_today', current_date, '[]', jsonb_build_object('english', pg_temp.snapshot(1)), now());

-- Completed days: week3 twice this week (one learner), week2 once, old_plan 10 days ago; paused
-- studied today without completing the day.
insert into public.daily_activity (user_id, local_day, completed) values
  (:'week3', current_date - 1, true),
  (:'week3', current_date - 3, true),
  (:'week2', current_date - 6, true),
  (:'old_plan', current_date - 10, true),
  (:'paused', current_date, false);

-- ---------------------------------------------------------------------------------------------
-- 4. admin_overview(): users by status, learners who completed a day in the last 7 days, plans
--    created in the last 7 days.
-- ---------------------------------------------------------------------------------------------

select tests.authenticate_as(:'admin');
create temporary table _after on commit drop as select public.admin_overview() as overview;
select tests.clear_authentication();

select is(
  (select overview -> 'users' from _after),
  (select jsonb_build_object(
      'pending', count(*) filter (where status = 'pending'),
      'active', count(*) filter (where status = 'active'),
      'suspended', count(*) filter (where status = 'suspended'),
      'rejected', count(*) filter (where status = 'rejected'))
    from public.profiles),
  'admin_overview counts every profile by status'
);
select ok(
  (select (overview #>> '{users,pending}')::int >= 2 and (overview #>> '{users,suspended}')::int >= 2
    from _after),
  '... including this file''s pending and suspended users'
);
select is(
  (select (a.overview ->> 'learners_completed_7d')::int - (b.overview ->> 'learners_completed_7d')::int
    from _after a, _before b),
  2,
  'learners_completed_7d counts each learner with a completed day in the last 7 days once '
  '(not 10 days ago, not an incomplete day)'
);
select is(
  (select (a.overview ->> 'plans_created_7d')::int - (b.overview ->> 'plans_created_7d')::int
    from _after a, _before b),
  7,
  'plans_created_7d counts the plans created in the last 7 days (not the one from 20 days ago)'
);
select is(
  (select array_agg(key order by key) from _after, jsonb_object_keys(overview) as key),
  array['learners_completed_7d', 'plans_created_7d', 'users'],
  'admin_overview returns counts only: users, learners_completed_7d, plans_created_7d'
);

-- ---------------------------------------------------------------------------------------------
-- 5. admin_track_positions(): per track and variant, how many active learners' latest plan of
--    the last 14 days is in each week — active enrollments and active profiles only.
-- ---------------------------------------------------------------------------------------------

select tests.authenticate_as(:'admin');
create temporary table _positions on commit drop as
  select * from public.admin_track_positions();
select tests.clear_authentication();

select results_eq(
  $$select track_id, variant, week, learners from _positions
    where variant = 'pgtap-051' order by track_id, week$$,
  $$values ('dsa'::text, 'pgtap-051'::text, 1, 1), ('dsa', 'pgtap-051', 2, 1),
           ('dsa', 'pgtap-051', 3, 1), ('english', 'pgtap-051', 1, 1)$$,
  'one learner each in DSA weeks 1, 2 and 3 and English week 1: the week3 learner counts once, '
  'at the latest plan''s week; the old plan, the paused enrollment, the suspended profile and '
  'the removed English enrollment are ignored'
);
select is(
  (select count(*)::int from _positions where learners < 1 or week < 1),
  0,
  'every row counts at least one learner in a real week'
);
select results_eq(
  $$select a.attname::text collate "default", pg_catalog.format_type(a.atttypid, a.atttypmod)
    from pg_attribute a
    where a.attrelid = '_positions'::regclass and a.attnum > 0 and not a.attisdropped
    order by a.attnum$$,
  $$values ('track_id'::text, 'text'::text), ('variant', 'text'), ('week', 'integer'),
           ('learners', 'integer')$$,
  'admin_track_positions returns (track_id text, variant text, week integer, learners integer)'
);

-- A week that is not a whole number (the column is jsonb) is skipped, never an error.
insert into public.day_plans (user_id, plan_date, blocks, roadmap_weeks) values
  (:'week2', current_date, '[]',
   jsonb_build_object('dsa', jsonb_build_object('variant', 'pgtap-051', 'week', 'x')));
select tests.authenticate_as(:'admin');
select results_eq(
  $$select week, learners from public.admin_track_positions()
    where track_id = 'dsa' and variant = 'pgtap-051' order by week$$,
  $$values (1, 1), (3, 1)$$,
  'a latest plan whose week is unreadable counts nowhere (week2 drops out), and the function '
  'still answers'
);
select tests.clear_authentication();

-- ---------------------------------------------------------------------------------------------
-- 6. admin_set_status(p_user_id, p_status, p_expected_from): the status the list was rendered
--    with. A different current status raises status_changed and changes nothing.
-- ---------------------------------------------------------------------------------------------

-- Another admin rejects :stale while this admin's list still shows it pending.
update public.profiles set status = 'rejected' where id = :'stale';

select tests.authenticate_as(:'admin');
select throws_ok(
  format($$select public.admin_set_status(%L, 'active', 'pending')$$, :'stale'),
  'P0001', 'status_changed',
  'a stale "Duyệt" (expected pending, now rejected) raises status_changed'
);
select tests.clear_authentication();
select results_eq(
  format($$select status, approved_by from public.profiles where id = %L$$, :'stale'),
  $$values ('rejected'::text, null::uuid)$$,
  '... and the account stays rejected'
);
select is(
  (select count(*)::int from public.events where user_id = :'stale'),
  0,
  '... with no audit event'
);

select tests.authenticate_as(:'admin');
select is(
  public.admin_set_status(:'stale', 'active', 'rejected'),
  '{"from": "rejected", "to": "active"}'::jsonb,
  'with the current status as p_expected_from the change goes through (rejected -> active)'
);
select is(
  public.admin_set_status(:'pending', 'active', 'pending'),
  '{"from": "pending", "to": "active"}'::jsonb,
  'an up-to-date "Duyệt" (expected pending) approves'
);
select throws_ok(
  format($$select public.admin_set_status(%L, 'suspended', 'suspended')$$, :'pending'),
  'P0001', 'status_changed',
  'a stale "Tạm khoá" of an account shown as suspended raises status_changed'
);
select throws_ok(
  format($$select public.admin_set_status(%L, 'rejected', 'active')$$, :'pending'),
  'P0001', 'invalid_transition',
  'an up-to-date p_expected_from does not allow an invalid transition (active -> rejected)'
);
select is(
  public.admin_set_status(:'pending', 'suspended'),
  '{"from": "active", "to": "suspended"}'::jsonb,
  'without p_expected_from it works as before (active -> suspended)'
);
select is(
  public.admin_set_status(:'pending', 'active', null),
  '{"from": "suspended", "to": "active"}'::jsonb,
  '... and so does an explicit null (suspended -> active)'
);
select throws_ok(
  format($$select public.admin_set_status(%L, 'active', 'pending')$$, :'admin'),
  'P0001', 'cannot_change_self',
  'the acting admin is still refused first (cannot_change_self before status_changed)'
);
select throws_ok(
  $$select public.admin_set_status('51000000-0000-4000-8000-00000000dead', 'active', 'pending')$$,
  'P0001', 'not_found', 'an unknown user is still not_found'
);
select tests.authenticate_as(:'week3');
select throws_ok(
  format($$select public.admin_set_status(%L, 'active', 'rejected')$$, :'stale'),
  '42501', 'forbidden', 'a learner is refused before anything is read'
);
select tests.clear_authentication();

select bag_eq(
  format(
    $$select type, source, actor_id, payload ->> 'from' as from_status, payload ->> 'to' as to_status
      from public.events where user_id in (%L, %L)$$,
    :'stale', :'pending'
  ),
  format(
    $$values ('admin.user_approved'::text, 'admin'::text, %1$L::uuid, 'rejected'::text, 'active'::text),
             ('admin.user_approved', 'admin', %1$L, 'pending', 'active'),
             ('admin.user_suspended', 'admin', %1$L, 'active', 'suspended'),
             ('admin.user_approved', 'admin', %1$L, 'suspended', 'active')$$,
    :'admin'
  ),
  'each change wrote its audit event as before; the refused calls wrote none'
);
select results_eq(
  format($$select status, approved_by from public.profiles where id = %L$$, :'stale'),
  format($$values ('active'::text, %L::uuid)$$, :'admin'),
  'the reactivated account is active, approved_by the admin'
);

-- ---------------------------------------------------------------------------------------------
-- 7. Counts only (§4.5): admin_overview returns no user id and no e-mail (admin_track_positions'
--    columns are pinned in 5).
-- ---------------------------------------------------------------------------------------------

select ok(
  (select position(:'week3' in overview::text) = 0 and position('@' in overview::text) = 0
    from _after),
  'admin_overview names no user'
);

select * from finish();
rollback;
