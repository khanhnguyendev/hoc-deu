-- Task 4.9a: day_plans and the derived tables (platform design §4.1, §4.3, §4.5, §5.2;
-- implementation plan Part B-M4 decisions 6, 9, 11, 18, 33, 35).
-- - Plans are written only by the server (apply_system_event, 4.9c); learners read their own and
--   set seen_at through mark_plan_seen. Plans are permanent: only the account-deletion cascade
--   removes one (decision 35).
-- - item_state, plan_block_state and daily_activity are derived rows the learner writes through
--   apply_event (SECURITY INVOKER, 4.9b) — and so could write directly. They are bounded like the
--   state tables (ruling R14, decision 11): row triggers for `authenticated`, UPDATE granted per
--   column and never on a key column.
-- Merged migrations are never edited: rules_version and events_prepare are replaced here
-- (`create or replace` keeps their owner, privileges and triggers). Every function revokes
-- EXECUTE from PUBLIC explicitly and grants exactly its callers (see 20260925000100);
-- schema-invariants (001) and 070 check it.

-- ---------------------------------------------------------------------------------------------
-- §4.7 / decision 18: the first rules with plan and SRS behaviour (lib/domain/rules.ts).
-- tools/db/sql-sync.test.ts compares the last definition with RULES_VERSION, and 070 checks the
-- running function against the same number.
-- ---------------------------------------------------------------------------------------------

create or replace function public.rules_version() returns integer
language sql immutable set search_path = '' as $$
  select 2
$$;

-- ---------------------------------------------------------------------------------------------
-- Tables (§4.1; decision 6 adds plan_block_state.track_id and checked_in_on, day_plans'
-- roadmap_weeks snapshot and user_tracks.reset_on)
-- ---------------------------------------------------------------------------------------------

create table public.day_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  plan_date date not null,
  source text not null default 'baseline' check (source in ('baseline', 'ai')),
  version integer not null default 1 check (version >= 1),
  blocks jsonb not null check (jsonb_typeof(blocks) = 'array' and octet_length(blocks::text) <= 131072),
  roadmap_weeks jsonb not null default '{}'::jsonb
    check (jsonb_typeof(roadmap_weeks) = 'object' and octet_length(roadmap_weeks::text) <= 8192),
  rules_version integer not null default public.rules_version() check (rules_version >= 1),
  seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, plan_date)
);
create trigger set_updated_at before update on public.day_plans
  for each row execute function public.set_updated_at();

create table public.plan_block_state (
  plan_id uuid not null references public.day_plans (id) on delete cascade,
  block_id text not null check (octet_length(block_id) <= 128),
  user_id uuid not null references public.profiles (id) on delete cascade,
  track_id text not null check (track_id ~ '^[a-z][a-z0-9-]{0,31}$'),
  status text not null check (status in ('done', 'partial', 'skipped')),
  minutes integer not null check (minutes between 0 and 600),
  note text check (char_length(note) <= 1000),
  auto boolean not null default false,
  checked_in_on date not null,
  checked_in_at timestamptz not null default now(),
  version integer not null default 1 check (version >= 1),
  rules_version integer not null default public.rules_version() check (rules_version >= 1),
  primary key (plan_id, block_id)
);

create table public.item_state (
  user_id uuid not null references public.profiles (id) on delete cascade,
  item_id text not null check (octet_length(item_id) <= 128),
  track_id text not null check (track_id ~ '^[a-z][a-z0-9-]{0,31}$'),
  topic_id text check (octet_length(topic_id) <= 32),
  item_type text not null check (item_type in ('problem', 'flashcard', 'lesson', 'exercise', 'prompt')),
  level integer not null default 0 check (level between 0 and 32),
  weak boolean not null default false,
  top_successes integer not null default 0 check (top_successes >= 0),
  status text not null check (status in ('weak', 'ok', 'strong', 'mastered', 'skipped')),
  due_on date,
  last_result text check (octet_length(last_result) <= 32),
  last_result_on date,
  introduced_on date not null,
  lapses integer not null default 0 check (lapses >= 0),
  reps integer not null default 0 check (reps >= 0),
  version integer not null default 1 check (version >= 1),
  rules_version integer not null default public.rules_version() check (rules_version >= 1),
  primary key (user_id, item_id)
);
create index item_state_user_due_idx on public.item_state (user_id, due_on);

create table public.daily_activity (
  user_id uuid not null references public.profiles (id) on delete cascade,
  local_day date not null,
  minutes_by_track jsonb not null default '{}'::jsonb
    check (jsonb_typeof(minutes_by_track) = 'object' and octet_length(minutes_by_track::text) <= 2048),
  items_done integer not null default 0 check (items_done >= 0),
  completed boolean not null default false,
  version integer not null default 1 check (version >= 1),
  rules_version integer not null default public.rules_version() check (rules_version >= 1),
  primary key (user_id, local_day)
);

alter table public.user_tracks add column reset_on date;  -- decision 9: set by track.reset (4.9b)

