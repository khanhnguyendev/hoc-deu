-- Task 2.4: profiles, schedule_versions, user_tracks (platform design §4.1, §4.5).
-- Every table: RLS on, deny by default; every object grants exactly what it needs.

-- Owner review MF2: Supabase's default privileges grant every new table, sequence and function in
-- public to anon and authenticated. Remove them for everything created from here on.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
-- A per-schema REVOKE cannot remove the built-in EXECUTE-to-PUBLIC default on functions (Postgres
-- docs, ALTER DEFAULT PRIVILEGES: per-schema defaults only add to the global ones), so every
-- function below also revokes PUBLIC explicitly. schema-invariants (001) fails if one does not.

-- ---------------------------------------------------------------------------------------------
-- Tables (§4.1)
-- ---------------------------------------------------------------------------------------------

create function public.set_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'learner' check (role in ('learner', 'admin')),
  status text not null default 'pending'
    check (status in ('pending', 'active', 'rejected', 'suspended')),
  ai_personalization boolean not null default false,
  share_notes_with_ai boolean not null default false,
  code_language text check (code_language in ('python', 'java', 'go')),
  display_name text check (char_length(display_name) between 1 and 80),
  avatar_url text check (avatar_url ~ '^https://'),
  onboarded_at timestamptz,
  approved_by uuid,  -- no FK: the approving admin may delete their account later
  approved_at timestamptz,
  -- §6.3: random opaque key for custom item IDs, never derived from id
  bot_ref text not null unique default encode(extensions.gen_random_bytes(8), 'hex'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- §4.1: the engine uses the latest version with effective_at <= now; a change takes effect at the
-- next day start, so past days are never rewritten (§5.9, ADR-0017).
create table public.schedule_versions (
  user_id uuid not null references public.profiles (id) on delete cascade,
  effective_at timestamptz not null,
  timezone text not null default 'Asia/Ho_Chi_Minh',
  day_starts_at time not null default '04:00',
  created_at timestamptz not null default now(),
  primary key (user_id, effective_at),
  -- decision 5: 00:00–12:00 in 30-minute steps
  constraint day_starts_at_step check (
    day_starts_at between time '00:00' and time '12:00'
    and extract(second from day_starts_at) = 0
    and extract(minute from day_starts_at) in (0, 30)
  )
);

create table public.user_tracks (
  user_id uuid not null references public.profiles (id) on delete cascade,
  track_id text not null check (track_id ~ '^[a-z][a-z0-9-]{0,31}$'),
  roadmap_variant text not null check (roadmap_variant ~ '^[a-z0-9][a-z0-9-]{0,31}$'),
  status text not null default 'active' check (status in ('active', 'paused', 'removed')),
  start_date date not null,
  budget_minutes integer not null check (budget_minutes between 10 and 240 and budget_minutes % 5 = 0),
  new_per_day integer check (new_per_day >= 0),                                   -- null = track default
  throttle jsonb check (throttle is null or jsonb_typeof(throttle) = 'array'),    -- null = track default
  weekly_template jsonb check (weekly_template is null or jsonb_typeof(weekly_template) = 'object'),
  include_bonus boolean not null default false,  -- §5.3
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, track_id)
);

create trigger set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.user_tracks
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------------------------
-- Sign-up: every new auth user gets a pending learner profile (§4.5; users cannot insert one)
-- ---------------------------------------------------------------------------------------------

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  meta jsonb := new.raw_user_meta_data;
  avatar text := new.raw_user_meta_data ->> 'avatar_url';
begin
  insert into public.profiles (id, status, display_name, avatar_url)
  values (
    new.id,
    'pending',
    -- The first non-blank provider name, else the e-mail's local part; an all-space name must
    -- never block sign-up (display_name must be 1–80 characters, or null).
    left(
      coalesce(
        nullif(btrim(meta ->> 'full_name'), ''),
        nullif(btrim(meta ->> 'name'), ''),
        nullif(btrim(meta ->> 'user_name'), ''),
        nullif(split_part(new.email, '@', 1), '')
      ),
      80
    ),
    case when avatar ~ '^https://' then avatar end
  );
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------------------------
-- RLS helpers (§4.5): SECURITY DEFINER so policies do not recurse into profiles
-- ---------------------------------------------------------------------------------------------

create function public.is_active() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.status = 'active'
  )
$$;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.status = 'active' and p.role = 'admin'
  )
$$;

-- ---------------------------------------------------------------------------------------------
-- Write rules enforced by triggers
-- ---------------------------------------------------------------------------------------------

