-- Task 5.7c: the auth accounts in the backup, through allow-listed functions (platform design
-- §2.3; owner ruling 2026-09-27; ADR-0029, which this task amends).
--
-- On hosted Supabase, postgres holds SELECT WITH GRANT OPTION on auth.users and auth.identities
-- but no grantable USAGE on schema auth, so backup_reader (20260927000200_ops.sql) cannot be given
-- the tables. It gets two functions instead, in a schema of their own:
--   backup.auth_users(), backup.auth_identities() — SECURITY DEFINER, owned by postgres (the
--   migration role), executable by backup_reader only. Each returns an explicit column allow-list
--   (tools/backup/auth-columns.ts — its test checks this file against it): what GoTrue needs to
--   load an account again after a restore, never a password, a token or a pending change. A new
--   GoTrue column never leaks in: there is no `select *`.
-- Why functions, not views: a view pins the columns it names, so a GoTrue migration that drops or
-- retypes one would fail on hosted. A plpgsql body is not dependency-tracked (a `begin atomic` SQL
-- body would be); a dropped column fails the backup loudly instead, and each column is cast to its
-- declared type, so a compatible retype (varchar → text) keeps the backup working.
-- `row_security = off`: postgres bypasses RLS (auth.users has it on); should it ever stop, the
-- functions fail instead of silently returning fewer rows.
-- Schema backup is not exposed through the Data API (supabase/config.toml [api].schemas; on
-- hosted, docs/ops/backups.md §2 step 4 checks it). 001 and 081 check the rules below.

create schema backup;
revoke all on schema backup from public;
grant usage on schema backup to backup_reader;

-- instance_id: GoTrue looks every user up by the nil instance id it writes; restored with null,
-- a user is "not found" (the local round trip, task 5.7c).
create function backup.auth_users()
returns table (
  id uuid,
  aud character varying,
  role character varying,
  email character varying,
  email_confirmed_at timestamp with time zone,
  raw_app_meta_data jsonb,
  raw_user_meta_data jsonb,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  last_sign_in_at timestamp with time zone,
  is_anonymous boolean,
  instance_id uuid
)
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
begin
  return query
  select
    u.id::uuid,
    u.aud::character varying,
    u.role::character varying,
    u.email::character varying,
    u.email_confirmed_at::timestamp with time zone,
    u.raw_app_meta_data::jsonb,
    u.raw_user_meta_data::jsonb,
    u.created_at::timestamp with time zone,
    u.updated_at::timestamp with time zone,
    u.last_sign_in_at::timestamp with time zone,
    u.is_anonymous::boolean,
    u.instance_id::uuid
  from auth.users as u;
end
$$;

-- `email` is left out: GENERATED ALWAYS from identity_data, so a restore cannot load it and gets
-- it back anyway.
create function backup.auth_identities()
returns table (
  id uuid,
  user_id uuid,
  provider text,
  provider_id text,
  identity_data jsonb,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  last_sign_in_at timestamp with time zone
)
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
begin
  return query
  select
    i.id::uuid,
    i.user_id::uuid,
    i.provider::text,
    i.provider_id::text,
    i.identity_data::jsonb,
    i.created_at::timestamp with time zone,
    i.updated_at::timestamp with time zone,
    i.last_sign_in_at::timestamp with time zone
  from auth.identities as i;
end
$$;

revoke all on function backup.auth_users() from public, anon, authenticated, service_role;
revoke all on function backup.auth_identities() from public, anon, authenticated, service_role;
grant execute on function backup.auth_users() to backup_reader;
grant execute on function backup.auth_identities() to backup_reader;
