begin;
set client_min_messages = warning;
create extension if not exists pgtap with schema extensions;
\ir _helpers.psql

select plan(65);

select tests.create_user('system-onboarding@hocdeu.test') as onboarding \gset
select tests.create_user('system-other@hocdeu.test') as sys_other \gset
select tests.create_user('system-pending@hocdeu.test', 'pending') as sys_pending \gset
select tests.create_user('admin-admin@hocdeu.test', 'active', 'admin') as admin \gset
select tests.create_user('admin-suspended-admin@hocdeu.test', 'suspended', 'admin') as suspended_admin \gset
select tests.create_user('admin-learner@hocdeu.test') as learner \gset
select tests.create_user('admin-approve@hocdeu.test', 'pending') as approve \gset
select tests.create_user('admin-reject@hocdeu.test', 'pending') as reject \gset
select tests.create_user('admin-role@hocdeu.test') as role_target \gset
select tests.create_user('boot-new@hocdeu.test', 'pending') as boot_new \gset
select tests.create_user('boot-suspended-admin@hocdeu.test', 'suspended', 'admin') as boot_suspended \gset
select tests.create_user('boot-demoted@hocdeu.test', 'active', 'learner') as boot_demoted \gset
select tests.create_user('boot-rejected@hocdeu.test', 'rejected') as boot_rejected \gset
select tests.create_user('boot-processed@hocdeu.test', 'pending') as boot_processed \gset
-- A demoted admin was approved once; so was the (hypothetical) pending profile with approved_at.
update public.profiles set approved_at = now() - interval '10 days'
where id in (:'boot_demoted', :'boot_processed');

-- 1. Grants: every function of this task states them explicitly (R5). anon executes none;
--    authenticated only apply_event and the two admin_set_* functions; service_role only
--    apply_system_event and admin_bootstrap.
select ok(
  not has_function_privilege(
    'authenticated', 'public.apply_system_event(uuid, jsonb, jsonb, jsonb)', 'EXECUTE'
  ),
  'authenticated cannot execute apply_system_event'
);
select ok(
  not has_function_privilege('anon', 'public.apply_system_event(uuid, jsonb, jsonb, jsonb)', 'EXECUTE'),
  'anon cannot execute apply_system_event'
);
select ok(
  has_function_privilege('service_role', 'public.apply_system_event(uuid, jsonb, jsonb, jsonb)', 'EXECUTE'),
  'service_role can execute apply_system_event'
);
select ok(
  not has_function_privilege('authenticated', 'public.admin_bootstrap(uuid)', 'EXECUTE'),
  'authenticated cannot execute admin_bootstrap'
);
select ok(
  not has_function_privilege('anon', 'public.admin_bootstrap(uuid)', 'EXECUTE'),
  'anon cannot execute admin_bootstrap'
);
select ok(
  has_function_privilege('service_role', 'public.admin_bootstrap(uuid)', 'EXECUTE'),
  'service_role can execute admin_bootstrap'
);
select results_eq(
  $$select p.proname::text collate "default", r.rolname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    cross join (values ('anon'::text), ('authenticated'), ('service_role')) as r (rolname)
    where n.nspname = 'public'
      and p.proname in ('apply_event', 'apply_system_event', 'admin_set_status', 'admin_set_role',
                        'admin_bootstrap', 'system_event_types')
      and has_function_privilege(r.rolname, p.oid, 'EXECUTE')
    order by 1, 2$$,
  $$values ('admin_bootstrap'::text, 'service_role'::text),
           ('admin_set_role', 'authenticated'),
           ('admin_set_status', 'authenticated'),
           ('apply_event', 'authenticated'),
           ('apply_system_event', 'service_role')$$,
  'the complete EXECUTE grants of this task''s functions (anon: none)'
);

