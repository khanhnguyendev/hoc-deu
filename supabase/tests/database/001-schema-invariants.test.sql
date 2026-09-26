begin;
set client_min_messages = warning;
create extension if not exists pgtap with schema extensions;
\ir _helpers.psql

-- Allowlist of `public` functions `authenticated` may EXECUTE (check 6 below), kept as data so a
-- migration that adds a function `authenticated` may call only has to touch this one INSERT, in
-- the same commit. One row per overload the function has — check 6 uses bag (multiset) equality,
-- so a second overload of an already-listed name must be listed again or the check fails (an
-- overload is a distinct, separately-grantable function). 2.4 adds is_active and is_admin; 2.5
-- adds local_day, user_local_day, learner_event_types and rules_version (the events trigger and
-- the rules_version column default run as the inserting user); 2.5b adds apply_event,
-- admin_set_status and admin_set_role (the admin functions check the caller themselves); 2.8
-- adds admin_list_users (checks is_admin() itself). The final M2 list (2.4-2.8):
-- is_active, is_admin, local_day, user_local_day, learner_event_types, rules_version, apply_event,
-- admin_set_status, admin_set_role, admin_list_users. 4.9a adds mark_plan_seen (checks the caller
-- itself) and plan_lock_key (the invoker apply_event takes the plan lock as the learner). 4.9b
-- adds apply_derived_changes (SECURITY INVOKER: the invoker apply_event writes the derived rows as
-- the learner, under RLS and the derived-table bounds). 4.9c adds none: plans and the auto
-- check-in go through apply_system_event, which stays service_role only (041, 072). 5.0b adds
-- none: plan.extra_added goes through apply_system_event, and its two trigger functions
-- (plan_block_state_check_in_day, schedule_versions_lock_user) get no grants (073). 5.7a adds
-- health (SECURITY INVOKER, `select true`: /api/health's cheap query); the ops_* functions are
-- service_role only (080).
create temporary table _authenticated_allowlist (proname text) on commit drop;
insert into _authenticated_allowlist (proname) values
  ('is_active'), ('is_admin'),
  ('local_day'), ('user_local_day'), ('learner_event_types'), ('rules_version'),
  ('apply_event'), ('admin_set_status'), ('admin_set_role'),
  ('admin_list_users'),
  ('mark_plan_seen'), ('plan_lock_key'),
  ('apply_derived_changes'),
  ('health');

-- Allowlist of `public` functions `anon` may EXECUTE (check 5), overload for overload like the
-- one above. Only 5.7a's health(): /api/health calls it with the publishable key and no session.
-- A SECURITY DEFINER function may never be listed here (check 4).
create temporary table _anon_allowlist (proname text) on commit drop;
insert into _anon_allowlist (proname) values ('health');

select plan(8);

-- 1. Every table (relkind r, p) in public has row level security enabled.
select is_empty(
  $$
  select c.relname
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r', 'p')
    and not c.relrowsecurity
  $$,
  'every table in public has row level security enabled'
);

-- 2. Every view in public has security_invoker=true.
select is_empty(
  $$
  select c.relname
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'v'
    and not coalesce(
      (
        select split_part(opt, '=', 2)::boolean
        from unnest(c.reloptions) as opt
        where opt like 'security_invoker=%'
      ),
      false
    )
  $$,
  'every view in public has security_invoker=true'
);

-- 3. anon holds no privilege on any table, view, materialized view, foreign table or sequence in
--    public. Materialized views and foreign tables are included: Supabase's default privileges
--    grant anon SELECT on a new materialized view.
-- `case` (not `and`/`or`, which Postgres may reorder) keeps has_sequence_privilege from ever
-- being called on a non-sequence relation.
select is_empty(
  $$
  select c.relname
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r', 'p', 'v', 'm', 'f', 'S')
    and case c.relkind
      when 'S' then has_sequence_privilege('anon', c.oid, 'USAGE,SELECT,UPDATE')
      else
        has_table_privilege(
          'anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'
        )
        or has_any_column_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,REFERENCES')
    end
  $$,
  'anon has no privilege on any table, view, materialized view, foreign table or sequence in public'
);

-- 4. Every SECURITY DEFINER function in public sets search_path, has an explicit ACL with no
--    PUBLIC entry, and grants no EXECUTE to anon.
select is_empty(
  $$
  select p.proname
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prosecdef
    and (
      not exists (
        select 1 from unnest(coalesce(p.proconfig, '{}')) as cfg where cfg like 'search_path=%'
      )
      or p.proacl is null
      or exists (select 1 from aclexplode(p.proacl) a where a.grantee = 0)
      or has_function_privilege('anon', p.oid, 'EXECUTE')
    )
  $$,
  'every SECURITY DEFINER function in public sets search_path, has an explicit ACL with no '
  'PUBLIC entry, and grants no EXECUTE to anon'
);

-- 5. anon may EXECUTE exactly the allowlisted public functions (health() only, task 5.7a),
--    overload for overload (bag_eq, as check 6). Unlike check 6, extension-owned functions are
--    not excluded: anon may execute none in public, so one that becomes executable must fail.
select bag_eq(
  $$
  select p.proname
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and has_function_privilege('anon', p.oid, 'EXECUTE')
  $$,
  $$ select proname from _anon_allowlist $$,
  'anon may EXECUTE exactly the allowlisted public functions, overload for overload'
);

-- 6. authenticated may EXECUTE exactly the allowlisted public functions, overload for overload.
-- bag_eq (not set_eq, which de-duplicates): a second overload of an allowlisted name must appear
-- in the allowlist a second time, or this fails — set_eq would silently let an unlisted overload
-- of a listed name through.
select bag_eq(
  $$
  select p.proname
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and has_function_privilege('authenticated', p.oid, 'EXECUTE')
    and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  $$,
  $$ select proname from _authenticated_allowlist $$,
  'authenticated may EXECUTE exactly the allowlisted public functions, overload for overload'
);

-- 7. backup_reader (task 5.7a, 5.7b's pg_dump role) may SELECT every table, view, materialized
--    view and foreign table in public except the internal event_quota, and not event_quota — so
--    a later table is never silently missing from the backup (the migration's default privileges
--    cover tables postgres creates; this catches any other owner).
select is_empty(
  $$
  select c.relname
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r', 'p', 'v', 'm', 'f')
    and case c.relname
      when 'event_quota' then has_table_privilege('backup_reader', c.oid, 'SELECT')
      else not has_table_privilege('backup_reader', c.oid, 'SELECT')
    end
  $$,
  'backup_reader may select every relation in public except event_quota, and not event_quota'
);

-- 8. backup_reader only reads: no write privilege on any relation in public, and SELECT (for
--    pg_dump's setval) but no USAGE or UPDATE on every sequence. `case` as in check 3.
select is_empty(
  $$
  select c.relname
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r', 'p', 'v', 'm', 'f', 'S')
    and case c.relkind
      when 'S' then
        not has_sequence_privilege('backup_reader', c.oid, 'SELECT')
        or has_sequence_privilege('backup_reader', c.oid, 'USAGE,UPDATE')
      else
        has_table_privilege(
          'backup_reader', c.oid, 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'
        )
        or has_any_column_privilege('backup_reader', c.oid, 'INSERT,UPDATE,REFERENCES')
    end
  $$,
  'backup_reader has no write privilege in public and reads every sequence'
);

select * from finish();
rollback;
