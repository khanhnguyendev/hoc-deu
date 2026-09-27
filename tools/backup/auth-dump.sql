-- The auth accounts of a backup (task 5.7c, ADR-0029). The backup job's snapshot session — the
-- psql that exported the snapshot both dumps use, connected as backup_reader — runs this with
-- `\o <work>/auth.sql`, so auth is read in the same snapshot as public and counted by counts.sql
-- right after it. It writes what pg_dump would write for the two tables, but only the allow-listed
-- columns (tools/backup/auth-columns.ts), read through backup.auth_users() and
-- backup.auth_identities() — backup_reader cannot read the tables themselves:
--
--   \restrict <random key>
--   SET client_encoding = 'UTF8';
--   COPY auth.users (<the allow-list>) FROM stdin;
--   <one line per row, COPY's text format>
--   \.
--   COPY auth.identities (<the allow-list>) FROM stdin;
--   …
--   \.
--   \unrestrict <the same key>
--
-- so tools/backup/dump.ts counts its rows like any pg_dump file, and the restore loads those
-- columns only. `\restrict` keeps psql from running a meta-command while it loads the file; its
-- key is psql's variable `auth_restrict_key`, random, made by the dump step on the runner — as
-- pg_dump makes its key on the client — so the server being dumped never learns it. An error in
-- either function stops the session (ON_ERROR_STOP), and the backup job then fails before
-- anything is encrypted or uploaded.
--
-- Only \qecho: the dump step runs this with the database URL in its environment.
-- auth-columns.test.ts checks every line.
set client_encoding = 'UTF8';
\qecho '\\restrict' :auth_restrict_key
\qecho 'SET client_encoding = ''UTF8'';'
\qecho 'COPY auth.users (id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, last_sign_in_at, is_anonymous, instance_id) FROM stdin;'
copy (select id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, last_sign_in_at, is_anonymous, instance_id from backup.auth_users() order by id) to stdout;
\qecho '\\.'
\qecho 'COPY auth.identities (id, user_id, provider, provider_id, identity_data, created_at, updated_at, last_sign_in_at) FROM stdin;'
copy (select id, user_id, provider, provider_id, identity_data, created_at, updated_at, last_sign_in_at from backup.auth_identities() order by id) to stdout;
\qecho '\\.'
\qecho '\\unrestrict' :auth_restrict_key
