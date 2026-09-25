-- M2 ruling R17 (Part B-M3 task 3.0, Step 6): bound schedule history and avatar URLs.
-- Merged migrations are never edited (CLAUDE.md), so the functions from 000100 are replaced here;
-- `create or replace` keeps their owner, privileges and triggers.

-- The history guard (000100) lets a later version start up to 5 minutes in the past, and the
-- pending cap counted only versions with effective_at > now(): a learner inserting versions inside
-- that window (directly or through apply_event) was never counted, so history could grow without
-- limit. Now every insert also counts the user's versions with effective_at in the last day or
-- later (pending ones included) and raises above 10 — at most 10 new rows per user per day.
-- Unchanged from 000100 (ruling R14):
-- - at most 2 pending (future) versions per user;
-- - the row an upsert (`on conflict … do update`) would update is not counted: BEFORE INSERT fires
--   for the insert half too, and replacing a version adds no row;
-- - a transaction-scoped advisory lock per user serialises concurrent inserts, so two cannot both
--   pass a count;
-- - a row for another user is left to RLS, which rejects it after this trigger.
-- A first version may be backdated further (the history guard allows it); it counts only while it
-- is less than a day old, and a backdated later version is rejected by guard_history first.
create or replace function public.schedule_versions_limit_pending() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user = 'authenticated' and new.user_id is distinct from (select auth.uid()) then
    return new;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('schedule_versions:' || new.user_id::text, 0)
  );
  if (
    select count(*) from public.schedule_versions v
    where v.user_id = new.user_id and v.effective_at > now() - interval '1 day'
      and v.effective_at <> new.effective_at
  ) >= 10 then
    raise exception 'too_many_pending_schedules';
  end if;
  if new.effective_at > now() and (
    select count(*) from public.schedule_versions v
    where v.user_id = new.user_id and v.effective_at > now()
      and v.effective_at <> new.effective_at
  ) >= 2 then
    raise exception 'too_many_pending_schedules';
  end if;
  return new;
end $$;

-- avatar_url is learner-writable (column grant, 000100): cap its length like the other free-form
-- columns.
alter table public.profiles add constraint avatar_url_length
  check (avatar_url is null or char_length(avatar_url) <= 2048);

-- Sign-up must never fail on provider metadata: an avatar over 2048 characters is stored as null,
-- like an http:// one. Otherwise unchanged from 000100.
create or replace function public.handle_new_user() returns trigger
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
    case when avatar ~ '^https://' and char_length(avatar) <= 2048 then avatar end
  );
  return new;
end $$;
