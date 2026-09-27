-- Task 5.7a: ops_metrics, the maintenance functions, health() and the backup_reader role
-- (platform design §2.3, §4.2, §4.5, §8.4 items 3 and 5; implementation plan Part B-M5
-- decision 26; ADR-0034).
-- 1. ops_metrics: the admin warnings' numbers (DB size, the last successful backup and restore
--    test, the last maintenance run), written once a day by the maintenance cron.
-- 2. ops_record_metric, ops_record_db_size, ops_prune: the cron's database steps, for the secret
--    key (service_role) only. Each is safe to run twice or to skip a day.
-- 3. health(): the cheap query behind /api/health, for anon (the publishable key, no session).
-- 4. backup_reader: the read-only role 5.7b's pg_dump runs as.
-- Every function revokes EXECUTE from PUBLIC explicitly and grants exactly its callers (see
-- 20260925000100); schema-invariants (001) and 080 check it.

-- ---------------------------------------------------------------------------------------------
-- 1. ops_metrics (§4.2): admin only. Timestamps are stored as Unix epoch seconds
-- (`to_timestamp(value)` reads them back); sizes in bytes. One row per recording, so the history
-- stays (400 days, see ops_prune); readers take the latest row per key through the index.
-- ---------------------------------------------------------------------------------------------

create table public.ops_metrics (
  id bigint generated always as identity primary key,
  key text not null check (key in (
    'db.size_bytes',
    'backup.last_success_at',
    'restore_test.last_success_at',
    'cron.last_run_at'
  )),
  value numeric not null,
  recorded_at timestamptz not null default now()
);
create index ops_metrics_key_recorded_idx on public.ops_metrics (key, recorded_at desc);

-- Admins read (the /admin warnings, task 5.6); nobody writes but the functions below.
revoke all on public.ops_metrics from anon, authenticated;
grant select on public.ops_metrics to authenticated;

alter table public.ops_metrics enable row level security;

create policy ops_metrics_select_admin on public.ops_metrics
  for select to authenticated
  using ((select public.is_admin()));

-- ---------------------------------------------------------------------------------------------
-- 2. The maintenance cron's database steps (§2.3, §8.4 item 3). SECURITY DEFINER, so the cron
-- needs no table grants; EXECUTE for service_role only.
-- ---------------------------------------------------------------------------------------------

-- Records one value. An unknown key or a null value is an error (the table's checks), never a
-- silent no-op. Not strict: a strict function would return null for a null value instead.
create function public.ops_record_metric(p_key text, p_value numeric) returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.ops_metrics (key, value) values (p_key, p_value);
end $$;

-- Records the database size (the 100 / 350 / 450 MB admin warnings, §8.4 item 5) and returns it.
create function public.ops_record_db_size() returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  v_size constant bigint := pg_catalog.pg_database_size(pg_catalog.current_database());
begin
  insert into public.ops_metrics (key, value) values ('db.size_bytes', v_size);
  return v_size;
end $$;

-- Deletes the event_quota rows of local days before the day before yesterday (§4.5: only the
-- current local day's counter matters, and a learner's local day is at most one day off the
-- database's date) and the ops_metrics rows older than 400 days (a year of history for the
-- warnings). Returns both counts: { "event_quota": n, "ops_metrics": m }. A second run the same
-- day deletes nothing.
create function public.ops_prune() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_quota integer;
  v_metrics integer;
begin
  delete from public.event_quota where local_day < current_date - 2;
  get diagnostics v_quota = row_count;
  delete from public.ops_metrics where recorded_at < now() - interval '400 days';
  get diagnostics v_metrics = row_count;
  return jsonb_build_object('event_quota', v_quota, 'ops_metrics', v_metrics);
end $$;

-- ---------------------------------------------------------------------------------------------
-- 3. health() (§2.3): /api/health's cheap query. SECURITY INVOKER, reads nothing; a round trip
-- through PostgREST to Postgres is the whole check.
-- ---------------------------------------------------------------------------------------------

create function public.health() returns boolean
language sql stable security invoker set search_path = '' as $$
  select true
$$;

-- ---------------------------------------------------------------------------------------------
-- Function privileges (controller ruling R5): PUBLIC's default EXECUTE and Supabase's default
-- grants are revoked from every function of this migration, then each gets exactly its callers.
-- ---------------------------------------------------------------------------------------------

revoke execute on function
  public.ops_record_metric(text, numeric),
  public.ops_record_db_size(),
  public.ops_prune(),
  public.health()
from public, anon, authenticated, service_role;

grant execute on function
  public.ops_record_metric(text, numeric),
  public.ops_record_db_size(),
  public.ops_prune()
to service_role;

grant execute on function public.health() to anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- 4. backup_reader (§2.3 backups; task 5.7b): pg_dump --data-only of public minus event_quota.
-- Every public table has RLS with policies for `authenticated` only, so without BYPASSRLS
-- pg_dump aborts ("query would be affected by row-level security policy"). Roles are
-- cluster-wide and `pnpm db:reset` re-runs this file, so the role is created only when missing.
-- NOLOGIN here: its LOGIN and password are set out of band (5.7b's runbook), never in git; so is
-- any grant on schema auth (hosted postgres holds no grantable USAGE on it).
-- ---------------------------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'backup_reader') then
    create role backup_reader nologin bypassrls;
  end if;
end $$;

grant usage on schema public to backup_reader;
-- Every table but the internal event_quota (§4.5: never backed up, pruned after 2 days).
grant select on all tables in schema public to backup_reader;
revoke all on public.event_quota from backup_reader;
-- Every sequence: pg_dump --data-only emits setval for ops_metrics' identity.
grant select on all sequences in schema public to backup_reader;
-- Tables and sequences later migrations create (as postgres). 001 fails if one is unreadable.
alter default privileges in schema public grant select on tables to backup_reader;
alter default privileges in schema public grant select on sequences to backup_reader;
