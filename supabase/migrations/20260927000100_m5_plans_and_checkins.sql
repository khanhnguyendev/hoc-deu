-- Task 5.0b: SQL for plans and check-ins (platform design §2.3, §4.1, §4.3–§4.5, §5.5, §5.9;
-- implementation plan Part B-M5 decisions 9, 22, 23, 30; rulings M4-R12, M4-R21, M4-R22, M5-R2).
-- 1. apply_system_event: plan.generated raises day_changed before it can return plan_exists
--    (M4-R21), and plan.extra_added ("Học thêm", off-plan study — §5.9, decision 22) is applied.
-- 2. Owner ruling M-6 (a), RULES_VERSION 3: a block checked in skipped and corrected to done /
--    partial on a later local day counts for that later day (apply_derived_changes, a column
--    grant and the check_in_day trigger that bounds it).
-- 3. M2 minor "quota #500": a same-user double submit of the 500th event is a duplicate.
-- Merged migrations are never edited: the functions are replaced here (`create or replace` keeps
-- their owner, privileges and triggers; the grants are restated below). Every function revokes
-- EXECUTE from PUBLIC explicitly and grants exactly its callers (see 20260925000100);
-- schema-invariants (001) and 073 check it.

-- ---------------------------------------------------------------------------------------------
-- 1. apply_system_event (§4.3, §4.4): system, bot and admin events for p_user_id, from the server
-- with the secret key only. SECURITY DEFINER: it runs as its owner, so RLS and the learner bounds
-- do not apply — every check the learner path gets from them is made here. Unchanged from
-- 20260926000300 except for plan.extra_added and the day check of plan.generated (step 5a).
-- 1. The type: a system type (invalid_event), implemented here (not_implemented otherwise: the
--    owning tasks are plan.ai_* 6.5, user_item.* and roadmap.override_* 6.6,
--    admin.bot_token_rotated 6.3, item.snapshot the compaction job; the admin decisions have their
--    own functions — admin_bootstrap, admin_set_status and admin_set_role (M2), and
--    admin.ai_flag_changed's writer admin_set_ai_flag (v1.1, task 6.5)). 2. The event's shape and,
--    per type, its payload, p_changes and p_expected (invalid_event) — before any lock. 3. The
--    (user, plan_date) advisory lock for the plan types (decision 33 of M4: before any row lock,
--    as apply_event takes it — the reverse order deadlocks with apply_event's key-share lock on
--    the profile row).
-- 4. The profile row lock: active users only (inactive). 5. A duplicate event id is a no-op.
-- 5a. plan.generated: day_changed when the caller built the plan for another local day (ruling
--    M4-R21) — before plan_exists, which then only returns a plan of the database's own day.
-- 6. A rebuild: version_conflict / plan_in_use; plan.extra_added: version_conflict and the stored
--    extra block — each decided under the lock. 7. The plan write (plan_exists when the date has
--    a plan) and the event, in one subtransaction.
-- 8. day_changed when the caller computed its rows for another local day (decision 10 of M4).
-- 9. The state change.
-- Returns { outcome, versions } — plus plan_id for plan.generated and plan.extra_added.
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
  v_blocks jsonb;
  v_old_items jsonb;
  v_old_index bigint;
begin
  -- 1. A system type, and one implemented here.
  if v_type is null or not v_type = any (public.system_event_types()) then
    raise exception 'invalid_event';
  end if;
  if v_type not in (
    'onboarding.completed', 'plan.generated', 'plan.extra_added', 'block.checked_in'
  ) then
    raise exception 'not_implemented';
  end if;

  -- 2. The event's shape: local_day, when present, a YYYY-MM-DD date (as apply_event). Only a
  --    check-in and an extra addition name a plan here: plan.generated gets the plan's id from
  --    the database, and no other type may mark a plan as touched (§2.3).
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
    -- "Học thêm" and off-plan study (§5.9, decision 22): the server appends items to the track's
    -- extra block of the user's own plan. p_event: plan_id and track_id; payload exactly
    -- { itemIds }, 1 to 20 distinct strings of 1–128 characters (ruling M5-R2; addExtraItems
    -- checks the same bound before calling). p_changes = [{ table: day_plan_block, row: <block> }]
    -- — the whole extra block after the addition — and p_expected = { "day_plans:<plan_date>": n }
    -- and nothing else, n the plan's version.
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
    v_block_id := to_char(v_plan_date, 'YYYY-MM-DD') || ':' || (p_event ->> 'track_id')
      || ':extra:1';
    v_row := case when jsonb_array_length(v_changes) = 1
      and v_changes -> 0 ->> 'table' = 'day_plan_block' then v_changes -> 0 -> 'row' end;
    v_items := v_row -> 'items';
    -- The block: the track's extra block (id <date>:<track>:extra:1, kind extra), a numeric
    -- estMinutes, items with distinct string itemIds that end with exactly payload.itemIds, in
    -- order. The items before them are checked against the stored block under the lock.
    if (select count(*) from jsonb_object_keys(v_expected_map)) <> 1
      or not (case when jsonb_typeof(v_expected_map -> v_key) = 'number'
        then coalesce(pg_catalog.pg_input_is_valid(v_expected_map ->> v_key, 'integer'), false)
        else false end)
      or jsonb_typeof(v_row) is distinct from 'object'
      or v_row -> 'id' is distinct from to_jsonb(v_block_id)
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

  -- 3. The plan lock first (decision 33), for the three plan types.
  if v_plan_date is not null then
    perform pg_catalog.pg_advisory_xact_lock(public.plan_lock_key(p_user_id, v_plan_date));
  end if;

  -- 4. The row lock keeps the profile active until this transaction ends (admin_set_status waits).
  select p.status into v_status from public.profiles p where p.id = p_user_id for update;
  if v_status is distinct from 'active' then
    raise exception 'inactive' using errcode = '42501';
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
  --     rebuilds for the new day (decision 9). Step 8 still checks every other type.
  if v_type = 'plan.generated' and p_event ? 'local_day'
    and (p_event ->> 'local_day')::date <> public.user_local_day(p_user_id, now())
  then
    raise exception 'day_changed';
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
    -- The plan at version n; the block starts with the stored extra block's items — the same
    -- objects, in the same order (none when the track has no extra block yet).
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
  end if;

  -- 7. The plan (plan.generated, plan.extra_added) and the event, in one subtransaction: a
  --    concurrent call with the same event id that commits first makes the event insert fail on
  --    events_pkey, and the plan write is rolled back with it. The day_plans check constraints
  --    bound the plan's size.
  begin
    if v_type = 'plan.generated' then
      if v_mode = 'rebuild' then
        -- A replacement keeps seen_at and becomes a baseline plan (§2.3, §5.4 settings changes).
        update public.day_plans d set
          blocks = v_row -> 'blocks', roadmap_weeks = v_row -> 'roadmap_weeks',
          version = v_plan_version, source = 'baseline', rules_version = v_rules
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
      -- The block replaces the track's extra block in place, or is appended; version n + 1. The
      -- plan keeps its source, rules_version and seen_at.
      update public.day_plans d set
        blocks = case when v_old_index is null then d.blocks || jsonb_build_array(v_row)
          else jsonb_set(d.blocks, array[(v_old_index - 1)::text], v_row) end,
        version = v_expected + 1
      where d.id = v_plan_id and d.version = v_expected;
      if not found then
        raise exception 'version_conflict';
      end if;
      v_versions := jsonb_build_object(v_key, v_expected + 1);
    end if;

    insert into public.events (
      id, user_id, actor_id, source, type, track_id, item_id, plan_id, block_id, payload,
      rules_version
    ) values (
      v_id, p_user_id, coalesce((p_event ->> 'actor_id')::uuid, p_user_id),
      case when p_event ->> 'source' in ('system', 'bot', 'admin')
        then p_event ->> 'source' else 'system' end,
      v_type, p_event ->> 'track_id', p_event ->> 'item_id', v_plan_id, p_event ->> 'block_id',
      v_payload, v_rules
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

    else
      -- plan.generated, plan.extra_added: the plan was written with its event (step 7).
      return jsonb_build_object(
        'outcome', 'applied', 'plan_id', v_plan_id, 'versions', v_versions);
  end case;

  return jsonb_build_object('outcome', 'applied', 'versions', v_versions);
end $$;

-- Unchanged: the secret key (service_role) only. apply_derived_changes, plan_lock_key,
-- user_local_day and system_event_types keep theirs (this function calls them as its owner).
revoke execute on function public.apply_system_event(uuid, jsonb, jsonb, jsonb)
from public, anon, authenticated, service_role;
grant execute on function public.apply_system_event(uuid, jsonb, jsonb, jsonb) to service_role;

-- ---------------------------------------------------------------------------------------------
-- 2. Owner ruling M-6 (a) (§4.1, §5.5): a block checked in skipped and later corrected to done /
--    partial on a later local day counts for that later day — its checked_in_on moves forward to
--    the event's local day, and the earlier day is recomputed without it (the caller sends both
--    days' daily_activity rows, ADR-0007 "Loading derived state"). Every other edit keeps
--    checked_in_on (decision 6 of M4). The engine (lib/domain/projection) applies the same rule:
--    RULES_VERSION 3 (lib/domain/rules.ts, ruling M4-R11), which tools/db/sql-sync.test.ts and
--    pgTAP 070 compare with the function below.
-- ---------------------------------------------------------------------------------------------

create or replace function public.rules_version() returns integer
language sql immutable set search_path = '' as $$
  select 3
$$;

-- apply_derived_changes (§4.3, §4.4, decision 10 of M4): unchanged from 20260926000200 except that
-- the plan_block_state update applies the M-6 rule to checked_in_on — the row's own
-- checked_in_on is still ignored: SQL decides the day. The invoker apply_event runs it as the
-- learner, so the column is granted to authenticated below and bounded by check_in_day.
create or replace function public.apply_derived_changes(
  p_user_id uuid, p_event jsonb, p_local_day date, p_changes jsonb, p_expected jsonb
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  v_type constant text := p_event ->> 'type';
  v_changes constant jsonb := coalesce(p_changes, '[]'::jsonb);
  v_expected_map constant jsonb := coalesce(p_expected, '{}'::jsonb);
  v_allowed text[];
  v_rules integer;
  v_change jsonb;
  v_table text;
  v_row jsonb;
  v_key text;
  v_tables text[] := '{}';
  v_rows jsonb[] := '{}';
  v_keys text[] := '{}';
  v_expected integer[] := '{}';
  v_version integer;
  v_versions jsonb := '{}'::jsonb;
begin
  if current_user = 'authenticated' and p_user_id is distinct from auth.uid() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_user_id is null or p_local_day is null
    or jsonb_typeof(p_event) is distinct from 'object'
    or not coalesce(pg_catalog.pg_input_is_valid(p_event ->> 'rules_version', 'integer'), true)
    or jsonb_typeof(v_changes) <> 'array'
    or jsonb_typeof(v_expected_map) <> 'object'
  then
    raise exception 'invalid_event';
  end if;
  if jsonb_array_length(v_changes) > 16 then
    raise exception 'invalid_event';
  end if;
  v_rules := coalesce((p_event ->> 'rules_version')::integer, public.rules_version());

  -- The tables each event type may change (anything else: none).
  v_allowed := case
    when v_type in ('item.result', 'lesson.completed', 'exercise.submitted', 'prompt.completed')
      then array['item_state', 'daily_activity']
    when v_type in ('item.skipped', 'item.readded', 'item.snapshot') then array['item_state']
    when v_type = 'block.checked_in' then array['plan_block_state', 'daily_activity']
    else array[]::text[]
  end;

  -- 1. Check every change and compute its key; nothing is written yet.
  for v_change in select c.value from jsonb_array_elements(v_changes) as c loop
    v_table := case when jsonb_typeof(v_change) = 'object' then v_change ->> 'table' end;
    v_row := case when jsonb_typeof(v_change) = 'object' then v_change -> 'row' end;
    if v_table is null or not v_table = any (v_allowed)
      or jsonb_typeof(v_row) is distinct from 'object'
    then
      raise exception 'invalid_event';
    end if;

    case v_table
      when 'item_state' then
        -- Only the event's own item.
        if v_row ->> 'item_id' is null or v_row ->> 'item_id' is distinct from p_event ->> 'item_id'
        then
          raise exception 'invalid_event';
        end if;
        v_key := 'item_state:' || (v_row ->> 'item_id');
      when 'plan_block_state' then
        -- Only the event's own plan and block.
        if not coalesce(pg_catalog.pg_input_is_valid(v_row ->> 'plan_id', 'uuid'), false)
          or not coalesce(pg_catalog.pg_input_is_valid(p_event ->> 'plan_id', 'uuid'), false)
          or v_row ->> 'block_id' is null
          or v_row ->> 'block_id' is distinct from p_event ->> 'block_id'
        then
          raise exception 'invalid_event';
        end if;
        if (v_row ->> 'plan_id')::uuid <> (p_event ->> 'plan_id')::uuid then
          raise exception 'invalid_event';
        end if;
        v_key := 'plan_block_state:' || (v_row ->> 'plan_id')::uuid::text || '/'
          || (v_row ->> 'block_id');
      else
        -- daily_activity: any day (an edited check-in recomputes the day it counts for,
        -- decision 8; an M-6 move recomputes both days); a new row only near today (the
        -- daily_activity_window trigger). The key keeps the row's own YYYY-MM-DD text, which no
        -- DateStyle changes.
        if not (case when jsonb_typeof(v_row -> 'local_day') = 'string'
          then (v_row ->> 'local_day') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
            and coalesce(pg_catalog.pg_input_is_valid(v_row ->> 'local_day', 'date'), false)
          else false end)
        then
          raise exception 'invalid_event';
        end if;
        v_key := 'daily_activity:' || (v_row ->> 'local_day');
    end case;

    -- One change per row, and its expected version: a non-negative JSON integer.
    if v_key = any (v_keys)
      or not (case when jsonb_typeof(v_expected_map -> v_key) = 'number'
        then coalesce(pg_catalog.pg_input_is_valid(v_expected_map ->> v_key, 'integer'), false)
        else false end)
    then
      raise exception 'invalid_event';
    end if;
    if (v_expected_map ->> v_key)::integer < 0 then
      raise exception 'invalid_event';
    end if;

    v_tables := array_append(v_tables, v_table);
    v_rows := array_append(v_rows, v_row);
    v_keys := array_append(v_keys, v_key);
    v_expected := array_append(v_expected, (v_expected_map ->> v_key)::integer);
  end loop;

  -- Every expected version belongs to a change.
  if exists (
    select 1 from jsonb_object_keys(v_expected_map) as k (key) where not k.key = any (v_keys)
  ) then
    raise exception 'invalid_event';
  end if;

  -- 2. Write, in the order given. user_id, version and rules_version never come from the row.
  for i in 1 .. coalesce(array_length(v_keys, 1), 0) loop
    v_row := v_rows[i];
    v_version := null;
    case v_tables[i]
      when 'item_state' then
        if v_expected[i] = 0 then
          insert into public.item_state (
            user_id, item_id, track_id, topic_id, item_type, level, weak, top_successes, status,
            due_on, last_result, last_result_on, introduced_on, lapses, reps, version,
            rules_version
          )
          select
            p_user_id, v_row ->> 'item_id', r.track_id, r.topic_id, r.item_type, r.level, r.weak,
            r.top_successes, r.status, r.due_on, r.last_result, r.last_result_on, r.introduced_on,
            r.lapses, r.reps, 1, v_rules
          from jsonb_populate_record(null::public.item_state, v_row) as r
          on conflict (user_id, item_id) do nothing
          returning version into v_version;
        else
          update public.item_state s set
            track_id = r.track_id, topic_id = r.topic_id, item_type = r.item_type,
            level = r.level, weak = r.weak, top_successes = r.top_successes, status = r.status,
            due_on = r.due_on, last_result = r.last_result, last_result_on = r.last_result_on,
            introduced_on = r.introduced_on, lapses = r.lapses, reps = r.reps,
            version = s.version + 1, rules_version = v_rules
          from jsonb_populate_record(null::public.item_state, v_row) as r
          where s.user_id = p_user_id and s.item_id = v_row ->> 'item_id'
            and s.version = v_expected[i]
          returning s.version into v_version;
        end if;

      when 'plan_block_state' then
        if v_expected[i] = 0 then
          insert into public.plan_block_state (
            plan_id, block_id, user_id, track_id, status, minutes, note, auto, checked_in_on,
            checked_in_at, version, rules_version
          )
          select
            (v_row ->> 'plan_id')::uuid, v_row ->> 'block_id', p_user_id, r.track_id, r.status,
            r.minutes, r.note, r.auto, p_local_day, now(), 1, v_rules
          from jsonb_populate_record(null::public.plan_block_state, v_row) as r
          on conflict (plan_id, block_id) do nothing
          returning version into v_version;
        else
          -- track_id never changes (and has no UPDATE grant). checked_in_on moves only by the
          -- M-6 rule: a skipped block corrected to done / partial on a later day counts for that
          -- day (b.status and b.checked_in_on are the stored, old values).
          update public.plan_block_state b set
            status = r.status, minutes = r.minutes, note = r.note, auto = r.auto,
            checked_in_on = case
              when b.status = 'skipped' and r.status in ('done', 'partial')
                and p_local_day > b.checked_in_on
              then p_local_day else b.checked_in_on end,
            checked_in_at = now(), version = b.version + 1, rules_version = v_rules
          from jsonb_populate_record(null::public.plan_block_state, v_row) as r
          where b.plan_id = (v_row ->> 'plan_id')::uuid and b.block_id = v_row ->> 'block_id'
            and b.user_id = p_user_id and b.version = v_expected[i]
          returning b.version into v_version;
        end if;

      else
        if v_expected[i] = 0 then
          insert into public.daily_activity (
            user_id, local_day, minutes_by_track, items_done, completed, version, rules_version
          )
          select
            p_user_id, (v_row ->> 'local_day')::date, r.minutes_by_track, r.items_done,
            r.completed, 1, v_rules
          from jsonb_populate_record(null::public.daily_activity, v_row) as r
          on conflict (user_id, local_day) do nothing
          returning version into v_version;
        else
          update public.daily_activity a set
            minutes_by_track = r.minutes_by_track, items_done = r.items_done,
            completed = r.completed, version = a.version + 1, rules_version = v_rules
          from jsonb_populate_record(null::public.daily_activity, v_row) as r
          where a.user_id = p_user_id and a.local_day = (v_row ->> 'local_day')::date
            and a.version = v_expected[i]
          returning a.version into v_version;
        end if;
    end case;

    -- No row inserted (it exists) or updated (another version, or no row): a concurrent writer
    -- won; the raise rolls the whole call back.
    if v_version is null then
      raise exception 'version_conflict';
    end if;
    v_versions := v_versions || jsonb_build_object(v_keys[i], v_version);
  end loop;

  return v_versions;
end $$;

-- The learner's bound on checked_in_on (the ruling R14 pattern of M2): apply_event runs as the
-- learner, so authenticated needs the column, and could then write it directly. For
-- `authenticated` only — owner and secret-key writes are trusted — and only when the value
-- changes: apply_derived_changes always names the column, so an unchanged value must pass. Such a
-- change is allowed only from skipped to done / partial, only forward, and only to the learner's
-- local day now — exactly the M-6 move. RLS's using clause lets a learner's update reach this
-- trigger only for their own rows.
create function public.plan_block_state_check_in_day() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user <> 'authenticated'
    or new.checked_in_on is not distinct from old.checked_in_on
  then
    return new;
  end if;
  if old.status = 'skipped' and new.status in ('done', 'partial')
    and new.checked_in_on > old.checked_in_on
    and new.checked_in_on = public.user_local_day(new.user_id, now())
  then
    return new;
  end if;
  raise exception 'invalid_event';
end $$;

create trigger check_in_day before update of checked_in_on on public.plan_block_state
  for each row execute function public.plan_block_state_check_in_day();

revoke execute on function
  public.rules_version(),
  public.apply_derived_changes(uuid, jsonb, date, jsonb, jsonb),
  public.plan_block_state_check_in_day()
from public, anon, authenticated, service_role;
-- The events trigger and the rules_version column defaults run as the inserting user (as
-- 20260925000200); the invoker apply_event calls apply_derived_changes as the learner, and the
-- server may call it too (as 20260926000200). Trigger functions get no grants.
grant execute on function public.rules_version() to authenticated, service_role;
grant execute on function public.apply_derived_changes(uuid, jsonb, date, jsonb, jsonb)
to authenticated, service_role;

grant update (checked_in_on) on public.plan_block_state to authenticated;

-- ---------------------------------------------------------------------------------------------
-- 3. Quota #500 (M2 minor; ADR-0030): two same-user submits of one event at the limit — both pass
--    apply_event's duplicate check, the second waits on the quota row lock — made the second
--    raise quota_exceeded instead of duplicate. Once the counter passes 500, the trigger now
--    raises only when no event has new.id yet; otherwise the insert goes on and fails on
--    events_pkey, which apply_event answers with duplicate (or id_conflict for another user's
--    id), and the failed insert rolls the counter's increment back. SECURITY DEFINER sees every
--    event, and the lookup's fresh snapshot sees the winner once the row lock is granted.
-- ---------------------------------------------------------------------------------------------

create or replace function public.events_enforce_quota() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_count integer;
begin
  if new.source = 'learner' then
    insert into public.event_quota (user_id, local_day, count)
    values (new.user_id, new.local_day, 1)
    on conflict (user_id, local_day) do update set count = event_quota.count + 1
    returning count into v_count;
    if v_count > 500 and not exists (select 1 from public.events e where e.id = new.id) then
      raise exception 'quota_exceeded' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;

-- A trigger function: no caller needs EXECUTE (the 20260925000200 revoke, restated).
revoke execute on function public.events_enforce_quota()
from public, anon, authenticated, service_role;