-- 2. apply_system_event (service_role): onboarding.completed, duplicates, id conflicts, types.
select tests.authenticate_as_service_role();
select is(
  public.apply_system_event(
    :'onboarding'::uuid,
    '{"id": "41000000-0000-4000-8000-000000000001", "type": "onboarding.completed", "payload": {},
      "rules_version": 1}'
  ),
  '{"outcome": "applied", "versions": {}}'::jsonb,
  'onboarding.completed returns applied'
);
select tests.clear_authentication();
select is(
  (select onboarded_at from public.profiles where id = :'onboarding'),
  now(),
  '... and sets onboarded_at'
);
select results_eq(
  format(
    $$select id, type, source, actor_id, rules_version from public.events where user_id = %L$$,
    :'onboarding'
  ),
  format(
    $$values ('41000000-0000-4000-8000-000000000001'::uuid, 'onboarding.completed'::text,
              'system'::text, %L::uuid, 1)$$,
    :'onboarding'
  ),
  '... and writes one system event, actor_id the user'
);
-- A fixed onboarded_at, so that "unchanged" is observable (now() is constant in a transaction).
update public.profiles set onboarded_at = '2026-01-01T00:00:00Z' where id = :'onboarding';
select tests.authenticate_as_service_role();
select is(
  public.apply_system_event(
    :'onboarding'::uuid,
    '{"id": "41000000-0000-4000-8000-000000000001", "type": "onboarding.completed", "payload": {}}'
  ),
  '{"outcome": "duplicate", "versions": {}}'::jsonb,
  'repeating the event id returns duplicate'
);
select is(
  public.apply_system_event(
    :'onboarding'::uuid,
    '{"id": "41000000-0000-4000-8000-000000000002", "type": "onboarding.completed", "payload": {},
      "source": "bot", "actor_id": "41000000-0000-4000-8000-0000000000aa"}'
  ),
  '{"outcome": "applied", "versions": {}}'::jsonb,
  'a second onboarding.completed (new id, source bot, actor_id given) returns applied'
);
select is(
  public.apply_system_event(
    :'onboarding'::uuid,
    '{"id": "41000000-0000-4000-8000-000000000003", "type": "onboarding.completed", "payload": {},
      "source": "learner"}'
  ),
  '{"outcome": "applied", "versions": {}}'::jsonb,
  'an onboarding.completed claiming source learner returns applied'
);
select tests.clear_authentication();
select is(
  (select onboarded_at from public.profiles where id = :'onboarding'),
  '2026-01-01T00:00:00Z'::timestamptz,
  '... and onboarded_at is unchanged (set once)'
);
select results_eq(
  format(
    $$select id, source, actor_id from public.events where user_id = %L order by id$$,
    :'onboarding'
  ),
  format(
    $$values ('41000000-0000-4000-8000-000000000001'::uuid, 'system'::text, %1$L::uuid),
             ('41000000-0000-4000-8000-000000000002', 'bot', '41000000-0000-4000-8000-0000000000aa'),
             ('41000000-0000-4000-8000-000000000003', 'system', %1$L)$$,
    :'onboarding'
  ),
  '... the duplicate added no event; source bot and actor_id are kept, a learner source becomes system'
);
select tests.authenticate_as_service_role();
select throws_ok(
  format(
    $$select public.apply_system_event(%L::uuid,
        '{"id": "41000000-0000-4000-8000-000000000001", "type": "onboarding.completed", "payload": {}}')$$,
    :'sys_other'
  ),
  'P0001', 'id_conflict', 'an id another user''s event already uses raises id_conflict'
);
select throws_ok(
  format(
    $$select public.apply_system_event(%L::uuid, jsonb_build_object(
        'id', gen_random_uuid(), 'type', 'track.enrolled', 'track_id', 'dsa',
        'payload', '{"roadmapVariant": "10w", "budgetMinutes": 60, "startDate": "2026-09-25"}'::jsonb))$$,
    :'sys_other'
  ),
  'P0001', 'invalid_event', 'a learner type raises invalid_event'
);
select throws_ok(
  format(
    $$select public.apply_system_event(%L::uuid, jsonb_build_object(
        'id', gen_random_uuid(), 'type', 'plan.generated',
        'payload', '{"mode": "baseline", "planVersion": 1}'::jsonb))$$,
    :'sys_other'
  ),
  'P0001', 'not_implemented', 'another system type raises not_implemented in M2'
);
select throws_ok(
  format(
    $$select public.apply_system_event(%L::uuid, jsonb_build_object(
        'id', gen_random_uuid(), 'type', 'onboarding.completed', 'payload', '{}'::jsonb),
        '[{"table": "day_plans"}]'::jsonb)$$,
    :'sys_other'
  ),
  'P0001', 'not_implemented', 'a non-empty p_changes raises not_implemented'
);
select throws_ok(
  format(
    $$select public.apply_system_event(%L::uuid, jsonb_build_object(
        'id', 'not-a-uuid', 'type', 'onboarding.completed', 'payload', '{}'::jsonb))$$,
    :'sys_other'
  ),
  'P0001', 'invalid_event', 'an id that is not a uuid raises invalid_event'
);
select throws_ok(
  format(
    $$select public.apply_system_event(%L::uuid, jsonb_build_object(
        'id', gen_random_uuid(), 'type', 'onboarding.completed', 'payload', '{}'::jsonb))$$,
    :'sys_pending'
  ),
  '42501', 'inactive', 'a pending user raises inactive'
);
select tests.clear_authentication();
select is(
  (select onboarded_at from public.profiles where id = :'sys_pending'),
  null,
  '... and stays not onboarded'
);

