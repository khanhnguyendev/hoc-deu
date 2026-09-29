-- Task 6.2b: every M6 SQL function and every M6 branch of apply_system_event (platform design
-- §2.3, §4.2–§4.5, §5.12, §6.2–§6.6, §6.10; implementation plan Part B-M6 decisions 4, 8–13,
-- 17–20, 31, 33, 34). The second and last M6 migration (decision 4): the bot tasks call these.
-- 1. roadmap_overrides.revoked_by (ruling M6-R17); roadmap_override_active: decision 18's computed
--    expiry; plan_is_touched: the untouched-plan rule (§2.3).
-- 2. apply_system_event: plan.ai_proposed (the untouched-plan precedence), user_item.created /
--    retired / hidden, roadmap.override_set / revoked; a plan.generated rebuild clears rationale
--    and bot_run_id.
-- 3. Bot settings, token rotation, the AI flag and admin_list_users (admin).
-- 4. Runs: eligibility, the lazy timeout, the write record, the detail prune, the run log.
-- 5. Publish requests and the content signal aggregates.
-- Merged migrations are never edited: apply_system_event and admin_list_users are replaced here.
-- Every function revokes EXECUTE from PUBLIC explicitly and grants exactly its callers (see
-- 20260925000100), at the end of its section; schema-invariants (001), 091 and 092 check it. Errors are
-- `raise exception '<code>'` like the other functions (lib/events/apply.ts maps the event codes).

-- ---------------------------------------------------------------------------------------------
-- 1. roadmap_override_active(o, p_today) (§5.12, decision 18): whether an override is in force on
--    p_today. Expiry is computed, never stored: status 'active', and by kind — an insert_block
--    while until_local_day >= p_today; an extra_week while fewer than study_days of the user's
--    stored plans dated on or after its start_local_day name it in their track snapshot
--    (roadmap_weeks -> <track> ->> 'extraWeek' = <key>); a reorder_topics until revoked or
--    replaced. lib/domain/plan (task 6.6b) computes the same rule; a parity test pins it. An
--    internal helper: apply_system_event and admin_set_ai_flag call it as their owner.
-- ---------------------------------------------------------------------------------------------

-- Who revoked an override (ruling M6-R17: the bot may revoke too, §6.4.5): null unless revoked.
-- Only a learner's revocation is final (revoked_key); a key the bot revoked may be set again.
alter table public.roadmap_overrides
  add column revoked_by text check (revoked_by in ('learner', 'bot')),
  add constraint roadmap_overrides_revoked_by_check_status
    check (revoked_by is null or status = 'revoked');

create function public.roadmap_override_active(o public.roadmap_overrides, p_today date)
returns boolean
language sql stable set search_path = '' as $$
  select o.status = 'active' and case o.kind
    when 'insert_block' then o.until_local_day >= p_today
    when 'extra_week' then (
      select count(*) from public.day_plans d
      where d.user_id = o.user_id
        and d.plan_date >= o.start_local_day
        and d.roadmap_weeks -> o.track_id ->> 'extraWeek' = o.key
    ) < o.study_days
    else true
  end
$$;

-- The untouched-plan rule (§2.3, decision 12 of M4): a plan is touched once it has a check-in, or
-- an event naming it other than its generation and the bot's plan.ai_* events. A settings
-- rebuild and the bot's plan replace only an untouched plan. Internal: apply_system_event calls
-- it as its owner, under the plan lock.
create function public.plan_is_touched(p_plan_id uuid) returns boolean
language sql stable set search_path = '' as $$
  select exists (select 1 from public.plan_block_state b where b.plan_id = p_plan_id)
    or exists (
      select 1 from public.events e
      where e.plan_id = p_plan_id
        and e.type not in (
          'plan.generated', 'plan.ai_proposed', 'plan.ai_applied', 'plan.ai_skipped')
    )
$$;