-- Events that name a plan (§4.1). Cascade, never set null: the account-deletion cascade deletes
-- plans and events together, and a SET NULL would UPDATE an event (events_append_only raises).
-- Production first checks that no event names a plan (decision 30): M2 accepted any UUID.
alter table public.events add constraint events_plan_id_fkey
  foreign key (plan_id) references public.day_plans (id) on delete cascade;

-- ---------------------------------------------------------------------------------------------
-- Decision 33: the one key of the (user, plan_date) advisory lock. apply_event (4.9b) and
-- apply_system_event (4.9c) take it before any row lock.
-- ---------------------------------------------------------------------------------------------

create function public.plan_lock_key(p_user_id uuid, p_plan_date date) returns bigint
language sql immutable set search_path = '' as $$
  select pg_catalog.hashtextextended('day_plan:' || p_user_id || ':' || p_plan_date, 0)
$$;

-- ---------------------------------------------------------------------------------------------
-- events_prepare (20260925000200), unchanged except for the plan check: a learner may name only
-- their own plans in plan_id (RLS on day_plans applies to the lookup), so they can never mark
-- another user's plan as touched (§2.3). A plan that does not exist is rejected the same way —
-- this BEFORE trigger runs before the foreign key.
-- ---------------------------------------------------------------------------------------------

create or replace function public.events_prepare() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user = 'authenticated' then
    if new.user_id is distinct from auth.uid() then
      raise exception 'forbidden_user_id' using errcode = '42501';
    end if;
    if not new.type = any (public.learner_event_types()) then
      raise exception 'forbidden_event_type' using errcode = '42501';
    end if;
    if new.plan_id is not null and not exists (
      select 1 from public.day_plans d where d.id = new.plan_id and d.user_id = new.user_id
    ) then
      raise exception 'forbidden_plan_id' using errcode = '42501';
    end if;
    new.actor_id := auth.uid();
    new.source := 'learner';
    new.occurred_at := now();
    new.rules_version := public.rules_version();
  end if;
  new.actor_id := coalesce(new.actor_id, new.user_id);
  new.local_day := public.user_local_day(new.user_id, new.occurred_at);
  return new;
end $$;

-- ---------------------------------------------------------------------------------------------
-- Bounds (decision 11, the ruling R14 pattern of 20260925000100). Applied only when
-- current_user is `authenticated` — a direct insert or the invoker apply_event; the secret-key
-- role and SECURITY DEFINER functions are trusted. A row for another user is left to RLS, which
-- rejects it after these triggers: a learner never takes another user's lock.
-- ---------------------------------------------------------------------------------------------

-- At most 5000 item_state rows per user (`too_many_items`). The row an upsert would update is not
-- counted (BEFORE INSERT fires for the insert half too); a transaction-scoped advisory lock per
-- user serialises concurrent inserts, so two cannot both pass the count.
create function public.item_state_limit_rows() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user <> 'authenticated' or new.user_id is distinct from (select auth.uid()) then
    return new;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('item_state:' || new.user_id::text, 0)
  );
  if (
    select count(*) from public.item_state s
    where s.user_id = new.user_id and s.item_id <> new.item_id
  ) >= 5000 then
    raise exception 'too_many_items';
  end if;
  return new;
end $$;

create trigger limit_rows before insert on public.item_state
  for each row execute function public.item_state_limit_rows();

-- A new daily_activity row only within one day of the user's current local day
-- (`invalid_local_day`). No count, so no lock.
create function public.daily_activity_window() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_today date;
begin
  if current_user <> 'authenticated' or new.user_id is distinct from (select auth.uid()) then
    return new;
  end if;
  v_today := public.user_local_day(new.user_id, now());
  if new.local_day not between v_today - 1 and v_today + 1 then
    raise exception 'invalid_local_day';
  end if;
  return new;
end $$;

create trigger local_day_window before insert on public.daily_activity
  for each row execute function public.daily_activity_window();

-- A plan_block_state row only for a block that the user's own plan lists (`unknown_block`); the
-- lookup runs under the learner's RLS, so another user's plan is never found.
create function public.plan_block_state_known_block() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user <> 'authenticated' or new.user_id is distinct from (select auth.uid()) then
    return new;
  end if;
  if not exists (
    select 1 from public.day_plans d
    where d.id = new.plan_id and d.user_id = new.user_id
      and exists (
        select 1 from pg_catalog.jsonb_array_elements(d.blocks) b where b ->> 'id' = new.block_id
      )
  ) then
    raise exception 'unknown_block';
  end if;
  return new;
end $$;

create trigger known_block before insert on public.plan_block_state
  for each row execute function public.plan_block_state_known_block();

-- ---------------------------------------------------------------------------------------------
-- Decision 35: plans are permanent. events.plan_id cascades on plan deletion, so a direct delete
-- — a server bug with the secret key, or a future prune job — would silently delete
-- source-of-truth events. Inside this function pg_trigger_depth() is 1 for a delete statement
-- issued directly (any role: authenticated has no DELETE grant anyway, service_role and postgres
-- do) and at least 2 when the delete comes from the account-deletion cascade, whose foreign-key
-- action runs it from its own trigger. Plans are never pruned (spec §4.1).
-- ---------------------------------------------------------------------------------------------