-- 3. admin_set_status: admins only, never themselves; the transitions of decision 17.
select tests.authenticate_as(:'learner');
select throws_ok(
  format($$select public.admin_set_status(%L, 'active')$$, :'approve'),
  '42501', 'forbidden', 'a learner calling admin_set_status raises forbidden'
);
select tests.authenticate_as(:'admin');
select is(
  public.admin_set_status(:'approve', 'active'),
  '{"from": "pending", "to": "active"}'::jsonb,
  'an admin approves a pending user'
);
select tests.clear_authentication();
select results_eq(
  format($$select status, approved_by, approved_at from public.profiles where id = %L$$, :'approve'),
  format($$values ('active'::text, %L::uuid, now())$$, :'admin'),
  '... who becomes active, approved_by the admin, approved_at now'
);
select results_eq(
  format(
    $$select type, source, actor_id, payload from public.events where user_id = %L$$, :'approve'
  ),
  format(
    $$values ('admin.user_approved'::text, 'admin'::text, %L::uuid,
              jsonb_build_object('targetUserId', %L::text, 'from', 'pending', 'to', 'active'))$$,
    :'admin', :'approve'
  ),
  '... with one admin.user_approved event: source admin, actor_id the admin, {targetUserId, from, to}'
);
select tests.authenticate_as(:'admin');
select throws_ok(
  format($$select public.admin_set_status(%L, 'suspended')$$, :'reject'),
  'P0001', 'invalid_transition', 'pending -> suspended raises invalid_transition'
);
select throws_ok(
  format($$select public.admin_set_status(%L, 'suspended')$$, :'admin'),
  'P0001', 'cannot_change_self', 'an admin targeting themselves raises cannot_change_self'
);
select throws_ok(
  $$select public.admin_set_status('41000000-0000-4000-8000-00000000dead', 'active')$$,
  'P0001', 'not_found', 'an unknown user raises not_found'
);
select is(
  public.admin_set_status(:'reject', 'rejected'),
  '{"from": "pending", "to": "rejected"}'::jsonb,
  'pending -> rejected'
);
select is(
  public.admin_set_status(:'reject', 'active'),
  '{"from": "rejected", "to": "active"}'::jsonb,
  'rejected -> active'
);
select is(
  public.admin_set_status(:'approve', 'suspended'),
  '{"from": "active", "to": "suspended"}'::jsonb,
  'active -> suspended'
);
select is(
  public.admin_set_status(:'approve', 'active'),
  '{"from": "suspended", "to": "active"}'::jsonb,
  'suspended -> active'
);
select throws_ok(
  format($$select public.admin_set_status(%L, 'rejected')$$, :'approve'),
  'P0001', 'invalid_transition', 'active -> rejected raises invalid_transition'
);
select throws_ok(
  format($$select public.admin_set_status(%L, 'pending')$$, :'approve'),
  'P0001', 'invalid_transition', 'active -> pending raises invalid_transition'
);
select throws_ok(
  format($$select public.admin_set_status(%L, 'active')$$, :'approve'),
  'P0001', 'invalid_transition', 'active -> active raises invalid_transition'
);
select throws_ok(
  format($$select public.admin_set_status(%L, null)$$, :'approve'),
  'P0001', 'invalid_transition', 'a null status raises invalid_transition'
);
select tests.clear_authentication();
select bag_eq(
  format(
    $$select type, source, actor_id, payload ->> 'from' as from_status, payload ->> 'to' as to_status
      from public.events where user_id in (%L, %L)$$,
    :'approve', :'reject'
  ),
  format(
    $$values ('admin.user_approved'::text, 'admin'::text, %1$L::uuid, 'pending'::text, 'active'::text),
             ('admin.user_suspended', 'admin', %1$L, 'active', 'suspended'),
             ('admin.user_approved', 'admin', %1$L, 'suspended', 'active'),
             ('admin.user_rejected', 'admin', %1$L, 'pending', 'rejected'),
             ('admin.user_approved', 'admin', %1$L, 'rejected', 'active')$$,
    :'admin'
  ),
  'each change wrote one audit event of its type; the rejected calls wrote none'
);
select is(
  (select approved_by from public.profiles where id = :'reject'),
  :'admin'::uuid,
  'rejected -> active sets approved_by too'
);
select tests.authenticate_as(:'suspended_admin');
select throws_ok(
  format($$select public.admin_set_status(%L, 'suspended')$$, :'approve'),
  '42501', 'forbidden', 'a suspended admin raises forbidden'
);
select tests.clear_authentication();
select is(
  (select status from public.profiles where id = :'approve'),
  'active',
  '... and changes nothing'
);

