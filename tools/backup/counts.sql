-- The row count of every table a backup holds (task 5.7b, ADR-0029): every ordinary table in
-- `public` except `event_quota` (platform design §4.5: never backed up), plus `auth.users` and
-- `auth.identities` when psql's variable `with_auth` is `true`. Extension members are skipped, as
-- pg_dump skips them.
--
--   psql -X -q -A -t -F '<tab>' -v ON_ERROR_STOP=1 -v with_auth=true|false -f tools/backup/counts.sql
--
-- prints one `<schema>.<table><tab><count>` line per table. The backup job runs it inside the
-- snapshot its pg_dump runs used, as backup_reader; the restore test runs it against the restored
-- database. Both compare the result through tools/backup/counts.ts. An unset `with_auth` is a
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
    or (:'with_auth' = 'true' and n.nspname = 'auth' and c.relname in ('users', 'identities'))
  )
  and not exists (
    select from pg_catalog.pg_depend d
    where d.classid = 'pg_catalog.pg_class'::regclass and d.objid = c.oid and d.deptype = 'e'
  )
order by n.nspname, c.relname
\gexec