-- §4.5: share_notes_with_ai is only settable while ai_personalization is on; turning it off is
-- always allowed.
create function public.profiles_guard_share_notes() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.share_notes_with_ai and not old.share_notes_with_ai and not new.ai_personalization then
    raise exception 'ai_personalization_off';
  end if;
  return new;
end $$;

create trigger guard_share_notes before update on public.profiles
  for each row execute function public.profiles_guard_share_notes();

-- Decision 6: every stored zone is a name Postgres knows (the app canonicalises aliases first).
create function public.schedule_versions_check_timezone() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names z where z.name = new.timezone) then
    raise exception 'invalid_timezone';
  end if;
  return new;
end $$;

create trigger check_timezone before insert or update on public.schedule_versions
  for each row execute function public.schedule_versions_check_timezone();

-- Owner review MF3: past days are never rewritten (§5.9) — enforced here for every role, because
-- apply_event is callable directly with any effectiveAt and authenticated may update versions.
-- - insert (also the insert half of an upsert): effective_at no more than 5 minutes in the past,
--   unless it is the user's first version (onboarding: no past day exists yet);
-- - update: only a pending (future) version, and never moved into the past;
-- - delete: only a pending version — except in the account-deletion cascade (§4.6), which runs
--   after the profile row is gone.
create function public.schedule_versions_guard_history() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.effective_at < now() - interval '5 minutes'
      and exists (select 1 from public.schedule_versions v where v.user_id = new.user_id)
    then
      raise exception 'schedule_backdated';
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if old.effective_at <= now() then
      raise exception 'schedule_in_force';
    end if;
    if new.effective_at < now() - interval '5 minutes' then
      raise exception 'schedule_backdated';
    end if;
    return new;
  end if;

  if old.effective_at <= now()
    and exists (select 1 from public.profiles p where p.id = old.user_id)
  then
    raise exception 'schedule_in_force';
  end if;
  return old;
end $$;

create trigger guard_history before insert or update or delete on public.schedule_versions
  for each row execute function public.schedule_versions_guard_history();

-- ---------------------------------------------------------------------------------------------
-- Function privileges: only the RLS helpers are callable, and only by signed-in users
-- ---------------------------------------------------------------------------------------------

revoke execute on function
  public.set_updated_at(),
  public.handle_new_user(),
  public.profiles_guard_share_notes(),
  public.schedule_versions_check_timezone(),
  public.schedule_versions_guard_history()
from public, anon, authenticated;

revoke execute on function public.is_active(), public.is_admin() from public, anon;
grant execute on function public.is_active(), public.is_admin() to authenticated, service_role;

-- ---------------------------------------------------------------------------------------------
-- Table privileges (§4.5: column-level grants on profiles)
-- ---------------------------------------------------------------------------------------------

revoke all on public.profiles, public.schedule_versions, public.user_tracks from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (display_name, avatar_url, code_language, share_notes_with_ai) on public.profiles to authenticated;
grant select, insert on public.schedule_versions to authenticated;
grant update (timezone, day_starts_at) on public.schedule_versions to authenticated;  -- 2.5b upsert
grant select, insert, update on public.user_tracks to authenticated;

-- ---------------------------------------------------------------------------------------------
-- RLS (§4.5): read own; writes need is_active(). No delete policies — removal is a status, and
-- rows go with the account.
-- ---------------------------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.schedule_versions enable row level security;
alter table public.user_tracks enable row level security;

create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) and (select public.is_active()))
  with check (id = (select auth.uid()));

create policy schedule_versions_select_own on public.schedule_versions
  for select to authenticated
  using (user_id = (select auth.uid()));
create policy schedule_versions_insert_own on public.schedule_versions
  for insert to authenticated
  with check (user_id = (select auth.uid()) and (select public.is_active()));
create policy schedule_versions_update_own on public.schedule_versions
  for update to authenticated
  using (user_id = (select auth.uid()) and (select public.is_active()))
  with check (user_id = (select auth.uid()) and (select public.is_active()));

create policy user_tracks_select_own on public.user_tracks
  for select to authenticated
  using (user_id = (select auth.uid()));
create policy user_tracks_insert_own on public.user_tracks
  for insert to authenticated
  with check (user_id = (select auth.uid()) and (select public.is_active()));
create policy user_tracks_update_own on public.user_tracks
  for update to authenticated
  using (user_id = (select auth.uid()) and (select public.is_active()))
  with check (user_id = (select auth.uid()) and (select public.is_active()));