-- 4. admin_set_role.
select tests.authenticate_as(:'admin');
select is(
  public.admin_set_role(:'role_target', 'admin'),
  '{"from": "learner", "to": "admin"}'::jsonb,
  'admin_set_role learner -> admin'
);
select tests.clear_authentication();
select is(
  (select role from public.profiles where id = :'role_target'), 'admin', '... changes the role'
);
select results_eq(
  format(
    $$select type, source, actor_id, payload from public.events where user_id = %L$$,
    :'role_target'
  ),
  format(
    $$values ('admin.role_changed'::text, 'admin'::text, %L::uuid,
              jsonb_build_object('targetUserId', %L::text, 'from', 'learner', 'to', 'admin'))$$,
    :'admin', :'role_target'
  ),
  '... and writes one admin.role_changed event'
);
select tests.authenticate_as(:'admin');
select throws_ok(
  format($$select public.admin_set_role(%L, 'admin')$$, :'role_target'),
  'P0001', 'no_change', 'the same role again raises no_change'
);
select throws_ok(
  format($$select public.admin_set_role(%L, 'owner')$$, :'role_target'),
  'P0001', 'invalid_transition', 'a role other than learner or admin raises invalid_transition'
);
select throws_ok(
  format($$select public.admin_set_role(%L, 'learner')$$, :'admin'),
  'P0001', 'cannot_change_self', 'an admin demoting themselves raises cannot_change_self'
);
select throws_ok(
  $$select public.admin_set_role('41000000-0000-4000-8000-00000000dead', 'admin')$$,
  'P0001', 'not_found', 'an unknown user raises not_found'
);
select is(
  public.admin_set_role(:'role_target', 'learner'),
  '{"from": "admin", "to": "learner"}'::jsonb,
  'admin_set_role admin -> learner'
);
select tests.authenticate_as(:'learner');
select throws_ok(
  format($$select public.admin_set_role(%L, 'admin')$$, :'learner'),
  '42501', 'forbidden', 'a learner calling admin_set_role raises forbidden'
);
select tests.clear_authentication();
select is(
  (select count(*)::int from public.events where user_id = :'role_target'),
  2,
  'two role changes, two audit events'
);

