begin;
set client_min_messages = warning;
create extension if not exists pgtap with schema extensions;
\ir _helpers.psql

select plan(24);

-- Task 5.7c (ADR-0029): backup_reader reads the auth accounts through backup.auth_users() and
-- backup.auth_identities() only — SECURITY DEFINER functions that return an allow-listed set of
-- columns (tools/backup/auth-columns.ts; tools/backup/auth-columns.test.ts checks that this file
-- pins the same lists). Schema-wide rules for the backup schema are in 001 (checks 9-11).

select tests.create_user('backup-auth-a@hocdeu.test') as user_a \gset
select tests.create_user(
  'backup-auth-b@hocdeu.test', 'active', 'admin', '{"full_name": "Người thứ hai"}'
) as user_b \gset
insert into auth.identities (
  provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
) values
  (:'user_a', :'user_a',
   jsonb_build_object('sub', :'user_a', 'email', 'backup-auth-a@hocdeu.test'),
   'email', now(), now(), now()),
  ('gh-5-7c', :'user_b',
   jsonb_build_object('sub', 'gh-5-7c', 'email', 'backup-auth-b@hocdeu.test'),
   'github', now(), now(), now());
-- Secrets and pending changes in the never-list columns: none of them may come out.
update auth.users
set encrypted_password = 'never-out-password',
    confirmation_token = 'never-out-confirmation',
    recovery_token = 'never-out-recovery',
    email_change = 'never-out@hocdeu.test',
    email_change_token_new = 'never-out-change',
    reauthentication_token = 'never-out-reauthentication'
where id = :'user_a';

