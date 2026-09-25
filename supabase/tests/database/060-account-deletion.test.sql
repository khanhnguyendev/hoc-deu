begin;
set client_min_messages = warning;
create extension if not exists pgtap with schema extensions;
\ir _helpers.psql

select plan(14);

-- §4.6: deleting the auth.users row cascades to every one of that user's own rows. Another
-- user's admin audit event, whose actor_id is the deleted account, has no FK on actor_id and
-- survives.

select tests.create_user('delete-target@hocdeu.test') as target \gset
select tests.create_user('delete-admin@hocdeu.test', 'active', 'admin') as admin \gset
select tests.create_user('delete-other@hocdeu.test') as other \gset

-- The target's own rows: a schedule version and a track (direct inserts — the first version of a
-- user bypasses the backdate check), an event and its quota row (through apply_event, so the
-- quota trigger fires).
insert into public.schedule_versions (user_id, effective_at, timezone, day_starts_at)
values (:'target', now() - interval '1 day', 'Asia/Ho_Chi_Minh', '04:00');
insert into public.user_tracks (user_id, track_id, roadmap_variant, start_date, budget_minutes)
values (:'target', 'dsa', '10w', '2026-09-25', 60);
select tests.authenticate_as(:'target');
select public.apply_event(
  '{"id": "60000000-0000-4000-8000-000000000001", "type": "track.updated", "track_id": "dsa",
    "payload": {"budgetMinutes": 90}, "rules_version": 1}'
);
select tests.clear_authentication();

-- The admin acts on `other` (not the target): one admin.* audit event, actor_id the admin.
select tests.authenticate_as(:'admin');
select public.admin_set_status(:'other', 'suspended');
select tests.clear_authentication();

-- Baseline: every row is there before either deletion.
select is((select count(*)::int from public.profiles where id = :'target'), 1, 'the target has a profile');
select is(
  (select count(*)::int from public.schedule_versions where user_id = :'target'), 1,
  '... a schedule version'
);
select is((select count(*)::int from public.user_tracks where user_id = :'target'), 1, '... a track');
select is((select count(*)::int from public.events where user_id = :'target'), 1, '... an event');
select is(
  (select count(*)::int from public.event_quota where user_id = :'target'), 1, '... a quota row'
);
select is(
  (select count(*)::int from public.events where user_id = :'other' and actor_id = :'admin'), 1,
  'the admin''s audit event on `other` exists'
);

-- Deleting the target's auth.users row cascades to every one of their own rows.
delete from auth.users where id = :'target';
select is((select count(*)::int from public.profiles where id = :'target'), 0, 'profile gone');
select is(
  (select count(*)::int from public.schedule_versions where user_id = :'target'), 0,
  '... schedule versions gone'
);
select is((select count(*)::int from public.user_tracks where user_id = :'target'), 0, '... tracks gone');
select is((select count(*)::int from public.events where user_id = :'target'), 0, '... events gone');
select is(
  (select count(*)::int from public.event_quota where user_id = :'target'), 0, '... quota gone'
);

-- Deleting the admin's auth.users row leaves `other`'s audit event alone: no FK on actor_id.
delete from auth.users where id = :'admin';
select is((select count(*)::int from public.profiles where id = :'admin'), 0, 'the admin''s profile is gone');
select is((select count(*)::int from public.profiles where id = :'other'), 1, '... `other` is untouched');
select results_eq(
  format(
    $$select type, source, actor_id from public.events where user_id = %L$$, :'other'
  ),
  format(
    $$values ('admin.user_suspended'::text, 'admin'::text, %L::uuid)$$, :'admin'
  ),
  '... and the audit event survives with the deleted admin as actor_id'
);

select * from finish();
rollback;
