-- Task 6.2a: the bot tables, the per-user AI tables, content_publish_requests, day_plans' AI
-- columns, the rate limiter's fail-open counter and the parked M5-R12 insert bound (platform
-- design §4.1, §4.2, §4.5, §4.6; implementation plan Part B-M6 decisions 5, 13, 18, 20, 22, 27).
-- 1. bot_settings: one row, seeded off — nothing turns on by merging (decision 5).
-- 2. bot_runs, 3. bot_run_users: the run log; the server's bot path uses the secret key.
-- 4. user_items, 5. roadmap_overrides: per-user AI rows, owner read-only (§4.5).
-- 6. content_publish_requests: admins read; writes go through 6.2b's functions.
-- 7. day_plans.rationale and bot_run_id.
-- 8. ops_metrics' ratelimit.fail_open key and ops_bump_metric (decision 22).
-- Task 6.2b adds every M6 SQL function on top of these tables, in its own migration.
-- Table privileges: `revoke all … from anon, authenticated`, then exactly the grants below (the
-- default privileges of 20260925000100 already revoke; this states it). backup_reader reads every
-- new table through the default privileges of 20260927000200 (001 checks it).

-- ---------------------------------------------------------------------------------------------
-- 1. bot_settings (§4.2): one row, seeded OFF (decision 5). No grants to authenticated: admins
--    read and write it through 6.2b's functions (the token hashes never reach a browser).
-- ---------------------------------------------------------------------------------------------

create table public.bot_settings (
  id boolean primary key default true check (id),
  enabled boolean not null default false,
  dry_run boolean not null default true,
  content_proposals boolean not null default false,
  per_run_user_cap integer not null default 10 check (per_run_user_cap between 1 and 100),
  limits jsonb not null default '{}'::jsonb
    check (jsonb_typeof(limits) = 'object' and octet_length(limits::text) <= 1024),
  token_hash text check (token_hash ~ '^[0-9a-f]{64}$'),
  token_prev_hash text check (token_prev_hash ~ '^[0-9a-f]{64}$'),
  token_prev_valid_until timestamptz,
  token_rotated_at timestamptz,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);
insert into public.bot_settings (id) values (true);

-- ---------------------------------------------------------------------------------------------
-- 2. bot_runs (§4.2, §6.2): a plan run `run_<date>` or a publish run `run_<date>_publish-<n>`;
--    the kind agrees with the key's form.
-- ---------------------------------------------------------------------------------------------

create table public.bot_runs (
  id uuid primary key default gen_random_uuid(),
  run_key text not null unique
    check (run_key ~ '^run_[0-9]{4}-[0-9]{2}-[0-9]{2}(_publish-[1-9][0-9]{0,2})?$'),
  kind text not null check (kind in ('plan', 'publish')),
  ops_date date not null,
  mode text not null check (mode in ('live', 'dry_run')),
  status text not null default 'running' check (status in ('running', 'completed', 'failed')),
  failure_reason text check (char_length(failure_reason) <= 64),
  users_eligible integer not null default 0 check (users_eligible >= 0),
  users_deferred integer not null default 0 check (users_deferred >= 0),
  content_pr_url text
    check (content_pr_url ~ '^https://github\.com/khanhnguyendev/hoc-deu/pull/[1-9][0-9]{0,6}$'),
  summary text check (char_length(summary) <= 500),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  check ((kind = 'plan') = (run_key !~ '_publish-'))
);
create index bot_runs_started_idx on public.bot_runs (started_at desc);

-- ---------------------------------------------------------------------------------------------
-- 3. bot_run_users (§4.2): one row per user per run; outcome null = pending. The user's rows go
--    with the account (§4.6).
-- ---------------------------------------------------------------------------------------------

