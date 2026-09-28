-- Task 6.2b: every M6 SQL function and every M6 branch of apply_system_event (platform design
-- §2.3, §4.2–§4.5, §5.12, §6.2–§6.6, §6.10; implementation plan Part B-M6 decisions 4, 8–13,
-- 17–20, 31, 33, 34). The second and last M6 migration (decision 4): the bot tasks call these.
-- 1. roadmap_override_active: decision 18's computed expiry.
-- 2. apply_system_event: plan.ai_proposed (the untouched-plan precedence), user_item.created /
--    retired / hidden, roadmap.override_set / revoked; a plan.generated rebuild clears rationale
--    and bot_run_id.
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
  -- roadmap.override_set; the learner's hide and revoke come from a server action (source
  -- system) and name the learner as the actor, if anyone.
  if (v_type in ('plan.ai_proposed', 'user_item.created', 'user_item.retired',
        'roadmap.override_set')
      and p_event -> 'source' is distinct from '"bot"'::jsonb)
    or (v_type in ('user_item.hidden', 'roadmap.override_revoked')
      and (p_event -> 'source' is distinct from '"system"'::jsonb
        or coalesce((p_event ->> 'actor_id')::uuid, p_user_id) <> p_user_id))
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
    -- extra_week only; p_expected = {}.
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
    v_per_track := least((v_limits ->> 'perTrack')::integer, 3);

  elsif v_type = 'roadmap.override_revoked' then
    -- The learner revokes one of their overrides: p_event track_id, payload { key, kind } (the
    -- stored kind; params, if sent, ignored); no rows and no expected versions.
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
  if v_type in ('plan.ai_proposed', 'user_item.created', 'user_item.retired',
      'roadmap.override_set')
    and not v_ai
  then
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
  --     payload.runId; nothing is written while bot_settings.dry_run is on (an admin who turns it
  --     on mid-run makes the rest of the run dry).
  if v_type = 'plan.ai_proposed' and not exists (
    select 1 from public.bot_runs r
    where r.id = (v_row ->> 'bot_run_id')::uuid and r.run_key = v_run_key
      and r.kind = 'plan' and r.status = 'running' and r.mode = 'live'
  ) then
    raise exception 'invalid_event';
  end if;
  if v_type in ('plan.ai_proposed', 'user_item.created', 'user_item.retired',
      'roadmap.override_set')
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
    if exists (select 1 from public.plan_block_state b where b.plan_id = v_plan_id)
      or exists (
        select 1 from public.events e
        where e.plan_id = v_plan_id
          and e.type not in (
            'plan.generated', 'plan.ai_proposed', 'plan.ai_applied', 'plan.ai_skipped')
      )
    then
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
      exists (select 1 from public.plan_block_state b where b.plan_id = v_plan_id)
      or exists (
        select 1 from public.events e
        where e.plan_id = v_plan_id
          and e.type not in (
            'plan.generated', 'plan.ai_proposed', 'plan.ai_applied', 'plan.ai_skipped')
      )
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
    -- until between the local day and 14 days after it (§5.12). The key: revoked by the learner
    -- → revoked_key (the bot never overrides a revocation); in force with the same kind and
    -- params → unchanged; otherwise it is upserted in step 7.
    if v_ov_kind = 'insert_block' and v_until not between v_today and v_today + 14 then
      raise exception 'invalid_event';
    end if;
    select * into v_ov from public.roadmap_overrides o
    where o.user_id = p_user_id and o.track_id = v_track_id and o.key = v_ov_key
    for update;
    if found then
      if v_ov.status = 'revoked' then
        raise exception 'revoked_key';
      end if;
      if v_ov.kind = v_ov_kind and v_ov.params = v_payload -> 'params'
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
    -- The user's own override of the stated kind; active or suspended → revoked; revoked again
    -- is unchanged.
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
        revoked_at = null
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
      update public.roadmap_overrides o set status = 'revoked', revoked_at = now()
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
-- exactly its callers. roadmap_override_active: none (its callers run it as their owner).
-- create or replace keeps apply_system_event's ACL (the secret key only); this restates it.
revoke execute on function
  public.roadmap_override_active(public.roadmap_overrides, date),
  public.apply_system_event(uuid, jsonb, jsonb, jsonb)
from public, anon, authenticated, service_role;
grant execute on function public.apply_system_event(uuid, jsonb, jsonb, jsonb) to service_role;