create function public.day_plans_reject_delete() returns trigger
language plpgsql set search_path = '' as $$
begin
  if pg_catalog.pg_trigger_depth() < 2 then
    raise exception 'plans_are_permanent';
  end if;
  return old;
end $$;

create trigger day_plans_permanent before delete on public.day_plans
  for each row execute function public.day_plans_reject_delete();

-- ---------------------------------------------------------------------------------------------
-- mark_plan_seen (§4.5, §5.2): the one SECURITY DEFINER write to day_plans a learner makes. Sets
-- seen_at once, for the caller's own plan only; a repeat changes nothing, not even updated_at.
-- Returns whether the plan is the caller's — never anything about another user's plans.
-- ---------------------------------------------------------------------------------------------

create function public.mark_plan_seen(p_plan_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_uid constant uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not public.is_active() then
    raise exception 'inactive' using errcode = '42501';
  end if;

  update public.day_plans d set seen_at = now()
  where d.id = p_plan_id and d.user_id = v_uid and d.seen_at is null;

  return exists (select 1 from public.day_plans d where d.id = p_plan_id and d.user_id = v_uid);
end $$;

-- ---------------------------------------------------------------------------------------------
-- Function privileges (controller ruling R5): PUBLIC's default EXECUTE and Supabase's default
-- grants are revoked from every function of this migration, then each gets exactly its callers.
-- plan_lock_key: the invoker apply_event calls it as the learner, apply_system_event as its owner.
-- Trigger functions get no grants. rules_version keeps its 20260925000200 grants.
-- ---------------------------------------------------------------------------------------------

revoke execute on function
  public.plan_lock_key(uuid, date),
  public.events_prepare(),
  public.item_state_limit_rows(),
  public.daily_activity_window(),
  public.plan_block_state_known_block(),
  public.day_plans_reject_delete(),
  public.mark_plan_seen(uuid)
from public, anon, authenticated, service_role;

grant execute on function public.plan_lock_key(uuid, date) to authenticated, service_role;
grant execute on function public.mark_plan_seen(uuid) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Table privileges (§4.5; decision 11: UPDATE per column, never a key column — item_id,
-- local_day, plan_id, block_id, user_id — so an update cannot move a row out of its bounds).
-- No anon access. day_plans: read only (plans are written by apply_system_event, seen_at by
-- mark_plan_seen). item_state may also be deleted: track.reset, inside the invoker apply_event.
-- ---------------------------------------------------------------------------------------------

revoke all on public.day_plans, public.plan_block_state, public.item_state, public.daily_activity
from anon, authenticated;

grant select on public.day_plans to authenticated;

grant select, insert on public.plan_block_state to authenticated;
grant update (status, minutes, note, auto, checked_in_at, version, rules_version)
  on public.plan_block_state to authenticated;

grant select, insert, delete on public.item_state to authenticated;
grant update (
  track_id, topic_id, item_type, level, weak, top_successes, status, due_on, last_result,
  last_result_on, introduced_on, lapses, reps, version, rules_version
) on public.item_state to authenticated;

grant select, insert on public.daily_activity to authenticated;
grant update (minutes_by_track, items_done, completed, version, rules_version)
  on public.daily_activity to authenticated;

-- ---------------------------------------------------------------------------------------------
-- RLS (§4.5): read own; writes need is_active(). day_plans has no write policy.
-- ---------------------------------------------------------------------------------------------

alter table public.day_plans enable row level security;
alter table public.plan_block_state enable row level security;
alter table public.item_state enable row level security;
alter table public.daily_activity enable row level security;

create policy day_plans_select_own on public.day_plans
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy plan_block_state_select_own on public.plan_block_state
  for select to authenticated
  using (user_id = (select auth.uid()));
create policy plan_block_state_insert_own on public.plan_block_state
  for insert to authenticated
  with check (user_id = (select auth.uid()) and (select public.is_active()));
create policy plan_block_state_update_own on public.plan_block_state
  for update to authenticated
  using (user_id = (select auth.uid()) and (select public.is_active()))
  with check (user_id = (select auth.uid()) and (select public.is_active()));

create policy item_state_select_own on public.item_state
  for select to authenticated
  using (user_id = (select auth.uid()));
create policy item_state_insert_own on public.item_state
  for insert to authenticated
  with check (user_id = (select auth.uid()) and (select public.is_active()));
create policy item_state_update_own on public.item_state
  for update to authenticated
  using (user_id = (select auth.uid()) and (select public.is_active()))
  with check (user_id = (select auth.uid()) and (select public.is_active()));
create policy item_state_delete_own on public.item_state
  for delete to authenticated
  using (user_id = (select auth.uid()) and (select public.is_active()));

create policy daily_activity_select_own on public.daily_activity
  for select to authenticated
  using (user_id = (select auth.uid()));
create policy daily_activity_insert_own on public.daily_activity
  for insert to authenticated
  with check (user_id = (select auth.uid()) and (select public.is_active()));
create policy daily_activity_update_own on public.daily_activity
  for update to authenticated
  using (user_id = (select auth.uid()) and (select public.is_active()))
  with check (user_id = (select auth.uid()) and (select public.is_active()));