-- ---------------------------------------------------------------------------------------------
-- 2. apply_system_event (§4.3, §4.4): system, bot and admin events for p_user_id, from the server
-- with the secret key only. SECURITY DEFINER: it runs as its owner, so RLS and the learner bounds
-- do not apply — every check the learner path gets from them is made here. The body of
-- 20260927000100, every branch unchanged, plus (task 6.2b):
-- - plan.ai_proposed (§2.3, §6.4.3, decision 13): under the (user, plan_date) lock, for an active
--   AI-flagged user, the database's local day, a live running plan run and bot_settings.dry_run
--   off: no plan → insert; an untouched non-resume plan → replace (version + 1, seen_at kept);
--   otherwise nothing. One event under the caller's id: plan.ai_applied or plan.ai_skipped, with
--   the plan_id (the function sets it; callers still may not name a plan).
-- - user_item.created (§6.4.4, decisions 17, 33), user_item.retired (bot), user_item.hidden (the
--   learner): under the per-user user_items lock.
-- - roadmap.override_set (§6.4.5, decisions 18, 33), roadmap.override_revoked (the learner): under
--   the per-user-and-track overrides lock.
-- - a plan.generated rebuild also clears rationale and bot_run_id (§5.4).
-- 1. The type: a system type (invalid_event), implemented here (not_implemented otherwise:
--    plan.ai_applied / ai_skipped are stored only by plan.ai_proposed, roadmap.override_suspended /
--    resumed only by admin_set_ai_flag, the admin decisions by their own functions, item.snapshot
--    by the compaction job). 2. The event's shape and, per type, its payload, p_changes and
--    p_expected (invalid_event) — before any lock. 3. The lock: the (user, plan_date) advisory
--    lock for the plan types (decision 33 of M4: before any row lock, as apply_event takes it —
--    the reverse order deadlocks with apply_event's key-share lock on the profile row), the
--    per-user lock for user_item.*, the per-user-and-track lock for roadmap.override_*.
-- 4. The profile row lock: active users only (inactive); the bot's writes also need the AI flag
--    (ai_off). 5. A duplicate event id is a no-op.
-- 5a. plan.generated / plan.ai_proposed: day_changed when the caller built the plan for another
--    local day (ruling M4-R21). 5b. The bot's writes: bot_settings.dry_run off (decision 8).
-- 6. Decided under the lock: a rebuild (version_conflict / plan_in_use); plan.extra_added
--    (version_conflict, the stored extra block and the numbering of a new one); plan.ai_proposed
--    (insert, replace or skip); user_item.* and roadmap.override_* (unchanged and the refusals).
-- 7. The writes and the event, in one subtransaction.
-- 8. day_changed when the caller computed its rows for another local day (decision 10 of M4).
-- 9. The state change.
-- Returns { outcome, versions } — plus plan_id for plan.generated, plan.extra_added and
-- plan.ai_proposed. Outcomes: applied, duplicate, plan_exists, plan_in_use and — for user_item.*
-- and roadmap.override_* — unchanged (nothing written, no event).
-- ---------------------------------------------------------------------------------------------

create or replace function public.apply_system_event(
  p_user_id uuid, p_event jsonb, p_changes jsonb default '[]'::jsonb,
  p_expected jsonb default '{}'::jsonb
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_type constant text := p_event ->> 'type';
  v_payload constant jsonb := coalesce(p_event -> 'payload', '{}'::jsonb);
  v_changes constant jsonb := coalesce(p_changes, '[]'::jsonb);
  v_expected_map constant jsonb := coalesce(p_expected, '{}'::jsonb);
  v_id uuid;
  v_rules integer;
  v_mode text;
  v_row jsonb;
  v_key text;
  v_expected integer;
  v_plan_date date;
  v_plan_id uuid;
  v_plan_version integer;
  v_version integer;
  v_status text;
  v_owner uuid;
  v_local_day date;
  v_constraint text;
  v_versions jsonb := '{}'::jsonb;
  v_item_ids jsonb;
  v_items jsonb;
  v_block_id text;
  v_extra_prefix text;
  v_extra_n integer;
  v_blocks jsonb;
  v_old_items jsonb;
  v_old_index bigint;
  -- Task 6.2b.
  v_ai boolean;
  v_bot_ref text;
  v_today date;
  v_stored_type text := v_type;
  v_stored_payload jsonb := v_payload;
  v_track_id text := p_event ->> 'track_id';
  v_outcome text := 'applied';
  v_run_key text;
  v_limits jsonb;
  v_per_day integer;
  v_max_active integer;
  v_per_track integer;
  v_item public.user_items;
  v_item_type text;
  v_ov public.roadmap_overrides;
  v_ov_key text;
  v_ov_kind text;
  v_until date;
  v_study_days integer;
  v_prev_start date;
  v_active_count integer;
  v_extra_count integer;
  -- The bot's writes: they need the AI flag and bot_settings.dry_run off (decision 8).
  v_bot_write constant boolean := v_type in ('plan.ai_proposed', 'user_item.created',
      'user_item.retired', 'roadmap.override_set')
    or (v_type = 'roadmap.override_revoked' and p_event ->> 'source' = 'bot');
begin
  -- 1. A system type, and one implemented here.
  if v_type is null or not v_type = any (public.system_event_types()) then
    raise exception 'invalid_event';
  end if;
  if v_type not in (
    'onboarding.completed', 'plan.generated', 'plan.extra_added', 'block.checked_in',
    'plan.ai_proposed', 'user_item.created', 'user_item.retired', 'user_item.hidden',
    'roadmap.override_set', 'roadmap.override_revoked'
  ) then
    raise exception 'not_implemented';
  end if;

  -- 2. The event's shape: local_day, when present, a YYYY-MM-DD date (as apply_event). Only a
  --    check-in and an extra addition name a plan here: plan.generated and plan.ai_proposed get
  --    the plan's id from the database, and no other type may mark a plan as touched (§2.3).
  if not coalesce(pg_catalog.pg_input_is_valid(p_event ->> 'id', 'uuid'), false)
    or not coalesce(pg_catalog.pg_input_is_valid(p_event ->> 'plan_id', 'uuid'), true)
    or not coalesce(pg_catalog.pg_input_is_valid(p_event ->> 'actor_id', 'uuid'), true)
    or not coalesce(pg_catalog.pg_input_is_valid(p_event ->> 'rules_version', 'integer'), true)
    or jsonb_typeof(v_payload) <> 'object'
    or jsonb_typeof(v_changes) <> 'array'
    or jsonb_typeof(v_expected_map) <> 'object'
    or (v_type not in ('block.checked_in', 'plan.extra_added') and p_event ? 'plan_id')
    or (p_event ? 'local_day' and not (case when jsonb_typeof(p_event -> 'local_day') = 'string'
          then (p_event ->> 'local_day') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
            and coalesce(pg_catalog.pg_input_is_valid(p_event ->> 'local_day', 'date'), false)
          else false end))
  then
    raise exception 'invalid_event';
  end if;
  v_id := (p_event ->> 'id')::uuid;
  v_rules := coalesce((p_event ->> 'rules_version')::integer, public.rules_version());

  -- The M6 types' source: the bot writes plan.ai_proposed, user_item.created / retired and
  -- roadmap.override_set; the learner's hide comes from a server action (source system) and
  -- names the learner as the actor, if anyone; roadmap.override_revoked is either (ruling
  -- M6-R17): the bot's (source bot) or the learner's (source system).
  if (v_type in ('plan.ai_proposed', 'user_item.created', 'user_item.retired',
        'roadmap.override_set')
      and p_event -> 'source' is distinct from '"bot"'::jsonb)
    or (v_type = 'user_item.hidden'
      and p_event -> 'source' is distinct from '"system"'::jsonb)
    or (v_type = 'roadmap.override_revoked'
      and p_event -> 'source' is distinct from '"system"'::jsonb
      and p_event -> 'source' is distinct from '"bot"'::jsonb)
    or (v_type in ('user_item.hidden', 'roadmap.override_revoked')
      and coalesce((p_event ->> 'actor_id')::uuid, p_user_id) <> p_user_id)
  then
    raise exception 'invalid_event';
  end if;

  -- Per type, the checks that need no lock.
  if v_type = 'onboarding.completed' then
    -- No derived rows: onboarding changes profiles.onboarded_at only.
    if v_changes <> '[]'::jsonb or v_expected_map <> '{}'::jsonb then
      raise exception 'invalid_event';
    end if;

  elsif v_type = 'plan.generated' then
    -- p_changes = [{ table: day_plans, row: { plan_date, blocks, roadmap_weeks } }] (the row's
    -- other keys are ignored), p_expected = { "day_plans:<plan_date>": n } and nothing else,
    -- payload { mode, planVersion }: baseline / resume create version 1 (n = 0), a rebuild
    -- replaces version n with n + 1. The size bounds are the day_plans check constraints.
    v_row := case when jsonb_array_length(v_changes) = 1
      and v_changes -> 0 ->> 'table' = 'day_plans' then v_changes -> 0 -> 'row' end;
    if jsonb_typeof(v_row) is distinct from 'object'
      or not (case when jsonb_typeof(v_row -> 'plan_date') = 'string'
        then (v_row ->> 'plan_date') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
          and coalesce(pg_catalog.pg_input_is_valid(v_row ->> 'plan_date', 'date'), false)
        else false end)
      or jsonb_typeof(v_row -> 'blocks') is distinct from 'array'
      or jsonb_typeof(v_row -> 'roadmap_weeks') is distinct from 'object'
    then
      raise exception 'invalid_event';
    end if;
    -- The key keeps the row's own YYYY-MM-DD text, which no DateStyle changes.
    v_key := 'day_plans:' || (v_row ->> 'plan_date');
    v_mode := case when jsonb_typeof(v_payload -> 'mode') = 'string' then v_payload ->> 'mode' end;
    if (select count(*) from jsonb_object_keys(v_expected_map)) <> 1
      or not (case when jsonb_typeof(v_expected_map -> v_key) = 'number'
        then coalesce(pg_catalog.pg_input_is_valid(v_expected_map ->> v_key, 'integer'), false)
        else false end)
      or v_mode is null or v_mode not in ('baseline', 'resume', 'rebuild')
      or not (case when jsonb_typeof(v_payload -> 'planVersion') = 'number'
        then coalesce(pg_catalog.pg_input_is_valid(v_payload ->> 'planVersion', 'integer'), false)
        else false end)
    then
      raise exception 'invalid_event';
    end if;
    v_expected := (v_expected_map ->> v_key)::integer;
    v_plan_version := (v_payload ->> 'planVersion')::integer;
    -- bigint, so that n + 1 never overflows.
    if (v_mode in ('baseline', 'resume') and (v_expected <> 0 or v_plan_version <> 1))
      or (v_mode = 'rebuild'
        and (v_expected < 1 or v_plan_version::bigint <> v_expected::bigint + 1))
    then
      raise exception 'invalid_event';
    end if;
    v_plan_date := (v_row ->> 'plan_date')::date;

  elsif v_type = 'plan.extra_added' then
    -- "Học thêm" and off-plan study (§5.9, decision 22): the server appends items to one of the
    -- track's extra blocks of the user's own plan, or adds its next one (M-3). p_event: plan_id
    -- and track_id; payload exactly { itemIds }, 1 to 20 distinct strings of 1–128 characters
    -- (ruling M5-R2; addExtraItems checks the same bound before calling). p_changes = [{ table:
    -- day_plan_block, row: <block> }] — the whole extra block after the addition — and
    -- p_expected = { "day_plans:<plan_date>": n } and nothing else, n the plan's version.
    v_item_ids := v_payload -> 'itemIds';
    if p_event ->> 'plan_id' is null or p_event ->> 'track_id' is null
      or jsonb_typeof(v_item_ids) is distinct from 'array'
      or v_payload - 'itemIds' <> '{}'::jsonb
    then
      raise exception 'invalid_event';
    end if;
    if jsonb_array_length(v_item_ids) not between 1 and 20
      or exists (
        select 1 from pg_catalog.jsonb_array_elements(v_item_ids) as i (value)
        where jsonb_typeof(i.value) <> 'string'
          or char_length(i.value #>> '{}') not between 1 and 128
      )
      or (select count(distinct i.value)
          from pg_catalog.jsonb_array_elements(v_item_ids) as i (value))
        <> jsonb_array_length(v_item_ids)
    then
      raise exception 'invalid_event';
    end if;
    -- The plan's date is fixed (plans are permanent), so it is read before the lock it keys.
    select d.plan_date into v_plan_date
    from public.day_plans d
    where d.id = (p_event ->> 'plan_id')::uuid and d.user_id = p_user_id;
    if not found then
      raise exception 'invalid_event';
    end if;
    v_plan_id := (p_event ->> 'plan_id')::uuid;
    -- Ruling M4-R12: the date as YYYY-MM-DD whatever the session's DateStyle, never ::text.
    v_key := 'day_plans:' || to_char(v_plan_date, 'YYYY-MM-DD');
    v_extra_prefix := to_char(v_plan_date, 'YYYY-MM-DD') || ':' || (p_event ->> 'track_id')
      || ':extra:';
    v_row := case when jsonb_array_length(v_changes) = 1
      and v_changes -> 0 ->> 'table' = 'day_plan_block' then v_changes -> 0 -> 'row' end;
    v_items := v_row -> 'items';
    v_block_id := case when jsonb_typeof(v_row -> 'id') = 'string' then v_row ->> 'id' end;
    -- The block: one of the track's extra blocks — id <date>:<track>:extra:<n>, n = 1, 2, …
    -- written without leading zeros (a fresh block after extra:1 for off-plan study on the paused
    -- plan: ruling M5-R36, M-3) — kind extra, a numeric estMinutes, items with distinct string
    -- itemIds that end with exactly payload.itemIds, in order. The items before them, and that a
    -- new block follows extra:<n - 1>, are checked against the stored plan under the lock.
    if (select count(*) from jsonb_object_keys(v_expected_map)) <> 1
      or not (case when jsonb_typeof(v_expected_map -> v_key) = 'number'
        then coalesce(pg_catalog.pg_input_is_valid(v_expected_map ->> v_key, 'integer'), false)
        else false end)
      or jsonb_typeof(v_row) is distinct from 'object'
      or not coalesce(starts_with(v_block_id, v_extra_prefix), false)
      or not coalesce(
        substr(v_block_id, char_length(v_extra_prefix) + 1) ~ '^[1-9][0-9]{0,2}$', false)
      or v_row -> 'kind' is distinct from to_jsonb('extra'::text)
      or v_row -> 'trackId' is distinct from to_jsonb(p_event ->> 'track_id')
      or jsonb_typeof(v_row -> 'estMinutes') is distinct from 'number'
      or jsonb_typeof(v_items) is distinct from 'array'
    then
      raise exception 'invalid_event';
    end if;
    v_expected := (v_expected_map ->> v_key)::integer;
    if v_expected < 1
      or jsonb_array_length(v_items) < jsonb_array_length(v_item_ids)
      or exists (
        select 1 from pg_catalog.jsonb_array_elements(v_items) as i (value)
        where jsonb_typeof(i.value -> 'itemId') is distinct from 'string'
      )
      or (select count(distinct i.value -> 'itemId')
          from pg_catalog.jsonb_array_elements(v_items) as i (value))
        <> jsonb_array_length(v_items)
      or exists (
        select 1 from pg_catalog.jsonb_array_elements(v_item_ids) with ordinality as n (value, k)
        where v_items -> (jsonb_array_length(v_items) - jsonb_array_length(v_item_ids)
          + n.k::integer - 1) -> 'itemId' is distinct from n.value
      )
    then
      raise exception 'invalid_event';
    end if;

  elsif v_type = 'plan.ai_proposed' then
    -- The bot's plan (decision 13): p_event.local_day required, payload exactly { runId } (a plan
    -- run key); p_changes = [{ table: day_plans, row: { plan_date, blocks, roadmap_weeks,
    -- rationale, bot_run_id } }] (the row's other keys are ignored), plan_date = local_day;
    -- p_expected = {}. The rationale: plain text of at most 280 characters, no control
    -- characters (lib/bot strips markup first). The day_plans check constraints bound the plan.
    v_row := case when jsonb_array_length(v_changes) = 1
      and v_changes -> 0 ->> 'table' = 'day_plans' then v_changes -> 0 -> 'row' end;
    if not (p_event ? 'local_day')
      or v_expected_map <> '{}'::jsonb
      or jsonb_typeof(v_payload -> 'runId') is distinct from 'string'
      or v_payload - 'runId' <> '{}'::jsonb
      or not coalesce((v_payload ->> 'runId') ~ '^run_[0-9]{4}-[0-9]{2}-[0-9]{2}$', false)
      or jsonb_typeof(v_row) is distinct from 'object'
      or v_row -> 'plan_date' is distinct from p_event -> 'local_day'
      or jsonb_typeof(v_row -> 'blocks') is distinct from 'array'
      or jsonb_typeof(v_row -> 'roadmap_weeks') is distinct from 'object'
      or jsonb_typeof(v_row -> 'rationale') is distinct from 'string'
      or jsonb_typeof(v_row -> 'bot_run_id') is distinct from 'string'
      or not coalesce(pg_catalog.pg_input_is_valid(v_row ->> 'bot_run_id', 'uuid'), false)
    then
      raise exception 'invalid_event';
    end if;
    if char_length(v_row ->> 'rationale') > 280
      -- C0 and C1 control characters.
      or (v_row ->> 'rationale') ~ '[\x01-\x1f\x7f-\x9f]'
    then
      raise exception 'invalid_event';
    end if;
    v_run_key := v_payload ->> 'runId';
    v_plan_date := (v_row ->> 'plan_date')::date;
    v_key := 'day_plans:' || (v_row ->> 'plan_date');

  elsif v_type = 'user_item.created' then
    -- A custom item (§6.4.4, decision 17): p_event track_id and item_id
    -- (user:<bot_ref>:<slug>, checked against the profile under the lock), payload exactly
    -- { itemType, slug }, limits exactly { perDay, active } (whole numbers ≥ 0, sent by the server
    -- from lib/bot/limits.ts, clamped here to the hard maxima 10 and 200 — decision 33);
    -- p_changes = [{ table: user_items, row: { topic_id, payload, created_by_run } }] and nothing
    -- else in the row; p_expected = {}. The table's checks bound the payload's size.
    v_row := case when jsonb_array_length(v_changes) = 1
      and v_changes -> 0 ->> 'table' = 'user_items' then v_changes -> 0 -> 'row' end;
    v_limits := p_event -> 'limits';
    if v_track_id is null or p_event ->> 'item_id' is null
      or v_expected_map <> '{}'::jsonb
      or jsonb_typeof(v_payload -> 'itemType') is distinct from 'string'
      or (v_payload ->> 'itemType') not in ('flashcard', 'exercise', 'prompt')
      or jsonb_typeof(v_payload -> 'slug') is distinct from 'string'
      or not coalesce((v_payload ->> 'slug') ~ '^[a-z0-9-]{3,48}$', false)
      or v_payload - 'itemType' - 'slug' <> '{}'::jsonb
      or jsonb_typeof(v_row) is distinct from 'object'
      or v_row - 'topic_id' - 'payload' - 'created_by_run' <> '{}'::jsonb
      or jsonb_typeof(v_row -> 'topic_id') is distinct from 'string'
      or not coalesce((v_row ->> 'topic_id') ~ '^[a-z0-9-]{1,32}$', false)
      or jsonb_typeof(v_row -> 'payload') is distinct from 'object'
      or jsonb_typeof(v_row -> 'created_by_run') is distinct from 'string'
      or not coalesce(
        (v_row ->> 'created_by_run') ~ '^run_[0-9]{4}-[0-9]{2}-[0-9]{2}$', false)
      or jsonb_typeof(v_limits) is distinct from 'object'
      or v_limits - 'perDay' - 'active' <> '{}'::jsonb
      or not (case when jsonb_typeof(v_limits -> 'perDay') = 'number'
        then coalesce(pg_catalog.pg_input_is_valid(v_limits ->> 'perDay', 'integer'), false)
        else false end)
      or not (case when jsonb_typeof(v_limits -> 'active') = 'number'
        then coalesce(pg_catalog.pg_input_is_valid(v_limits ->> 'active', 'integer'), false)
        else false end)
    then
      raise exception 'invalid_event';
    end if;
    if (v_limits ->> 'perDay')::integer < 0 or (v_limits ->> 'active')::integer < 0 then
      raise exception 'invalid_event';
    end if;
    v_per_day := least((v_limits ->> 'perDay')::integer, 10);
    v_max_active := least((v_limits ->> 'active')::integer, 200);
    v_item_type := v_payload ->> 'itemType';

  elsif v_type in ('user_item.retired', 'user_item.hidden') then
    -- The user's own item (p_event item_id), payload { itemType[, slug] } with the stored type;
    -- no rows and no expected versions: the status changes here.
    if p_event ->> 'item_id' is null
      or v_changes <> '[]'::jsonb or v_expected_map <> '{}'::jsonb
      or jsonb_typeof(v_payload -> 'itemType') is distinct from 'string'
      or (v_payload ->> 'itemType') not in ('flashcard', 'exercise', 'prompt')
      or (v_payload ? 'slug' and jsonb_typeof(v_payload -> 'slug') <> 'string')
      or v_payload - 'itemType' - 'slug' <> '{}'::jsonb
    then
      raise exception 'invalid_event';
    end if;
    v_item_type := v_payload ->> 'itemType';

  elsif v_type = 'roadmap.override_set' then
    -- An override (§6.4.5, decision 18): p_event track_id, payload exactly { key, kind, params }
    -- (params an object; its bounds that need the catalog are lib/bot's), limits exactly
    -- { perTrack } (a whole number ≥ 0, clamped to 3 — decision 33); p_changes = [{ table:
    -- roadmap_overrides, row: { until_local_day?, study_days?, created_by_run } }] — until for an
    -- insert_block only (checked against the local day under the lock), study_days 1–5 for an
    -- extra_week only, each equal to its params value (params.until, params.studyDays: the row
    -- never says something else than the event); p_expected = {}.
    v_row := case when jsonb_array_length(v_changes) = 1
      and v_changes -> 0 ->> 'table' = 'roadmap_overrides' then v_changes -> 0 -> 'row' end;
    v_limits := p_event -> 'limits';
    v_ov_key := case when jsonb_typeof(v_payload -> 'key') = 'string' then v_payload ->> 'key' end;
    v_ov_kind := case when jsonb_typeof(v_payload -> 'kind') = 'string'
      then v_payload ->> 'kind' end;
    if v_track_id is null
      or v_expected_map <> '{}'::jsonb
      or not coalesce(v_ov_key ~ '^[a-z0-9-]{3,48}$', false)
      or v_ov_kind is null or v_ov_kind not in ('insert_block', 'extra_week', 'reorder_topics')
      or jsonb_typeof(v_payload -> 'params') is distinct from 'object'
      or v_payload - 'key' - 'kind' - 'params' <> '{}'::jsonb
      or jsonb_typeof(v_row) is distinct from 'object'
      or v_row - 'until_local_day' - 'study_days' - 'created_by_run' <> '{}'::jsonb
      or jsonb_typeof(v_row -> 'created_by_run') is distinct from 'string'
      or not coalesce(
        (v_row ->> 'created_by_run') ~ '^run_[0-9]{4}-[0-9]{2}-[0-9]{2}$', false)
      or (v_row ? 'until_local_day' and not (
        case when jsonb_typeof(v_row -> 'until_local_day') = 'string'
          then (v_row ->> 'until_local_day') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
            and coalesce(pg_catalog.pg_input_is_valid(v_row ->> 'until_local_day', 'date'), false)
          else false end))
      or (v_row ? 'study_days' and not (
        case when jsonb_typeof(v_row -> 'study_days') = 'number'
          then coalesce(pg_catalog.pg_input_is_valid(v_row ->> 'study_days', 'integer'), false)
          else false end))
      or (v_ov_kind = 'insert_block') <> (v_row ? 'until_local_day')
      or (v_ov_kind = 'extra_week') <> (v_row ? 'study_days')
      or jsonb_typeof(v_limits) is distinct from 'object'
      or v_limits - 'perTrack' <> '{}'::jsonb
      or not (case when jsonb_typeof(v_limits -> 'perTrack') = 'number'
        then coalesce(pg_catalog.pg_input_is_valid(v_limits ->> 'perTrack', 'integer'), false)
        else false end)
    then
      raise exception 'invalid_event';
    end if;
    v_until := (v_row ->> 'until_local_day')::date;
    v_study_days := (v_row ->> 'study_days')::integer;
    if (v_limits ->> 'perTrack')::integer < 0 or v_study_days not between 1 and 5 then
      raise exception 'invalid_event';
    end if;
    -- The columns repeat the params: until = params.until, study_days = params.studyDays.
    if (v_ov_kind = 'insert_block'
        and (v_payload -> 'params' -> 'until') is distinct from (v_row -> 'until_local_day'))
      or (v_ov_kind = 'extra_week' and not (
        case when jsonb_typeof(v_payload -> 'params' -> 'studyDays') = 'number'
            and coalesce(pg_catalog.pg_input_is_valid(
              v_payload -> 'params' ->> 'studyDays', 'integer'), false)
          then (v_payload -> 'params' ->> 'studyDays')::integer = v_study_days
          else false end))
    then
      raise exception 'invalid_event';
    end if;
    v_per_track := least((v_limits ->> 'perTrack')::integer, 3);

  elsif v_type = 'roadmap.override_revoked' then
    -- The learner (source system) or the bot (source bot, ruling M6-R17) revokes an override:
    -- p_event track_id, payload { key, kind } (the stored kind; params, if sent, ignored); no
    -- rows and no expected versions.
    v_ov_key := case when jsonb_typeof(v_payload -> 'key') = 'string' then v_payload ->> 'key' end;
    v_ov_kind := case when jsonb_typeof(v_payload -> 'kind') = 'string'
      then v_payload ->> 'kind' end;
    if v_track_id is null or v_ov_key is null or v_ov_kind is null
      or v_changes <> '[]'::jsonb or v_expected_map <> '{}'::jsonb
      or v_payload - 'key' - 'kind' - 'params' <> '{}'::jsonb
    then
      raise exception 'invalid_event';
    end if;

  else
    -- block.checked_in: only the system's auto check-in (§5.5; the learner's goes through
    -- apply_event), for a block of the user's own plan; its derived rows are checked by
    -- apply_derived_changes.
    if v_payload -> 'auto' is distinct from 'true'::jsonb
      or p_event ->> 'plan_id' is null or p_event ->> 'block_id' is null
      or p_event ->> 'track_id' is null
    then
      raise exception 'invalid_event';
    end if;
    -- The plan's date is fixed (plans are permanent), so it is read before the lock it keys.
    select d.plan_date into v_plan_date
    from public.day_plans d
    where d.id = (p_event ->> 'plan_id')::uuid and d.user_id = p_user_id;
    if not found then
      raise exception 'invalid_event';
    end if;
    v_plan_id := (p_event ->> 'plan_id')::uuid;
  end if;

  -- 3. The lock first (decision 33), before any row lock: the plan lock for the four plan types;
  --    for user_item.* a per-user lock (the per-day and active counts); for roadmap.override_* a
  --    per-user-and-track lock (the active counts and the cooldown). admin_set_ai_flag takes the
  --    profile row, then the overrides, never these (decision 34), so the order stays one way.
  if v_plan_date is not null then
    perform pg_catalog.pg_advisory_xact_lock(public.plan_lock_key(p_user_id, v_plan_date));
  elsif v_type in ('user_item.created', 'user_item.retired', 'user_item.hidden') then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('user_items:' || p_user_id::text, 0));
  elsif v_type in ('roadmap.override_set', 'roadmap.override_revoked') then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('roadmap_overrides:' || p_user_id::text || ':' || v_track_id, 0));
  end if;

  -- 4. The row lock keeps the profile active until this transaction ends (admin_set_status waits),
  --    and its AI flag as it is (admin_set_ai_flag waits): the bot writes only for a flagged user.
  select p.status, p.ai_personalization, p.bot_ref into v_status, v_ai, v_bot_ref
  from public.profiles p where p.id = p_user_id for update;
  if v_status is distinct from 'active' then
    raise exception 'inactive' using errcode = '42501';
  end if;
  if v_bot_write and not v_ai then
    raise exception 'ai_off';
  end if;

  -- 5. A definer sees every event: a duplicate only if the id is this user's, else a conflict.
  select e.user_id into v_owner from public.events e where e.id = v_id;
  if found then
    if v_owner = p_user_id then
      return jsonb_build_object('outcome', 'duplicate', 'versions', '{}'::jsonb);
    end if;
    raise exception 'id_conflict';
  end if;

  -- 5a. Ruling M4-R21: a plan built for another local day than the database's — a request that
  --     crossed the day start — gets day_changed before the rebuild check or any write, so a
  --     plan built for yesterday never returns yesterday's stored plan as plan_exists. The caller
  --     rebuilds for the new day (decision 9). Step 8 still checks every other type. The bot's
  --     plan must be for the user's local day in the database (decision 13).
  if v_type = 'plan.generated' and p_event ? 'local_day'
    and (p_event ->> 'local_day')::date <> public.user_local_day(p_user_id, now())
  then
    raise exception 'day_changed';
  end if;
  if v_type = 'plan.ai_proposed'
    and v_plan_date <> public.user_local_day(p_user_id, now())
  then
    raise exception 'day_changed';
  end if;

  -- 5b. The bot's writes (decision 8): a plan comes from a live, running plan run whose key is
  --     payload.runId and which the user is in (a bot_run_users row); a custom item or an
  --     override names, as created_by_run, a live, running plan run; nothing is written while
  --     bot_settings.dry_run is on (an admin who turns it on mid-run makes the rest of the run
  --     dry).
  if v_type = 'plan.ai_proposed' and not exists (
    select 1 from public.bot_runs r
    join public.bot_run_users u on u.run_id = r.id and u.user_id = p_user_id
    where r.id = (v_row ->> 'bot_run_id')::uuid and r.run_key = v_run_key
      and r.kind = 'plan' and r.status = 'running' and r.mode = 'live'
  ) then
    raise exception 'invalid_event';
  end if;
  if v_type in ('user_item.created', 'roadmap.override_set') and not exists (
    select 1 from public.bot_runs r
    where r.run_key = v_row ->> 'created_by_run'
      and r.kind = 'plan' and r.status = 'running' and r.mode = 'live'
  ) then
    raise exception 'invalid_event';
  end if;
  if v_bot_write
    and (select s.dry_run from public.bot_settings s) is distinct from false
  then
    raise exception 'invalid_event';
  end if;

  -- The day the M6 types count and store (the events trigger computes the same one for the
  -- event, from the same now()).
  if v_type in ('user_item.created', 'roadmap.override_set') then
    v_today := public.user_local_day(p_user_id, now());
    -- The user is enrolled in the track, and it is active.
    if not exists (
      select 1 from public.user_tracks t
      where t.user_id = p_user_id and t.track_id = v_track_id and t.status = 'active'
    ) then
      raise exception 'not_enrolled';
    end if;
  end if;

  -- 6. A rebuild is decided under the plan lock, which every plan write and plan event takes: the
  --    plan at version n (version_conflict otherwise), untouched. Decision 12: touched = a
  --    check-in, or an event naming the plan other than its generation and the bot's plan.ai_*
  --    events; such a plan stays as it is (§2.3, §5.4). A plan.extra_added event touches it.
  if v_type = 'plan.generated' and v_mode = 'rebuild' then
    select d.id, d.version into v_plan_id, v_version
    from public.day_plans d
    where d.user_id = p_user_id and d.plan_date = v_plan_date;
    if v_plan_id is null or v_version <> v_expected then
      raise exception 'version_conflict';
    end if;
    if public.plan_is_touched(v_plan_id) then
      return jsonb_build_object(
        'outcome', 'plan_in_use', 'plan_id', v_plan_id, 'versions', '{}'::jsonb);
    end if;
  elsif v_type = 'plan.extra_added' then
    -- The plan at version n; the block starts with the stored block's items — the same objects,
    -- in the same order (none for a new block). A new block is extra:1, or extra:<n> when the
    -- plan holds extra:<n - 1>: the track's extra blocks stay numbered 1, 2, … (M-3).
    select d.version, d.blocks into v_version, v_blocks
    from public.day_plans d where d.id = v_plan_id;
    if v_version <> v_expected then
      raise exception 'version_conflict';
    end if;
    select b.n, b.value -> 'items' into v_old_index, v_old_items
    from pg_catalog.jsonb_array_elements(v_blocks) with ordinality as b (value, n)
    where b.value -> 'id' = to_jsonb(v_block_id)
    order by b.n
    limit 1;
    v_extra_n := substr(v_block_id, char_length(v_extra_prefix) + 1)::integer;
    if v_old_index is null and v_extra_n > 1 and not exists (
      select 1 from pg_catalog.jsonb_array_elements(v_blocks) as b (value)
      where b.value -> 'id' = to_jsonb(v_extra_prefix || (v_extra_n - 1)::text)
    ) then
      raise exception 'invalid_event';
    end if;
    v_old_items := case when jsonb_typeof(v_old_items) = 'array' then v_old_items
      else '[]'::jsonb end;
    if jsonb_array_length(v_items) <> jsonb_array_length(v_old_items)
        + jsonb_array_length(v_item_ids)
      or exists (
        select 1 from pg_catalog.jsonb_array_elements(v_old_items) with ordinality as o (value, n)
        where v_items -> (o.n::integer - 1) is distinct from o.value
      )
    then
      raise exception 'invalid_event';
    end if;
  elsif v_type = 'block.checked_in' then
    -- A block the plan lists (the known_block bound of learner check-ins), read under the lock.
    if not exists (
      select 1 from public.day_plans d, pg_catalog.jsonb_array_elements(d.blocks) b
      where d.id = v_plan_id and b ->> 'id' = p_event ->> 'block_id'
    ) then
      raise exception 'invalid_event';
    end if;
  elsif v_type = 'plan.ai_proposed' then
    -- §2.3 precedence (decision 13), under the plan lock: no plan → insert; an untouched plan
    -- (the rebuild rule above) whose latest plan.generated is not a resume ("Học tiếp hôm nay"
    -- holds the stale items, M5 decision 11) → replace; otherwise the plan stays as it is.
    select d.id, d.version into v_plan_id, v_version
    from public.day_plans d
    where d.user_id = p_user_id and d.plan_date = v_plan_date;
    if v_plan_id is not null and (
      public.plan_is_touched(v_plan_id)
      or (
        select e.payload ->> 'mode' from public.events e
        where e.plan_id = v_plan_id and e.type = 'plan.generated'
        order by
          case when e.payload ->> 'planVersion' ~ '^[0-9]{1,9}$'
            then (e.payload ->> 'planVersion')::integer end desc nulls last,
          e.occurred_at desc
        limit 1
      ) is not distinct from 'resume'
    ) then
      v_outcome := 'plan_in_use';
      v_stored_type := 'plan.ai_skipped';
      v_stored_payload := jsonb_build_object(
        'runId', v_run_key, 'outcome', 'skipped_plan_in_use');
    else
      v_plan_version := coalesce(v_version + 1, 1);
      v_stored_type := 'plan.ai_applied';
      v_stored_payload := jsonb_build_object(
        'runId', v_run_key, 'outcome', 'applied', 'planVersion', v_plan_version);
    end if;
  elsif v_type = 'user_item.created' then
    -- The ID is the server's: user:<the profile's bot_ref>:<slug> (§6.3). The same item again
    -- (type, track, topic and payload) is unchanged; the slug with anything else is taken.
    -- Items are immutable: to change one, the bot retires it and uses a new slug.
    if p_event ->> 'item_id' <> 'user:' || v_bot_ref || ':' || (v_payload ->> 'slug') then
      raise exception 'invalid_event';
    end if;
    select * into v_item from public.user_items i
    where i.user_id = p_user_id and i.item_id = p_event ->> 'item_id';
    if found then
      if v_item.item_type = v_item_type and v_item.track_id = v_track_id
        and v_item.topic_id = v_row ->> 'topic_id' and v_item.payload = v_row -> 'payload'
      then
        return jsonb_build_object('outcome', 'unchanged', 'versions', '{}'::jsonb);
      end if;
      raise exception 'slug_taken';
    end if;
    -- The quotas, under the per-user lock: new items of the local day, and active items.
    if (select count(*) from public.events e
        where e.user_id = p_user_id and e.type = 'user_item.created'
          and e.local_day = v_today) >= v_per_day
      or (select count(*) from public.user_items i
          where i.user_id = p_user_id and i.status = 'active') >= v_max_active
    then
      raise exception 'limit_reached';
    end if;
  elsif v_type in ('user_item.retired', 'user_item.hidden') then
    -- The user's own item, of the stated type; retired from active or hidden, hidden only from
    -- active; the same status again is unchanged.
    select * into v_item from public.user_items i
    where i.user_id = p_user_id and i.item_id = p_event ->> 'item_id'
    for update;
    if not found or v_item.item_type <> v_item_type
      or (v_track_id is not null and v_track_id <> v_item.track_id)
    then
      raise exception 'invalid_event';
    end if;
    if v_item.status = (case v_type when 'user_item.retired' then 'retired' else 'hidden' end)
    then
      return jsonb_build_object('outcome', 'unchanged', 'versions', '{}'::jsonb);
    end if;
    if v_type = 'user_item.hidden' and v_item.status <> 'active' then
      raise exception 'invalid_transition';
    end if;
    v_track_id := v_item.track_id;
  elsif v_type = 'roadmap.override_set' then
    -- until between the local day and 14 days after it (§5.12). The key: another kind →
    -- invalid_event (an override is idempotent by (trackId, key), §6.4.5 — and a kind change
    -- would dodge the extra_week cooldown); revoked by the learner → revoked_key (the bot never
    -- overrides a learner's revocation; one it revoked itself it may set again, as a new start);
    -- in force with the same params → unchanged; otherwise it is upserted in step 7.
    if v_ov_kind = 'insert_block' and v_until not between v_today and v_today + 14 then
      raise exception 'invalid_event';
    end if;
    select * into v_ov from public.roadmap_overrides o
    where o.user_id = p_user_id and o.track_id = v_track_id and o.key = v_ov_key
    for update;
    if found then
      if v_ov.kind <> v_ov_kind then
        raise exception 'invalid_event';
      end if;
      if v_ov.status = 'revoked' and v_ov.revoked_by is distinct from 'bot' then
        raise exception 'revoked_key';
      end if;
      if v_ov.params = v_payload -> 'params'
        and v_ov.until_local_day is not distinct from v_until
        and v_ov.study_days is not distinct from v_study_days
        and public.roadmap_override_active(v_ov, v_today)
      then
        return jsonb_build_object('outcome', 'unchanged', 'versions', '{}'::jsonb);
      end if;
      -- A re-set extra_week is a new start: its previous one counts for the cooldown.
      v_prev_start := case when v_ov.kind = 'extra_week' then v_ov.start_local_day end;
    end if;
  elsif v_type = 'roadmap.override_revoked' then
    -- The user's own override of the stated kind; active or suspended → revoked, recording who
    -- (the learner or the bot); revoked again, by either, is unchanged.
    select * into v_ov from public.roadmap_overrides o
    where o.user_id = p_user_id and o.track_id = v_track_id and o.key = v_ov_key
    for update;
    if not found or v_ov.kind <> v_ov_kind then
      raise exception 'invalid_event';
    end if;
    if v_ov.status = 'revoked' then
      return jsonb_build_object('outcome', 'unchanged', 'versions', '{}'::jsonb);
    end if;
  end if;

  -- 7. The writes (plan.generated, plan.extra_added, plan.ai_proposed and the M6 rows) and the
  --    event, in one subtransaction: a concurrent call with the same event id that commits first
  --    makes the event insert fail on events_pkey, and the writes are rolled back with it. The
  --    table check constraints bound the sizes.
  begin
    if v_type = 'plan.generated' then
      if v_mode = 'rebuild' then
        -- A replacement keeps seen_at and becomes a baseline plan (§2.3, §5.4 settings changes):
        -- an AI plan loses its rationale and run.
        update public.day_plans d set
          blocks = v_row -> 'blocks', roadmap_weeks = v_row -> 'roadmap_weeks',
          version = v_plan_version, source = 'baseline', rules_version = v_rules,
          rationale = null, bot_run_id = null
        where d.id = v_plan_id and d.version = v_expected;
        if not found then
          raise exception 'version_conflict';
        end if;
      else
        -- One plan per date (§5.4 steps 1 and 4): when the date has one, nothing is written and
        -- the caller reads and shows the stored plan.
        insert into public.day_plans
          (user_id, plan_date, source, version, blocks, roadmap_weeks, rules_version)
        values (
          p_user_id, v_plan_date, 'baseline', 1, v_row -> 'blocks', v_row -> 'roadmap_weeks',
          v_rules
        )
        on conflict (user_id, plan_date) do nothing
        returning id into v_plan_id;
        if v_plan_id is null then
          select d.id into v_plan_id
          from public.day_plans d where d.user_id = p_user_id and d.plan_date = v_plan_date;
          return jsonb_build_object(
            'outcome', 'plan_exists', 'plan_id', v_plan_id, 'versions', '{}'::jsonb);
        end if;
      end if;
      v_versions := jsonb_build_object(v_key, v_plan_version);
    elsif v_type = 'plan.extra_added' then
      -- The block replaces the stored block in place, or is appended; version n + 1. The plan
      -- keeps its source, rules_version and seen_at.
      update public.day_plans d set
        blocks = case when v_old_index is null then d.blocks || jsonb_build_array(v_row)
          else jsonb_set(d.blocks, array[(v_old_index - 1)::text], v_row) end,
        version = v_expected + 1
      where d.id = v_plan_id and d.version = v_expected;
      if not found then
        raise exception 'version_conflict';
      end if;
      v_versions := jsonb_build_object(v_key, v_expected + 1);
    elsif v_type = 'plan.ai_proposed' and v_outcome = 'applied' then
      if v_plan_id is null then
        -- Every plan writer takes the plan lock, so the date is still free.
        insert into public.day_plans (
          user_id, plan_date, source, version, blocks, roadmap_weeks, rules_version, rationale,
          bot_run_id
        ) values (
          p_user_id, v_plan_date, 'ai', 1, v_row -> 'blocks', v_row -> 'roadmap_weeks', v_rules,
          v_row ->> 'rationale', (v_row ->> 'bot_run_id')::uuid
        )
        returning id into v_plan_id;
      else
        -- The replacement keeps seen_at (§2.3).
        update public.day_plans d set
          blocks = v_row -> 'blocks', roadmap_weeks = v_row -> 'roadmap_weeks', source = 'ai',
          rationale = v_row ->> 'rationale', bot_run_id = (v_row ->> 'bot_run_id')::uuid,
          rules_version = v_rules, version = v_plan_version
        where d.id = v_plan_id and d.version = v_version;
        if not found then
          raise exception 'version_conflict';
        end if;
      end if;
      v_versions := jsonb_build_object(v_key, v_plan_version);
    elsif v_type = 'user_item.created' then
      insert into public.user_items (
        user_id, item_id, item_type, track_id, topic_id, payload, status, created_by_run,
        created_on
      ) values (
        p_user_id, p_event ->> 'item_id', v_item_type, v_track_id, v_row ->> 'topic_id',
        v_row -> 'payload', 'active', v_row ->> 'created_by_run', v_today
      );
    elsif v_type in ('user_item.retired', 'user_item.hidden') then
      update public.user_items i
      set status = case v_type when 'user_item.retired' then 'retired' else 'hidden' end
      where i.user_id = p_user_id and i.item_id = v_item.item_id;
    elsif v_type = 'roadmap.override_set' then
      insert into public.roadmap_overrides as o (
        user_id, track_id, key, kind, params, status, until_local_day, study_days,
        start_local_day, created_by_run, revoked_at
      ) values (
        p_user_id, v_track_id, v_ov_key, v_ov_kind, v_payload -> 'params', 'active', v_until,
        v_study_days, v_today, v_row ->> 'created_by_run', null
      )
      on conflict (user_id, track_id, key) do update set
        kind = excluded.kind, params = excluded.params, status = 'active',
        until_local_day = excluded.until_local_day, study_days = excluded.study_days,
        start_local_day = excluded.start_local_day, created_by_run = excluded.created_by_run,
        revoked_at = null, revoked_by = null
      returning * into v_ov;
      -- The counts, under the lock, with the computed expiry (decision 18): at most perTrack
      -- overrides in force in the track, one of them an extra_week; an extra_week (a new key or
      -- a re-set one) needs 21 days since the track's last extra_week start, whatever became of
      -- it (revoked or expired) — its own previous start included.
      select count(*), count(*) filter (where o.kind = 'extra_week')
      into v_active_count, v_extra_count
      from public.roadmap_overrides o
      where o.user_id = p_user_id and o.track_id = v_track_id
        and public.roadmap_override_active(o, v_today);
      if v_active_count > v_per_track or v_extra_count > 1 then
        raise exception 'limit_reached';
      end if;
      if v_ov_kind = 'extra_week' and (
        v_prev_start > v_today - 21
        or exists (
          select 1 from public.roadmap_overrides o
          where o.user_id = p_user_id and o.track_id = v_track_id and o.id <> v_ov.id
            and o.kind = 'extra_week' and o.start_local_day > v_today - 21
        )
      ) then
        raise exception 'cooldown';
      end if;
    elsif v_type = 'roadmap.override_revoked' then
      update public.roadmap_overrides o set
        status = 'revoked', revoked_at = now(),
        revoked_by = case when p_event ->> 'source' = 'bot' then 'bot' else 'learner' end
      where o.id = v_ov.id;
    end if;

    insert into public.events (
      id, user_id, actor_id, source, type, track_id, item_id, plan_id, block_id, payload,
      rules_version
    ) values (
      v_id, p_user_id, coalesce((p_event ->> 'actor_id')::uuid, p_user_id),
      case when p_event ->> 'source' in ('system', 'bot', 'admin')
        then p_event ->> 'source' else 'system' end,
      v_stored_type, v_track_id, p_event ->> 'item_id', v_plan_id, p_event ->> 'block_id',
      v_stored_payload, v_rules
    )
    returning local_day into v_local_day;
  exception when unique_violation then
    get stacked diagnostics v_constraint = constraint_name;
    if v_constraint is distinct from 'events_pkey' then
      raise;
    end if;
    select e.user_id into v_owner from public.events e where e.id = v_id;
    if v_owner = p_user_id then
      return jsonb_build_object('outcome', 'duplicate', 'versions', '{}'::jsonb);
    end if;
    raise exception 'id_conflict';
  end;

  -- 8. Decision 10: the caller computed its rows (the auto check-in's day, the extra block) for
  --    p_event.local_day; a request that crossed the day start gets day_changed, and the caller
  --    retries.
  if p_event ? 'local_day' and (p_event ->> 'local_day')::date <> v_local_day then
    raise exception 'day_changed';
  end if;

  -- 9. The state change.
  case v_type
    when 'onboarding.completed' then
      -- §4.5: users cannot write onboarded_at. Set once.
      update public.profiles p set onboarded_at = coalesce(p.onboarded_at, now())
      where p.id = p_user_id;

    when 'block.checked_in' then
      -- The learner path's derived rows (4.9b), stored for p_user_id with the event's
      -- rules_version and local day; this function's owner runs them.
      v_versions := public.apply_derived_changes(
        p_user_id, p_event || jsonb_build_object('rules_version', v_rules), v_local_day,
        v_changes, v_expected_map
      );

    when 'user_item.created', 'user_item.retired', 'user_item.hidden', 'roadmap.override_set',
      'roadmap.override_revoked'
    then
      -- Written with the event (step 7).
      null;

    when 'plan.ai_proposed' then
      -- applied (the plan was written with the event) or plan_in_use (only the event).
      return jsonb_build_object(
        'outcome', v_outcome, 'plan_id', v_plan_id, 'versions', v_versions);

    else
      -- plan.generated, plan.extra_added: the plan was written with its event (step 7).
      return jsonb_build_object(
        'outcome', 'applied', 'plan_id', v_plan_id, 'versions', v_versions);
  end case;

  return jsonb_build_object('outcome', 'applied', 'versions', v_versions);
end $$;

-- Function privileges (controller ruling R5, as every function of this migration):
-- PUBLIC's default EXECUTE and Supabase's default grants are revoked, then each function gets
-- exactly its callers. roadmap_override_active, plan_is_touched: none (their callers run them
-- as their owner).
-- create or replace keeps apply_system_event's ACL (the secret key only); this restates it.
revoke execute on function
  public.roadmap_override_active(public.roadmap_overrides, date),
  public.plan_is_touched(uuid),
  public.apply_system_event(uuid, jsonb, jsonb, jsonb)
from public, anon, authenticated, service_role;
grant execute on function public.apply_system_event(uuid, jsonb, jsonb, jsonb) to service_role;

-- ---------------------------------------------------------------------------------------------
-- 3. Bot settings, token rotation, the AI flag and the user list (admin; §4.2, §6.2, §6.3).
--    Each checks is_admin() first (forbidden). The settings toggles write no event — updated_at
--    and updated_by on the row say who changed them (decision 31); the rotation and the AI flag
--    write their audit events.
-- ---------------------------------------------------------------------------------------------

-- The admin's view of the settings row: never a hash (decision 7).
create function public.bot_settings_json(s public.bot_settings) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object(
    'enabled', s.enabled, 'dryRun', s.dry_run, 'contentProposals', s.content_proposals,
    'perRunUserCap', s.per_run_user_cap, 'limits', s.limits,
    'hasToken', s.token_hash is not null, 'prevValidUntil', s.token_prev_valid_until,
    'rotatedAt', s.token_rotated_at, 'updatedAt', s.updated_at)
$$;

create function public.admin_bot_settings() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return (select public.bot_settings_json(s) from public.bot_settings s);
end $$;

-- null = unchanged. The cap 1–100 (the table's check); limits an object of whole numbers ≥ 0 —
-- lib/bot/limits.ts names the keys and refuses a value above its hard maximum (decision 33), and
-- apply_system_event clamps what it is sent anyway. invalid_settings otherwise.
create function public.admin_update_bot_settings(
  p_enabled boolean, p_dry_run boolean, p_content_proposals boolean,
  p_per_run_user_cap integer, p_limits jsonb
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_settings public.bot_settings;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_per_run_user_cap not between 1 and 100
    or (p_limits is not null and (
      jsonb_typeof(p_limits) <> 'object'
      or octet_length(p_limits::text) > 1024
      or exists (
        select 1 from pg_catalog.jsonb_each(p_limits) as l (key, value)
        -- Nested CASEs, so the cast only ever sees a whole number.
        where not (case when jsonb_typeof(l.value) = 'number'
          then case when coalesce(pg_catalog.pg_input_is_valid(l.value #>> '{}', 'integer'), false)
            then (l.value #>> '{}')::integer >= 0 else false end
          else false end)
      )))
  then
    raise exception 'invalid_settings';
  end if;

  update public.bot_settings s set
    enabled = coalesce(p_enabled, s.enabled),
    dry_run = coalesce(p_dry_run, s.dry_run),
    content_proposals = coalesce(p_content_proposals, s.content_proposals),
    per_run_user_cap = coalesce(p_per_run_user_cap, s.per_run_user_cap),
    limits = coalesce(p_limits, s.limits),
    updated_at = now(),
    updated_by = auth.uid()
  where s.id
  returning * into v_settings;
  return public.bot_settings_json(v_settings);
end $$;

-- "Tạo token mới" (§6.3): the server generates the token and sends its SHA-256 (64 lowercase hex
-- digits, never the token); the current hash stays valid 24 hours as the previous one. One
-- admin.bot_token_rotated event on the admin's own row (the target is the bot, not a user).
create function public.admin_rotate_bot_token(p_token_hash text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_admin constant uuid := auth.uid();
  v_settings public.bot_settings;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into v_settings from public.bot_settings s where s.id for update;
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$'
    or p_token_hash is not distinct from v_settings.token_hash
  then
    raise exception 'invalid_token';
  end if;

  update public.bot_settings s set
    token_prev_hash = s.token_hash,
    token_prev_valid_until = case when s.token_hash is null then null
      else now() + interval '24 hours' end,
    token_hash = p_token_hash,
    token_rotated_at = now(),
    updated_at = now(),
    updated_by = v_admin
  where s.id
  returning * into v_settings;

  insert into public.events (id, user_id, actor_id, source, type, payload)
  values (gen_random_uuid(), v_admin, v_admin, 'admin', 'admin.bot_token_rotated', '{}'::jsonb);

  return jsonb_build_object(
    'rotatedAt', v_settings.token_rotated_at, 'prevValidUntil', v_settings.token_prev_valid_until);
end $$;

-- The AI flag (§5.12, §6.1; decisions 18, 34): for an active account (invalid_transition
-- otherwise), the admin's own included. Locks the profile row, then the user's overrides — never
-- the per-user advisory locks, so it cannot deadlock with apply_system_event (advisory lock →
-- profile → overrides). Off: share_notes_with_ai off too (the switch is hidden while the flag is
-- off, §4.6), and the overrides in force become suspended — one roadmap.override_suspended
-- { keys } event per track. On: every suspended override is active again (an expired one stays
-- expired: its expiry is computed) — roadmap.override_resumed { keys } per track. The audit
-- event admin.ai_flag_changed { targetUserId, from, to } ('on' / 'off').
create function public.admin_set_ai_flag(p_user_id uuid, p_on boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_admin constant uuid := auth.uid();
  v_status text;
  v_from boolean;
  v_today date;
  v_changed jsonb;
  v_track text;
  v_keys jsonb;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select p.status, p.ai_personalization into v_status, v_from
  from public.profiles p where p.id = p_user_id for update;
  if not found then
    raise exception 'not_found';
  end if;
  if v_status <> 'active' or p_on is null then
    raise exception 'invalid_transition';
  end if;
  if v_from = p_on then
    raise exception 'no_change';
  end if;

  update public.profiles p set
    ai_personalization = p_on,
    share_notes_with_ai = p_on and p.share_notes_with_ai
  where p.id = p_user_id;

  perform 1 from public.roadmap_overrides o where o.user_id = p_user_id order by o.id for update;
  v_today := public.user_local_day(p_user_id, now());
  if p_on then
    with changed as (
      update public.roadmap_overrides o set status = 'active'
      where o.user_id = p_user_id and o.status = 'suspended'
      returning o.track_id, o.key
    )
    select jsonb_object_agg(c.track_id, c.keys) into v_changed
    from (select track_id, jsonb_agg(key order by key) as keys from changed group by track_id) c;
  else
    with changed as (
      update public.roadmap_overrides o set status = 'suspended'
      where o.user_id = p_user_id and public.roadmap_override_active(o, v_today)
      returning o.track_id, o.key
    )
    select jsonb_object_agg(c.track_id, c.keys) into v_changed
    from (select track_id, jsonb_agg(key order by key) as keys from changed group by track_id) c;
  end if;

  for v_track, v_keys in select e.key, e.value from jsonb_each(coalesce(v_changed, '{}')) e
    order by e.key
  loop
    insert into public.events (id, user_id, actor_id, source, type, track_id, payload)
    values (
      gen_random_uuid(), p_user_id, v_admin, 'system',
      case when p_on then 'roadmap.override_resumed' else 'roadmap.override_suspended' end,
      v_track, jsonb_build_object('keys', v_keys)
    );
  end loop;

  insert into public.events (id, user_id, actor_id, source, type, payload)
  values (
    gen_random_uuid(), p_user_id, v_admin, 'admin', 'admin.ai_flag_changed',
    jsonb_build_object(
      'targetUserId', p_user_id,
      'from', case when v_from then 'on' else 'off' end,
      'to', case when p_on then 'on' else 'off' end)
  );

  return jsonb_build_object(
    'from', case when v_from then 'on' else 'off' end, 'to', case when p_on then 'on' else 'off' end);
end $$;

-- admin_list_users (20260925000400) plus ai_personalization, the flag toggle's state (task 6.3).
-- The return type changes, so the function is dropped and created again; otherwise unchanged.
drop function public.admin_list_users();

create function public.admin_list_users()
returns table (
  id uuid,
  email text,
  display_name text,
  avatar_url text,
  role text,
  status text,
  created_at timestamptz,
  approved_at timestamptz,
  onboarded_at timestamptz,
  ai_personalization boolean
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- The queue first: pending accounts, oldest sign-up first (first come, first served); then
  -- everyone else, newest first. The id breaks ties, so the order is stable.
  return query
    select p.id, u.email::text, p.display_name, p.avatar_url, p.role, p.status, p.created_at,
      p.approved_at, p.onboarded_at, p.ai_personalization
    from public.profiles p
    join auth.users u on u.id = p.id
    order by
      p.status = 'pending' desc,
      case when p.status = 'pending' then p.created_at end asc,
      p.created_at desc,
      p.id;
end $$;

-- Admins, with their own session (each checks is_admin() itself); bot_settings_json is internal.
revoke execute on function
  public.bot_settings_json(public.bot_settings),
  public.admin_bot_settings(),
  public.admin_update_bot_settings(boolean, boolean, boolean, integer, jsonb),
  public.admin_rotate_bot_token(text),
  public.admin_set_ai_flag(uuid, boolean),
  public.admin_list_users()
from public, anon, authenticated, service_role;
grant execute on function
  public.admin_bot_settings(),
  public.admin_update_bot_settings(boolean, boolean, boolean, integer, jsonb),
  public.admin_rotate_bot_token(text),
  public.admin_set_ai_flag(uuid, boolean),
  public.admin_list_users()
to authenticated;

-- ---------------------------------------------------------------------------------------------
-- 4. Runs (§6.2, §6.4; decisions 8–12). The server's bot path calls these with the secret key;
--    admin_bot_runs is /admin/bot's reader.
-- ---------------------------------------------------------------------------------------------

-- The users a plan run may take (decision 9): AI-flagged, active, onboarded — never processed
-- first, then least recently processed (bot_run_users.processed_at), then by id.
create function public.bot_eligible_users()
returns table (user_id uuid, last_processed_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select x.id, x.processed
  from (
    select p.id,
      (select max(u.processed_at) from public.bot_run_users u where u.user_id = p.id) as processed
    from public.profiles p
    where p.ai_personalization and p.status = 'active' and p.onboarded_at is not null
  ) x
  order by x.processed asc nulls first, x.id
$$;

-- The lazy timeout (§6.2): a run still running more than 2 hours after it started has failed.
-- Run start, /admin/bot's reader and the maintenance cron call it. Returns the count.
create function public.bot_timeout_runs() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_count integer;
begin
  update public.bot_runs r set status = 'failed', failure_reason = 'timeout', finished_at = now()
  where r.status = 'running' and r.started_at < now() - interval '2 hours';
  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- A write's record (decision 10): p_kind plan, custom-items or overrides; p_body_hash the SHA-256
-- of the canonical body (64 lowercase hex digits); p_entry the outcome and response to replay,
-- { outcome, … }. Under the run user's row lock:
-- - outcome invalid: never binds the key — detail[kind].invalidAttempts + 1, returned as
--   { stored: false, invalidAttempts }; a 4th invalid attempt raises too_many_attempts;
-- - writes[kind] present: { stored: false, entry: <the stored entry> } (the caller replays it, or
--   answers 409 for another body hash);
-- - otherwise (applied, dry_run, skipped_*): stores { …p_entry, bodyHash }, sets processed_at if
--   null and, for plan, the user's outcome (decision 12); { stored: true, entry }.
-- The writes column's 32 KB bound is the caller's to respect (it cuts details).
create function public.bot_record_write(
  p_run_user_id uuid, p_kind text, p_body_hash text, p_entry jsonb
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_row public.bot_run_users;
  v_outcome text;
  v_attempts integer;
  v_entry jsonb;
begin
  if p_kind is null or p_kind not in ('plan', 'custom-items', 'overrides')
    or p_body_hash is null or p_body_hash !~ '^[0-9a-f]{64}$'
    or jsonb_typeof(p_entry) is distinct from 'object'
    or jsonb_typeof(p_entry -> 'outcome') is distinct from 'string'
    or (p_entry ->> 'outcome') not in ('applied', 'dry_run', 'skipped_plan_in_use',
      'skipped_gate_closed', 'skipped_unseen', 'invalid')
  then
    raise exception 'invalid_event';
  end if;
  v_outcome := p_entry ->> 'outcome';

  select * into v_row from public.bot_run_users u where u.id = p_run_user_id for update;
  if not found then
    raise exception 'not_found';
  end if;

  if v_row.writes ? p_kind then
    return jsonb_build_object('stored', false, 'entry', v_row.writes -> p_kind);
  end if;

  if v_outcome = 'invalid' then
    v_attempts := coalesce(
      case when jsonb_typeof(v_row.detail -> p_kind -> 'invalidAttempts') = 'number'
        then (v_row.detail -> p_kind ->> 'invalidAttempts')::integer end,
      0) + 1;
    if v_attempts > 3 then
      raise exception 'too_many_attempts';
    end if;
    update public.bot_run_users u set detail = coalesce(u.detail, '{}'::jsonb)
      || jsonb_build_object(p_kind,
        case when jsonb_typeof(u.detail -> p_kind) = 'object' then u.detail -> p_kind
          else '{}'::jsonb end
        || jsonb_build_object('invalidAttempts', v_attempts))
    where u.id = p_run_user_id;
    return jsonb_build_object('stored', false, 'invalidAttempts', v_attempts);
  end if;

  v_entry := p_entry || jsonb_build_object('bodyHash', p_body_hash);
  update public.bot_run_users u set
    writes = u.writes || jsonb_build_object(p_kind, v_entry),
    processed_at = coalesce(u.processed_at, now()),
    outcome = case when p_kind = 'plan' then v_outcome else u.outcome end
  where u.id = p_run_user_id;
  return jsonb_build_object('stored', true, 'entry', v_entry);
end $$;

-- §2.3: the maintenance cron drops the detail (dry-run proposals, invalid details) of runs
-- started more than 30 days ago; writes and outcomes stay (decision 41). Returns the count.
create function public.bot_prune_details() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_count integer;
begin
  update public.bot_run_users u set detail = null
  from public.bot_runs r
  where r.id = u.run_id and r.started_at < now() - interval '30 days' and u.detail is not null;
  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- /admin/bot's run log (§6.2): the latest p_limit runs (1–100, default 20), newest first, each
-- with its user counts per outcome (null = pending) — counts only, no user id, no ref. Times out
-- stale runs first (the lazy timeout on read), so it is volatile.
create function public.admin_bot_runs(p_limit integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  perform public.bot_timeout_runs();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
        'runKey', r.run_key, 'kind', r.kind, 'mode', r.mode, 'status', r.status,
        'failureReason', r.failure_reason, 'usersEligible', r.users_eligible,
        'usersDeferred', r.users_deferred,
        'outcomes', coalesce((
          select jsonb_object_agg(o.outcome, o.n)
          from (
            select coalesce(u.outcome, 'pending') as outcome, count(*) as n
            from public.bot_run_users u where u.run_id = r.id
            group by 1
          ) o
        ), '{}'::jsonb),
        'contentPrUrl', r.content_pr_url, 'summary', r.summary, 'startedAt', r.started_at,
        'finishedAt', r.finished_at)
      order by r.started_at desc, r.run_key desc)
    from (
      select * from public.bot_runs b
      order by b.started_at desc, b.run_key desc
      limit least(greatest(coalesce(p_limit, 20), 1), 100)
    ) r
  ), '[]'::jsonb);
end $$;

-- admin_track_positions' body (20260927000300) for the secret key: the content-coverage horizon
-- of the bot's `missing` signals (task 6.7a). Counts only.
create function public.bot_track_positions()
returns table (track_id text, variant text, week integer, learners integer)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
begin
  return query
    with latest as (
      select distinct on (ut.user_id, ut.track_id)
        ut.track_id as track,
        coalesce(d.roadmap_weeks -> ut.track_id ->> 'variant', ut.roadmap_variant) as roadmap,
        -- CASE, so the cast only ever sees a whole number.
        case when d.roadmap_weeks -> ut.track_id ->> 'week' ~ '^[1-9][0-9]{0,3}$'
          then (d.roadmap_weeks -> ut.track_id ->> 'week')::integer
        end as roadmap_week
      from public.user_tracks ut
      join public.profiles p on p.id = ut.user_id and p.status = 'active'
      join public.day_plans d
        on d.user_id = ut.user_id
        and d.plan_date >= current_date - 14
        and d.roadmap_weeks ? ut.track_id
      where ut.status = 'active'
      order by ut.user_id, ut.track_id, d.plan_date desc
    )
    select l.track, l.roadmap, l.roadmap_week, count(*)::integer
    from latest l
    where l.roadmap_week is not null
    group by l.track, l.roadmap, l.roadmap_week
    order by 1, 2, 3;
end $$;

-- The secret key's bot path and maintenance cron; admin_bot_runs for admins (it checks
-- is_admin() and calls bot_timeout_runs as its owner).
revoke execute on function
  public.bot_eligible_users(),
  public.bot_timeout_runs(),
  public.bot_record_write(uuid, text, text, jsonb),
  public.bot_prune_details(),
  public.admin_bot_runs(integer),
  public.bot_track_positions()
from public, anon, authenticated, service_role;
grant execute on function
  public.bot_eligible_users(),
  public.bot_timeout_runs(),
  public.bot_record_write(uuid, text, text, jsonb),
  public.bot_prune_details(),
  public.bot_track_positions()
to service_role;
grant execute on function public.admin_bot_runs(integer) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- 5. Publish requests (§6.6, decision 20) and the content signals (§6.4.7, decision 19).
-- ---------------------------------------------------------------------------------------------

-- A request's admin view.
create function public.publish_request_json(r public.content_publish_requests) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object(
    'id', r.id, 'target', r.target, 'status', r.status, 'prUrl', r.pr_url,
    'requestedAt', r.requested_at)
$$;

-- "Xuất bản" (/admin/content): a pending request for the target (an item ID or <itemId>#note —
-- the table's form, invalid_target otherwise; that it is a draft is checked against the catalog
-- by the server first). A pending request for the target already → that one is returned.
create function public.admin_request_publish(p_target text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_request public.content_publish_requests;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_target is null
    or p_target !~ '^[a-z][a-z0-9-]{0,31}:[a-z0-9:-]{1,120}(#note)?$'
  then
    raise exception 'invalid_target';
  end if;
  insert into public.content_publish_requests (target, requested_by)
  values (p_target, auth.uid())
  on conflict (target) where status = 'pending' do nothing
  returning * into v_request;
  if not found then
    select * into v_request from public.content_publish_requests r
    where r.target = p_target and r.status = 'pending';
  end if;
  return public.publish_request_json(v_request);
end $$;

-- "Huỷ": a pending request → cancelled (not_found, invalid_transition otherwise).
create function public.admin_cancel_publish(p_id bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_request public.content_publish_requests;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into v_request from public.content_publish_requests r where r.id = p_id for update;
  if not found then
    raise exception 'not_found';
  end if;
  if v_request.status <> 'pending' then
    raise exception 'invalid_transition';
  end if;
  update public.content_publish_requests r set status = 'cancelled', updated_at = now()
  where r.id = p_id
  returning * into v_request;
  return public.publish_request_json(v_request);
end $$;

-- The public GET /api/content/publish-requests (§6.6): the targets of pending requests, sorted —
-- nothing else (no ids, no people, no PRs). The one SECURITY DEFINER function anon may call
-- (schema-invariants 001, check 4): anon may read no table.
create function public.publish_request_targets() returns setof text
language sql stable security definer set search_path = '' as $$
  select r.target from public.content_publish_requests r
  where r.status = 'pending'
  order by r.target
$$;

-- finishRun (task 6.4a, §6.4.6): the publish run's PR on the listed pending requests. Returns the
-- count.
create function public.publish_set_pr(p_ids bigint[], p_pr_url text) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_count integer;
begin
  if p_pr_url is null
    or p_pr_url !~ '^https://github\.com/khanhnguyendev/hoc-deu/pull/[1-9][0-9]{0,6}$'
  then
    raise exception 'invalid_pr_url';
  end if;
  update public.content_publish_requests r set pr_url = p_pr_url, updated_at = now()
  where r.id = any (p_ids) and r.status = 'pending';
  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- The maintenance cron's publish step (task 6.7a): a pending request whose target the deployed
-- catalog shows active → merged. Returns the count.
create function public.publish_mark_merged(p_ids bigint[]) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_count integer;
begin
  update public.content_publish_requests r set status = 'merged', updated_at = now()
  where r.id = any (p_ids) and r.status = 'pending';
  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- ... and a pending request whose PR was closed unmerged loses its pr_url, so the next publish
-- run retries it. Returns the count.
create function public.publish_clear_pr(p_ids bigint[]) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_count integer;
begin
  update public.content_publish_requests r set pr_url = null, updated_at = now()
  where r.id = any (p_ids) and r.status = 'pending' and r.pr_url is not null;
  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- The content signals' input (§6.4.7, decision 19): item.result events of the last p_days days
-- (1–365), per repository item (custom user: items excluded), only items at least 5 distinct users
-- answered: attempts, fails (failed, dont_know), hints (hint, unsure) and users. Aggregates only —
-- no text, no user, no note.
create function public.content_signal_results(p_days integer)
returns table (item_id text, attempts integer, fails integer, hints integer, users integer)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
begin
  if p_days is null or p_days not between 1 and 365 then
    raise exception 'invalid_event';
  end if;
  return query
    select e.item_id,
      count(*)::integer,
      (count(*) filter (where e.payload ->> 'result' in ('failed', 'dont_know')))::integer,
      (count(*) filter (where e.payload ->> 'result' in ('hint', 'unsure')))::integer,
      count(distinct e.user_id)::integer
    from public.events e
    where e.type = 'item.result' and e.item_id is not null and e.item_id not like 'user:%'
      and e.occurred_at >= now() - make_interval(days => p_days)
    group by e.item_id
    having count(distinct e.user_id) >= 5
    order by e.item_id;
end $$;

-- Admins request and cancel; the secret key sets and clears PRs, marks merges and reads the
-- signals; everyone reads the pending targets (§6.6). publish_request_json is internal.
revoke execute on function
  public.publish_request_json(public.content_publish_requests),
  public.admin_request_publish(text),
  public.admin_cancel_publish(bigint),
  public.publish_request_targets(),
  public.publish_set_pr(bigint[], text),
  public.publish_mark_merged(bigint[]),
  public.publish_clear_pr(bigint[]),
  public.content_signal_results(integer)
from public, anon, authenticated, service_role;
grant execute on function
  public.admin_request_publish(text),
  public.admin_cancel_publish(bigint)
to authenticated;
grant execute on function
  public.publish_set_pr(bigint[], text),
  public.publish_mark_merged(bigint[]),
  public.publish_clear_pr(bigint[]),
  public.content_signal_results(integer)
to service_role;
grant execute on function public.publish_request_targets() to anon, authenticated, service_role;