create table public.bot_run_users (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.bot_runs (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  user_ref text not null check (user_ref ~ '^u_[a-z2-7]{16}$'),
  outcome text check (outcome in ('applied', 'dry_run', 'skipped_plan_in_use',
    'skipped_gate_closed', 'skipped_unseen', 'invalid', 'error')),
  writes jsonb not null default '{}'::jsonb
    check (jsonb_typeof(writes) = 'object' and octet_length(writes::text) <= 32768),
  detail jsonb check (detail is null
    or (jsonb_typeof(detail) = 'object' and octet_length(detail::text) <= 49152)),
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (run_id, user_ref),
  unique (run_id, user_id)
);
create index bot_run_users_user_processed_idx on public.bot_run_users (user_id, processed_at desc);

-- ---------------------------------------------------------------------------------------------
-- 4. user_items (§4.1, §5.12): per-user custom items, owner read-only.
-- ---------------------------------------------------------------------------------------------

create table public.user_items (
  user_id uuid not null references public.profiles (id) on delete cascade,
  item_id text not null check (item_id ~ '^user:[0-9a-f]{16}:[a-z0-9-]{3,48}$'),
  item_type text not null check (item_type in ('flashcard', 'exercise', 'prompt')),
  track_id text not null check (track_id ~ '^[a-z][a-z0-9-]{0,31}$'),
  topic_id text not null check (topic_id ~ '^[a-z0-9-]{1,32}$'),
  payload jsonb not null
    check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 2048),
  status text not null default 'active' check (status in ('active', 'hidden', 'retired')),
  created_by_run text not null check (created_by_run ~ '^run_[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  created_on date not null,
  created_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

-- ---------------------------------------------------------------------------------------------
-- 5. roadmap_overrides (§4.1, §5.12; decision 18): owner read-only. Expiry is computed, never
--    stored: the status check does not allow 'expired' (owner Q3, 2026-09-28).
-- ---------------------------------------------------------------------------------------------

create table public.roadmap_overrides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  track_id text not null check (track_id ~ '^[a-z][a-z0-9-]{0,31}$'),
  key text not null check (key ~ '^[a-z0-9-]{3,48}$'),
  kind text not null check (kind in ('insert_block', 'extra_week', 'reorder_topics')),
  params jsonb not null
    check (jsonb_typeof(params) = 'object' and octet_length(params::text) <= 2048),
  status text not null default 'active'
    check (status in ('active', 'revoked', 'suspended')),
  until_local_day date,
  study_days integer check (study_days between 1 and 5),
  start_local_day date not null,
  created_by_run text not null check (created_by_run ~ '^run_[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (user_id, track_id, key),
  check ((kind = 'insert_block') = (until_local_day is not null)),
  check ((kind = 'extra_week') = (study_days is not null))
);

-- ---------------------------------------------------------------------------------------------
-- 6. content_publish_requests (§4.2, §6.6): admins read; writes go through 6.2b's functions. At
--    most one pending request per target.
-- ---------------------------------------------------------------------------------------------

create table public.content_publish_requests (
  id bigint generated always as identity primary key,
  target text not null check (target ~ '^[a-z][a-z0-9-]{0,31}:[a-z0-9:-]{1,120}(#note)?$'),
  requested_by uuid references public.profiles (id) on delete set null,
  requested_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending', 'merged', 'cancelled')),
  pr_url text check (pr_url ~ '^https://github\.com/khanhnguyendev/hoc-deu/pull/[1-9][0-9]{0,6}$'),
  updated_at timestamptz not null default now()
);
create unique index content_publish_requests_pending_target_idx
  on public.content_publish_requests (target) where status = 'pending';

-- ---------------------------------------------------------------------------------------------
-- 7. day_plans gains the AI columns (§4.1). The learner reads them with the table's select grant.
-- ---------------------------------------------------------------------------------------------

alter table public.day_plans
  add column rationale text check (char_length(rationale) <= 280),
  add column bot_run_id uuid references public.bot_runs (id) on delete set null;

-- ---------------------------------------------------------------------------------------------
-- Table privileges and RLS (§4.5). bot_settings, bot_runs and bot_run_users: no grant to anon or
-- authenticated (RLS on, no policy). user_items and roadmap_overrides: the owner reads, nobody
-- writes but the secret key (apply_system_event). content_publish_requests: admins read.
-- ---------------------------------------------------------------------------------------------

revoke all on
  public.bot_settings, public.bot_runs, public.bot_run_users, public.user_items,
  public.roadmap_overrides, public.content_publish_requests
from anon, authenticated;

grant select on public.user_items, public.roadmap_overrides, public.content_publish_requests
to authenticated;

alter table public.bot_settings enable row level security;
alter table public.bot_runs enable row level security;
alter table public.bot_run_users enable row level security;
alter table public.user_items enable row level security;
alter table public.roadmap_overrides enable row level security;
alter table public.content_publish_requests enable row level security;

create policy user_items_select_own on public.user_items
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy roadmap_overrides_select_own on public.roadmap_overrides
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy content_publish_requests_select_admin on public.content_publish_requests
  for select to authenticated
  using ((select public.is_admin()));

-- ---------------------------------------------------------------------------------------------
-- 8. ops_metrics: the rate limiter's fail-open counter (decision 22). The key check's name is
--    Postgres' default for 20260927000200's inline check, ops_metrics_key_check (confirmed with
--    pg_constraint before this drop).
-- ---------------------------------------------------------------------------------------------

alter table public.ops_metrics drop constraint ops_metrics_key_check;
alter table public.ops_metrics add constraint ops_metrics_key_check check (key in (
  'db.size_bytes', 'backup.last_success_at', 'restore_test.last_success_at', 'cron.last_run_at',
  'ratelimit.fail_open'));

-- Adds 1 to today's (UTC) row of p_key, or inserts it with 1; returns the new value. Two
-- concurrent first bumps of a day may insert two rows: readers sum per day. A concurrent bump of
-- an existing row waits on its row lock and adds to the committed value. An unknown key fails
-- the table's check. Best effort for its caller (the rate limiter never throws on it).
create function public.ops_bump_metric(p_key text) returns numeric
language plpgsql security definer set search_path = '' as $$
declare
  v_value numeric;
begin
  update public.ops_metrics m set value = m.value + 1
  where m.id = (
    select l.id from public.ops_metrics l
    where l.key = p_key and l.recorded_at >= pg_catalog.date_trunc('day', now(), 'UTC')
    order by l.recorded_at desc, l.id desc
    limit 1
  )
  returning m.value into v_value;
  if v_value is null then
    insert into public.ops_metrics (key, value) values (p_key, 1) returning value into v_value;
  end if;
  return v_value;
end $$;

revoke execute on function public.ops_bump_metric(text)
from public, anon, authenticated, service_role;
grant execute on function public.ops_bump_metric(text) to service_role;