-- 5. admin_bootstrap (decision 23): only a never-processed profile is promoted.
select tests.authenticate_as_service_role();
select is(public.admin_bootstrap(:'boot_new'), true, 'bootstrap of a never-processed user');
select tests.clear_authentication();
select results_eq(
  format(
    $$select role, status, approved_at, approved_by from public.profiles where id = %L$$,
    :'boot_new'
  ),
  $$values ('admin'::text, 'active'::text, now(), null::uuid)$$,
  '... makes an active admin, approved now'
);
select results_eq(
  format(
    $$select type, source, actor_id, payload from public.events where user_id = %L$$, :'boot_new'
  ),
  format(
    $$values ('admin.bootstrapped'::text, 'system'::text, %1$L::uuid,
              jsonb_build_object('targetUserId', %1$L::text, 'from', 'pending', 'to', 'active'))$$,
    :'boot_new'
  ),
  '... with one admin.bootstrapped event: source system, actor_id the user'
);
select tests.authenticate_as_service_role();
select is(public.admin_bootstrap(:'boot_new'), false, 'bootstrap again returns false');
select is(
  public.admin_bootstrap(:'boot_suspended'), false, 'bootstrap of a suspended admin returns false'
);
select is(
  public.admin_bootstrap(:'boot_demoted'),
  false,
  'bootstrap of a demoted admin (learner, active, approved_at set) returns false'
);
select is(
  public.admin_bootstrap(:'boot_rejected'), false, 'bootstrap of a rejected learner returns false'
);
select is(
  public.admin_bootstrap(:'boot_processed'),
  false,
  'bootstrap of a pending learner with approved_at set returns false'
);
select is(
  public.admin_bootstrap('41000000-0000-4000-8000-00000000dead'),
  false,
  'bootstrap of an unknown user returns false'
);
select tests.clear_authentication();
select is(
  (select count(*)::int from public.events where user_id = :'boot_new'),
  1,
  'the repeated bootstrap wrote no second event'
);
select set_eq(
  format(
    $$select id, role, status from public.profiles where id in (%L, %L, %L, %L)$$,
    :'boot_suspended', :'boot_demoted', :'boot_rejected', :'boot_processed'
  ),
  format(
    $$values (%L::uuid, 'admin'::text, 'suspended'::text), (%L, 'learner', 'active'),
             (%L, 'learner', 'rejected'), (%L, 'learner', 'pending')$$,
    :'boot_suspended', :'boot_demoted', :'boot_rejected', :'boot_processed'
  ),
  'the suspended admin stays suspended, the demoted admin a learner, the rejected learner rejected'
);
select is(
  (select count(*)::int from public.events
    where user_id in (:'boot_suspended', :'boot_demoted', :'boot_rejected', :'boot_processed')),
  0,
  '... and none of them got an event'
);

-- 6. System and admin events are not counted against the learner quota.
select is(
  (select count(*)::int from public.events
    where user_id in (:'onboarding', :'approve', :'reject', :'role_target', :'boot_new')),
  11,
  '(this file wrote 11 system and admin events)'
);
select is(
  (select count(*)::int from public.event_quota
    where user_id in (:'onboarding', :'approve', :'reject', :'role_target', :'boot_new')),
  0,
  'admin and system events do not touch event_quota'
);

select * from finish();
rollback;