-- Runs p_sql as backup_reader, then returns to postgres (080's helper). Returns the first column
-- of the first row as text, or 'ERROR <sqlstate>: <message>' when the statement fails. The
-- membership that lets postgres SET ROLE is granted here and rolled back with the test.
create function tests.as_backup_reader(p_sql text) returns text language plpgsql as $$
declare
  v_result text;
begin
  execute 'set local role backup_reader';
  begin
    execute p_sql into v_result;
  exception when others then
    v_result := format('ERROR %s: %s', sqlstate, sqlerrm);
  end;
  execute 'set local role none';
  return v_result;
end $$;
grant backup_reader to postgres;

-- ---------------------------------------------------------------------------------------------
-- 1. The functions: exactly the allow-list, never a secret column, not tied to the auth tables.
-- ---------------------------------------------------------------------------------------------

select has_schema('backup', 'schema backup exists');
select functions_are(
  'backup', array['auth_identities', 'auth_users'], 'schema backup holds the two auth readers'
);
select is(
  pg_get_function_result('backup.auth_users()'::regprocedure),
  'TABLE(id uuid, aud character varying, role character varying, email character varying, email_confirmed_at timestamp with time zone, raw_app_meta_data jsonb, raw_user_meta_data jsonb, created_at timestamp with time zone, updated_at timestamp with time zone, last_sign_in_at timestamp with time zone, is_anonymous boolean, instance_id uuid)',
  'backup.auth_users() returns exactly the auth.users allow-list'
);
select is(
  pg_get_function_result('backup.auth_identities()'::regprocedure),
  'TABLE(id uuid, user_id uuid, provider text, provider_id text, identity_data jsonb, created_at timestamp with time zone, updated_at timestamp with time zone, last_sign_in_at timestamp with time zone)',
  'backup.auth_identities() returns exactly the auth.identities allow-list (no generated email)'
);
select is_empty(
  $$
  select p.proname, a.name
  from pg_proc p
  cross join lateral unnest(p.proargnames, p.proargmodes) as a (name, mode)
  where p.pronamespace = 'backup'::regnamespace
    and a.mode = 't'
    and a.name ~ '^(encrypted_password$|confirmation_|recovery_|email_change|phone_change|reauthentication_)|_token'
  $$,
  'no returned column is a password, a token or a pending change (the never-list)'
);
select results_eq(
  $$
  select p.proname::text collate "default", l.lanname::text collate "default",
         p.prosqlbody is null, p.provolatile::text collate "default", p.prosecdef,
         p.proconfig collate "default"
  from pg_proc p
  join pg_language l on l.oid = p.prolang
  where p.pronamespace = 'backup'::regnamespace
  order by 1
  $$,
  $$
  values
    ('auth_identities'::text, 'plpgsql'::text, true, 's'::text, true,
     array['search_path=""', 'row_security=off']),
    ('auth_users', 'plpgsql', true, 's', true, array['search_path=""', 'row_security=off'])
  $$,
  'both are stable plpgsql SECURITY DEFINER functions (no begin atomic body) with an empty '
  'search_path and row security off'
);
select is_empty(
  $$
  select d.refobjid::regclass
  from pg_depend d
  where d.classid = 'pg_proc'::regclass
    and d.objid in ('backup.auth_users()'::regprocedure, 'backup.auth_identities()'::regprocedure)
    and d.refclassid = 'pg_class'::regclass
  $$,
  'neither function depends on an auth table: a GoTrue migration may drop or retype any column'
);

-- ---------------------------------------------------------------------------------------------
-- 2. As backup_reader: every row, the allow-listed values, no secret.
-- ---------------------------------------------------------------------------------------------

select is(
  tests.as_backup_reader('select count(*) from backup.auth_users()'),
  (select count(*)::text from auth.users),
  'backup_reader reads every auth.users row through backup.auth_users()'
);
select is(
  tests.as_backup_reader('select count(*) from backup.auth_identities()'),
  (select count(*)::text from auth.identities),
  'backup_reader reads every auth.identities row through backup.auth_identities()'
);
select is(
  tests.as_backup_reader(format(
    $$select string_agg(email || ' ' || aud || ' ' || role, ', ' order by email)
      from backup.auth_users() where id in (%L, %L)$$,
    :'user_a', :'user_b'
  )),
  'backup-auth-a@hocdeu.test authenticated authenticated, '
  'backup-auth-b@hocdeu.test authenticated authenticated',
  'backup.auth_users() returns the test''s users'
);
select is(
  tests.as_backup_reader(format(
    $$select string_agg(provider || ':' || provider_id, ', ' order by provider)
      from backup.auth_identities() where user_id in (%L, %L)$$,
    :'user_a', :'user_b'
  )),
  format('email:%s, github:gh-5-7c', :'user_a'),
  'backup.auth_identities() returns their identities, e-mail and GitHub'
);
select is(
  tests.as_backup_reader(format(
    $$select md5(string_agg(f::text, '|' order by f.id)) from backup.auth_users() f
      where f.id in (%L, %L)$$,
    :'user_a', :'user_b'
  )),
  (select md5(string_agg(
     row(u.id, u.aud, u.role, u.email, u.email_confirmed_at, u.raw_app_meta_data,
         u.raw_user_meta_data, u.created_at, u.updated_at, u.last_sign_in_at,
         u.is_anonymous, u.instance_id)::text, '|' order by u.id))
   from auth.users u where u.id in (:'user_a', :'user_b')),
  'every allow-listed auth.users value comes back unchanged'
);
select is(
  tests.as_backup_reader(format(
    $$select md5(string_agg(f::text, '|' order by f.id)) from backup.auth_identities() f
      where f.user_id in (%L, %L)$$,
    :'user_a', :'user_b'
  )),
  (select md5(string_agg(
     row(i.id, i.user_id, i.provider, i.provider_id, i.identity_data, i.created_at,
         i.updated_at, i.last_sign_in_at)::text, '|' order by i.id))
   from auth.identities i where i.user_id in (:'user_a', :'user_b')),
  'every allow-listed auth.identities value comes back unchanged'
);
select is(
  tests.as_backup_reader(
    $$select count(*) from backup.auth_users() f where f::text like '%never-out%'$$
  ),
  '0',
  'no password, token or pending e-mail change comes out of backup.auth_users()'
);

-- ---------------------------------------------------------------------------------------------
-- 3. Nobody else: not the tables for backup_reader, not the functions for the API roles.
-- ---------------------------------------------------------------------------------------------

select is(
  tests.as_backup_reader('select count(*) from auth.users'),
  'ERROR 42501: permission denied for schema auth',
  'backup_reader cannot read auth.users itself'
);
select is(
  tests.as_backup_reader('select count(*) from auth.identities'),
  'ERROR 42501: permission denied for schema auth',
  'backup_reader cannot read auth.identities itself'
);
select is(
  tests.as_backup_reader(
    'create function backup.leak() returns int language sql as $f$ select 1 $f$'
  ),
  'ERROR 42501: permission denied for schema backup',
  'backup_reader cannot create a function in schema backup'
);

select tests.authenticate_as(:'user_b');
select throws_ok(
  'select count(*) from backup.auth_users()',
  '42501', 'permission denied for schema backup',
  'an authenticated admin cannot call backup.auth_users()'
);
select throws_ok(
  'select count(*) from backup.auth_identities()',
  '42501', 'permission denied for schema backup',
  '... nor backup.auth_identities()'
);
select tests.clear_authentication();

set local role anon;
select throws_ok(
  'select count(*) from backup.auth_users()',
  '42501', 'permission denied for schema backup',
  'anon cannot call backup.auth_users()'
);
select throws_ok(
  'select count(*) from backup.auth_identities()',
  '42501', 'permission denied for schema backup',
  '... nor backup.auth_identities()'
);
select tests.clear_authentication();

select tests.authenticate_as_service_role();
select throws_ok(
  'select count(*) from backup.auth_users()',
  '42501', 'permission denied for schema backup',
  'service_role cannot call backup.auth_users()'
);
select throws_ok(
  'select count(*) from backup.auth_identities()',
  '42501', 'permission denied for schema backup',
  '... nor backup.auth_identities()'
);
select tests.clear_authentication();

select ok(
  not has_function_privilege('public', 'backup.auth_users()', 'EXECUTE')
  and not has_function_privilege('public', 'backup.auth_identities()', 'EXECUTE'),
  'PUBLIC may execute neither function'
);

select * from finish();
rollback;
