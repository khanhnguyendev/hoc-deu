begin;
create extension if not exists pgtap with schema extensions;
\ir _helpers.psql

-- Allowlist of `public` functions `authenticated` may EXECUTE (check 6 below). A migration that
-- adds a function `authenticated` may call adds it here, in the same commit. Empty in 2.1 (nothing
-- exists yet, every check below passes vacuously). The final M2 list (2.4-2.8): is_active,
-- is_admin, local_day, user_local_day, learner_event_types, rules_version, apply_event,
-- admin_set_status, admin_set_role, admin_list_users.

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

-- 3. anon holds no privilege on any table, view or sequence in public.
-- `case` (not `and`/`or`, which Postgres may reorder) keeps has_sequence_privilege from ever
-- being called on a non-sequence relation.
select is_empty(
  $$
  select c.relname
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r', 'p', 'v', 'S')
    and case c.relkind
      when 'S' then has_sequence_privilege('anon', c.oid, 'USAGE,SELECT,UPDATE')
      else
        has_table_privilege(
          'anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'
        )
        or has_any_column_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,REFERENCES')
    end
  $$,
  'anon has no privilege on any table, view or sequence in public'
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

-- 6. authenticated may EXECUTE exactly the allowlisted public functions.
select set_eq(
  $$
  select p.proname
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and has_function_privilege('authenticated', p.oid, 'EXECUTE')
    and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  $$,
  $$ select unnest(array[]::text[]) $$,
  'authenticated may EXECUTE exactly the allowlisted public functions'
);

select * from finish();
rollback;
