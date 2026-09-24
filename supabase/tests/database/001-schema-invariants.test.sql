begin;
create extension if not exists pgtap with schema extensions;
\ir _helpers.psql

-- Allowlist of `public` functions `authenticated` may EXECUTE (check 6 below), kept as data so a
-- migration that adds a function `authenticated` may call only has to touch this one INSERT, in
-- the same commit. One row per overload the function has — check 6 uses bag (multiset) equality,
-- so a second overload of an already-listed name must be listed again or the check fails (an
-- overload is a distinct, separately-grantable function). Empty in 2.1 (nothing exists yet, every
-- check below passes vacuously). The final M2 list (2.4-2.8): is_active, is_admin, local_day,
-- user_local_day, learner_event_types, rules_version, apply_event, admin_set_status,
-- admin_set_role, admin_list_users.
create temporary table _authenticated_allowlist (proname text) on commit drop;
-- insert into _authenticated_allowlist (proname) values ('is_active'), ('is_admin'), ...;

select plan(6);

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

-- 5. anon has EXECUTE on no function in public.
select is_empty(
  $$
  select p.proname
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and has_function_privilege('anon', p.oid, 'EXECUTE')
  $$,
  'anon has EXECUTE on no function in public'
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

select * from finish();
rollback;
