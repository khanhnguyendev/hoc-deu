begin;
set client_min_messages = warning;
create extension if not exists pgtap with schema extensions;
\ir _helpers.psql

select plan(12);

-- Task 2.8: admin_list_users() — the approval queue's reader (§4.3, §4.5, decision 19).
select tests.create_user('list-admin@hocdeu.test', 'active', 'admin') as admin \gset
select tests.create_user('list-suspended-admin@hocdeu.test', 'suspended', 'admin') as suspended_admin \gset
select tests.create_user('list-learner@hocdeu.test', 'active', 'learner',
  '{"full_name": "Học viên Một"}') as learner \gset
select tests.create_user('list-pending-old@hocdeu.test', 'pending', 'learner',
  '{"full_name": "Chờ duyệt cũ"}') as pending_old \gset
select tests.create_user('list-pending-new@hocdeu.test', 'pending') as pending_new \gset
select tests.create_user('list-suspended@hocdeu.test', 'suspended') as suspended \gset
select tests.create_user('list-rejected@hocdeu.test', 'rejected') as rejected \gset

-- Distinct sign-up times (now() is constant inside the transaction), so the order is observable:
-- the older pending user signed up first; among everyone else the rejected user is the newest.
update public.profiles set created_at = now() - interval '9 days' where id = :'pending_old';
update public.profiles set created_at = now() - interval '2 days' where id = :'pending_new';
update public.profiles set created_at = now() - interval '8 days' where id = :'admin';
update public.profiles set created_at = now() - interval '7 days' where id = :'suspended_admin';
update public.profiles set created_at = now() - interval '6 days' where id = :'learner';
update public.profiles set created_at = now() - interval '5 days' where id = :'suspended';
update public.profiles set created_at = now() - interval '1 day' where id = :'rejected';
update public.profiles set approved_at = now() - interval '6 days', onboarded_at = now()
where id = :'learner';

-- 1. Grants (R5): authenticated only — anon, PUBLIC and service_role cannot execute it.
select ok(
  not has_function_privilege('anon', 'public.admin_list_users()', 'EXECUTE'),
  'anon cannot execute admin_list_users'
);
select results_eq(
  $$select r.rolname
    from (values ('anon'::text), ('authenticated'), ('service_role')) as r (rolname)
    where has_function_privilege(r.rolname, 'public.admin_list_users()', 'EXECUTE')$$,
  $$values ('authenticated'::text)$$,
  'only authenticated may execute admin_list_users'
);
select ok(
  (select p.prosecdef and 'search_path=""' = any (p.proconfig)
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'admin_list_users'),
  'admin_list_users is SECURITY DEFINER with an empty search_path'
);

-- 2. Non-admins are refused.
select tests.authenticate_as(:'learner');
select throws_ok(
  'select * from public.admin_list_users()',
  '42501', 'forbidden', 'a learner calling admin_list_users raises forbidden'
);
select tests.authenticate_as(:'pending_old');
select throws_ok(
  'select * from public.admin_list_users()',
  '42501', 'forbidden', 'a pending user calling admin_list_users raises forbidden'
);
select tests.authenticate_as(:'suspended_admin');
select throws_ok(
  'select * from public.admin_list_users()',
  '42501', 'forbidden', 'a suspended admin calling admin_list_users raises forbidden'
);

-- 3. An active admin sees every user, with the e-mail from auth.users.
select tests.authenticate_as(:'admin');
create temporary table _listed on commit drop as
  select * from public.admin_list_users() with ordinality as l (
    id, email, display_name, avatar_url, role, status, created_at, approved_at, onboarded_at,
    position
  );
select tests.clear_authentication();

select is(
  (select count(*)::int from _listed),
  (select count(*)::int from public.profiles),
  'an admin sees every profile'
);
select is(
  (select count(distinct id)::int from _listed),
  (select count(*)::int from _listed),
  '... each exactly once'
);
select set_eq(
  format(
    $$select id, email, display_name, role, status, approved_at, onboarded_at from _listed
      where id in (%L, %L)$$,
    :'learner', :'pending_old'
  ),
  format(
    $$values (%L::uuid, 'list-learner@hocdeu.test'::text, 'Học viên Một'::text, 'learner'::text,
              'active'::text, now() - interval '6 days', now()),
             (%L, 'list-pending-old@hocdeu.test', 'Chờ duyệt cũ', 'learner', 'pending',
              null::timestamptz, null::timestamptz)$$,
    :'learner', :'pending_old'
  ),
  '... with the e-mail from auth.users and the profile columns'
);
select is_empty(
  $$select l.id from _listed l join auth.users u on u.id = l.id
    where l.email is distinct from u.email::text$$,
  '... every e-mail matches auth.users'
);

-- 4. Order: pending first, oldest first; then everyone else, newest first.
select ok(
  (select coalesce(max(position) filter (where status = 'pending'), 0)
      < coalesce(min(position) filter (where status <> 'pending'), 2147483647)
    from _listed),
  'every pending row comes before every other row'
);
select results_eq(
  format(
    $$select id from _listed where id in (%L, %L, %L, %L, %L, %L, %L) order by position$$,
    :'admin', :'suspended_admin', :'learner', :'pending_old', :'pending_new', :'suspended',
    :'rejected'
  ),
  format(
    $$values (%L::uuid), (%L), (%L), (%L), (%L), (%L), (%L)$$,
    :'pending_old', :'pending_new', :'rejected', :'suspended', :'learner', :'suspended_admin',
    :'admin'
  ),
  'pending users oldest first, then everyone else newest first'
);

select * from finish();
rollback;
