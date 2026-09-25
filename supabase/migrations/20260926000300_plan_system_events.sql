-- Task 4.9c: apply_system_event stores the day's plan and the auto check-in (platform design §2.3,
-- §4.3, §4.4, §5.4, §5.5; implementation plan Part B-M4 decisions 10, 12, 30, 33).
-- - plan.generated: ensurePlan, "Học tiếp hôm nay" and settings rebuilds store the plan the
--   TypeScript engine built (lib/events/plans.ts storePlan) — one plan per (user, date), and a
--   rebuild only while the plan is untouched (§2.3, decision 12).
-- - block.checked_in with auto true: the server's check-in when the last item of a block gets a
--   result (§5.5), with the same derived rows as the learner's (apply_derived_changes, 4.9b).
-- Merged migrations are never edited: apply_system_event (20260925000300) is replaced here
-- (`create or replace` keeps its owner and privileges; the grants are restated below). Every
-- function revokes EXECUTE from PUBLIC explicitly and grants exactly its callers (see
-- 20260925000100); schema-invariants (001), 041 and 072 check it.

-- ---------------------------------------------------------------------------------------------
-- apply_system_event (§4.3, §4.4): system, bot and admin events for p_user_id, from the server
-- with the secret key only. SECURITY DEFINER: it runs as its owner, so RLS and the learner bounds
-- do not apply — every check the learner path gets from them is made here.
-- 1. The type: a system type (invalid_event), implemented here (not_implemented otherwise: the
--    owning tasks are plan.extra_added 5.4, plan.ai_* 6.5, user_item.* and roadmap.override_* 6.6,
--    admin.bot_token_rotated 6.3, item.snapshot the compaction job; the admin decisions have their
--    own functions, M2). 2. The event's shape and, per type, its payload, p_changes and
--    p_expected (invalid_event) — before any lock. 3. The (user, plan_date) advisory lock for
--    plan.generated and block.checked_in (decision 33: before any row lock, as apply_event takes
--    it — the reverse order deadlocks with apply_event's key-share lock on the profile row).
-- 4. The profile row lock: active users only (inactive). 5. A duplicate event id is a no-op.
-- 6. A rebuild: version_conflict / plan_in_use, decided under the lock. 7. The plan write
--    (plan_exists when the date has a plan) and the event, in one subtransaction.
-- 8. day_changed when the caller computed its rows for another local day (decision 10).
-- 9. The state change.
-- Returns { outcome, versions } — plus plan_id for plan.generated.
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
begin
  -- 1. A system type, and one implemented here.
  if v_type is null or not v_type = any (public.system_event_types()) then
    raise exception 'invalid_event';
  end if;
  if v_type not in ('onboarding.completed', 'plan.generated', 'block.checked_in') then
    raise exception 'not_implemented';
  end if;

  -- 2. The event's shape: local_day, when present, a YYYY-MM-DD date (as apply_event). Only a
  --    check-in names a plan here: plan.generated gets the plan's id from the database, and no
  --    other type may mark a plan as touched (§2.3).
  if not coalesce(pg_catalog.pg_input_is_valid(p_event ->> 'id', 'uuid'), false)
    or not coalesce(pg_catalog.pg_input_is_valid(p_event ->> 'plan_id', 'uuid'), true)
    or not coalesce(pg_catalog.pg_input_is_valid(p_event ->> 'actor_id', 'uuid'), true)
    or not coalesce(pg_catalog.pg_input_is_valid(p_event ->> 'rules_version', 'integer'), true)
    or jsonb_typeof(v_payload) <> 'object'
    or jsonb_typeof(v_changes) <> 'array'
    or jsonb_typeof(v_expected_map) <> 'object'
    or (v_type <> 'block.checked_in' and p_event ? 'plan_id')
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

  -- 3. The plan lock first (decision 33), for the two plan types.
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

  -- 6. A rebuild is decided under the plan lock, which every plan write and plan event takes: the
  --    plan at version n (version_conflict otherwise), untouched. Decision 12: touched = a
  --    check-in, or an event naming the plan other than its generation and the bot's plan.ai_*
  --    events; such a plan stays as it is (§2.3, §5.4).
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
  elsif v_type = 'block.checked_in' then
    -- A block the plan lists (the known_block bound of learner check-ins), read under the lock.
    if not exists (
      select 1 from public.day_plans d, pg_catalog.jsonb_array_elements(d.blocks) b
      where d.id = v_plan_id and b ->> 'id' = p_event ->> 'block_id'
    ) then
      raise exception 'invalid_event';
    end if;
  end if;

  -- 7. The plan (plan.generated) and the event, in one subtransaction: a concurrent call with the
  --    same event id that commits first makes the event insert fail on events_pkey, and the
  --    plan write is rolled back with it. The day_plans check constraints bound the plan's size.
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

  -- 8. Decision 10: the caller computed its rows (the auto check-in's day) for p_event.local_day;
  --    a request that crossed the day start gets day_changed, and the caller retries.
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
      -- plan.generated: the plan was written with its event (step 7).
      return jsonb_build_object(
        'outcome', 'applied', 'plan_id', v_plan_id, 'versions', v_versions);
  end case;

  return jsonb_build_object('outcome', 'applied', 'versions', v_versions);
end $$;

-- ---------------------------------------------------------------------------------------------
-- Function privileges (controller ruling R5): unchanged — the secret key (service_role) only;
-- restated here so this migration states them. apply_derived_changes, plan_lock_key and
-- system_event_types keep theirs (this function calls them as its owner).
-- ---------------------------------------------------------------------------------------------

revoke execute on function public.apply_system_event(uuid, jsonb, jsonb, jsonb)
from public, anon, authenticated, service_role;
grant execute on function public.apply_system_event(uuid, jsonb, jsonb, jsonb) to service_role;
