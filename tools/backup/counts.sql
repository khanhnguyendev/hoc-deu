-- The row count of every table a backup holds (task 5.7b, ADR-0029): every ordinary table in
-- `public` except `event_quota` (platform design §4.5: never backed up), plus `auth.users` and
-- `auth.identities` when psql's variable `with_auth` is `true`. Extension members are skipped, as
-- pg_dump skips them. Where the auth counts come from is psql's variable `auth_from` (task 5.7c):
-- `functions` in the backup job — backup_reader cannot read the auth tables, only
-- backup.auth_users() and backup.auth_identities(), the same functions auth-dump.sql copies from —
-- and `tables` in the restored database.
--
--   psql -X -q -A -t -F '<tab>' -v ON_ERROR_STOP=1 -v with_auth=true|false \
--     -v auth_from=functions|tables -f tools/backup/counts.sql
--
-- prints one `<schema>.<table><tab><count>` line per table (the auth counts labelled
-- `auth.users` and `auth.identities` either way). The backup job runs it inside the snapshot its
-- dumps used, as backup_reader; the restore test runs it against the restored database. Both
-- compare the result through tools/backup/counts.ts. An unset `with_auth` or `auth_from` is a
-- syntax error, never a silent default.
--
-- Row security off: a count that RLS would filter fails instead of coming back short.
set row_security = off;

select format('select %L, count(*) from %I.%I', n.nspname || '.' || c.relname, n.nspname, c.relname)
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where c.relkind = 'r'
  and (
    (n.nspname = 'public' and c.relname <> 'event_quota')
    or (:'with_auth' = 'true' and :'auth_from' = 'tables' and n.nspname = 'auth' and c.relname in ('users', 'identities'))
  )
  and not exists (
    select from pg_catalog.pg_depend d
    where d.classid = 'pg_catalog.pg_class'::regclass and d.objid = c.oid and d.deptype = 'e'
  )
union all
select format('select %L, count(*) from backup.%I()', 'auth.' || t.name, 'auth_' || t.name)
from (values ('identities'), ('users')) as t (name)
where :'with_auth' = 'true' and :'auth_from' = 'functions'
order by 1
\gexec
