-- Task 4.9b: apply_event with derived changes, versions and locks (platform design §4.3, §4.4,
-- §4.5, §5.9; implementation plan Part B-M4 decisions 9, 10, 27, 33, 36).
-- - The TypeScript engine computes the derived rows (lib/events/derived.ts); apply_event stores
--   the event, its state change and those rows in one transaction, with optimistic versions: any
--   raised error removes the event and its quota increment too.
-- - Both functions are SECURITY INVOKER: a learner can do nothing here they could not do with
--   direct writes, which RLS and the derived-table bounds of 20260926000100 limit.
-- Merged migrations are never edited: apply_event is replaced here (`create or replace` keeps its
-- owner and privileges). Every function revokes EXECUTE from PUBLIC explicitly and grants exactly
-- its callers (see 20260925000100); schema-invariants (001) and 071 check it.

-- ---------------------------------------------------------------------------------------------
-- apply_derived_changes (§4.3, §4.4, decision 10): the derived rows of one event.
-- p_changes = [{ table, row }] (snake_case rows), p_expected = { "<key>": version } with one key
-- per change and nothing else: `item_state:<item_id>`, `plan_block_state:<plan_id>/<block_id>`,
-- `daily_activity:<local_day>`. Expected 0 inserts the row (version 1) and fails if it exists;
-- expected n updates it only while it is at version n. Either failure is `version_conflict`, so
-- the caller reloads, recomputes and retries (§4.4). Returns { "<key>": <new version>, … }.
-- user_id is always p_user_id, rules_version the event's; plan_block_state.checked_in_on is
-- p_local_day on insert and never changes (the day the block counts for, decision 6).
-- SECURITY INVOKER: apply_event calls it as the learner (RLS and the bounds apply),
-- apply_system_event (4.9c) as its owner. A learner calling it directly gets nothing a direct
-- write would not give them, and never another user's rows.
-- All checks come before the first write. Guards that must not evaluate an expression that could
-- raise use `case`, whose untaken branches are never evaluated (not even by constant folding).
-- ---------------------------------------------------------------------------------------------

create function public.apply_derived_changes(
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
        -- decision 8); a new row only near today (the daily_activity_window trigger). The key
        -- keeps the row's own YYYY-MM-DD text, which no DateStyle changes.
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
          -- checked_in_on and track_id never change (and have no UPDATE grant).
          update public.plan_block_state b set
            status = r.status, minutes = r.minutes, note = r.note, auto = r.auto,
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

-- ---------------------------------------------------------------------------------------------
-- apply_event (§4.3, §4.4, §4.5): learner events, the M2 function (20260925000300) extended —
-- same signature, checks, error codes and duplicate handling. Every learner type is applied:
-- 1. signed in, own user only; 2. the event's shape (invalid_event); 3. active users only;
-- 4. the (user, plan_date) advisory lock for an event naming a plan, before any row lock
--    (decision 33: the key apply_system_event takes first too, so a result, an auto check-in and
--    a plan rebuild never interleave or deadlock); 5. a duplicate id is a no-op; 6. the event, and
--    day_changed when the caller computed its rows for another local day (decision 10); 7. the
--    state-table change; 8. the derived rows (apply_derived_changes).
-- ---------------------------------------------------------------------------------------------

create or replace function public.apply_event(
  p_event jsonb, p_changes jsonb default '[]'::jsonb, p_expected jsonb default '{}'::jsonb
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  v_uid constant uuid := auth.uid();
  v_type constant text := p_event ->> 'type';
  v_track constant text := p_event ->> 'track_id';
  v_payload constant jsonb := coalesce(p_event -> 'payload', '{}'::jsonb);
  v_changes constant jsonb := coalesce(p_changes, '[]'::jsonb);
  v_expected constant jsonb := coalesce(p_expected, '{}'::jsonb);
  v_id uuid;
  v_plan_date date;
  v_local_day date;
  v_rules integer;
  v_paused_days integer;
  v_constraint text;
begin
  -- 1. Signed in, and only for themselves.
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if p_event ? 'user_id' and lower(p_event ->> 'user_id') is distinct from v_uid::text then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- 2. Learner types only, with the keys their type needs; p_changes an array of at most 16
  --    changes, p_expected an object; local_day, when present, a YYYY-MM-DD date.
  if v_type is null or not v_type = any (public.learner_event_types()) then
    raise exception 'invalid_event';
  end if;
  if not coalesce(pg_catalog.pg_input_is_valid(p_event ->> 'id', 'uuid'), false)
    or not coalesce(pg_catalog.pg_input_is_valid(p_event ->> 'plan_id', 'uuid'), true)
    or not coalesce(pg_catalog.pg_input_is_valid(p_event ->> 'rules_version', 'integer'), true)
    or jsonb_typeof(v_payload) <> 'object'
    or (v_type like 'track.%' and v_track is null)
    or (v_type in (
          'item.result', 'lesson.completed', 'exercise.submitted', 'prompt.completed',
          'item.skipped', 'item.readded'
        ) and p_event ->> 'item_id' is null)
    or (v_type = 'block.checked_in' and (
          p_event ->> 'plan_id' is null or p_event ->> 'block_id' is null or v_track is null))
    or jsonb_typeof(v_changes) <> 'array'
    or jsonb_typeof(v_expected) <> 'object'
    or (p_event ? 'local_day' and not (case when jsonb_typeof(p_event -> 'local_day') = 'string'
          then (p_event ->> 'local_day') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
            and coalesce(pg_catalog.pg_input_is_valid(p_event ->> 'local_day', 'date'), false)
          else false end))
  then
    raise exception 'invalid_event';
  end if;
  if jsonb_array_length(v_changes) > 16 then
    raise exception 'invalid_event';
  end if;
  -- Decision 36: pausedDays is a JSON integer 0–3650, checked before any integer cast (a huge
  -- number would otherwise raise out of range instead of invalid_event).
  if v_type = 'track.resumed' then
    if not (case when jsonb_typeof(v_payload -> 'pausedDays') = 'number'
      then (v_payload -> 'pausedDays')::numeric between 0 and 3650
        and (v_payload -> 'pausedDays')::numeric = trunc((v_payload -> 'pausedDays')::numeric)
      else false end)
    then
      raise exception 'invalid_event';
    end if;
    -- jsonb → integer, so a JSON integer written with a fraction (5.0) is 5, not a text error.
    v_paused_days := (v_payload -> 'pausedDays')::integer;
  end if;
  v_id := (p_event ->> 'id')::uuid;

  -- 3. Active users only (RLS would reject the insert anyway; this names the reason).
  if not public.is_active() then
    raise exception 'inactive' using errcode = '42501';
  end if;

  -- 4. The plan lock (§4.4, decision 33): the caller's own plan only (RLS hides everyone else's),
  --    then the (user, plan_date) advisory lock — before the event insert takes its key-share
  --    lock on the profile row, and before any derived row is locked.
  if p_event ->> 'plan_id' is not null then
    select d.plan_date into v_plan_date
    from public.day_plans d
    where d.id = (p_event ->> 'plan_id')::uuid and d.user_id = v_uid;
    if not found then
      raise exception 'invalid_event';
    end if;
    perform pg_catalog.pg_advisory_xact_lock(public.plan_lock_key(v_uid, v_plan_date));
  end if;

  -- 5. An idempotent retry (decision 9): the caller's own event with this id — RLS hides everyone
  --    else's — is a no-op, whatever p_changes says. Checked before the insert, because the quota
  --    trigger counts an insert before its primary key conflict is found.
  if exists (select 1 from public.events e where e.id = v_id) then
    return jsonb_build_object('outcome', 'duplicate', 'versions', '{}'::jsonb);
  end if;

  -- 6. The event. The insert triggers check user_id and plan_id, force source, actor_id,
  --    occurred_at and rules_version, compute local_day, and count the quota. A concurrent retry
  --    that commits first makes this insert fail on events_pkey (rolling back its quota
  --    increment): that is a duplicate if the winner is now visible as the caller's own, else
  --    another user's id (owner review SF4).
  begin
    insert into public.events
      (id, user_id, type, track_id, item_id, plan_id, block_id, payload, rules_version)
    values (
      v_id, v_uid, v_type, v_track, p_event ->> 'item_id', (p_event ->> 'plan_id')::uuid,
      p_event ->> 'block_id', v_payload,
      coalesce((p_event ->> 'rules_version')::integer, public.rules_version())
    )
    returning local_day, rules_version into v_local_day, v_rules;
  exception when unique_violation then
    get stacked diagnostics v_constraint = constraint_name;
    if v_constraint is distinct from 'events_pkey' then
      raise;
    end if;
    if exists (select 1 from public.events e where e.id = v_id) then
      return jsonb_build_object('outcome', 'duplicate', 'versions', '{}'::jsonb);
    end if;
    raise exception 'id_conflict';
  end;

  -- Decision 10: the caller computed its derived rows (an SRS due date) for p_event.local_day; a
  -- request that crossed the day start gets day_changed, and the caller recomputes and retries.
  if p_event ? 'local_day' and (p_event ->> 'local_day')::date <> v_local_day then
    raise exception 'day_changed';
  end if;

  -- 7. The state change.
  case v_type
    when 'track.enrolled' then
      -- Re-enrolling (a removed track) starts from the track defaults (decision 27).
      insert into public.user_tracks
        (user_id, track_id, roadmap_variant, budget_minutes, start_date, status)
      values (
        v_uid, v_track, v_payload ->> 'roadmapVariant', (v_payload ->> 'budgetMinutes')::integer,
        (v_payload ->> 'startDate')::date, 'active'
      )
      on conflict (user_id, track_id) do update set
        roadmap_variant = excluded.roadmap_variant,
        budget_minutes = excluded.budget_minutes,
        start_date = excluded.start_date,
        status = 'active',
        new_per_day = null,
        throttle = null,
        weekly_template = null,
        include_bonus = false;

    when 'track.updated' then
      -- Only the keys present change; a JSON null resets a nullable setting to the track default.
      -- A removed track is not enrolled (decision 27).
      update public.user_tracks t set
        budget_minutes = case when v_payload ? 'budgetMinutes'
          then (v_payload ->> 'budgetMinutes')::integer else t.budget_minutes end,
        roadmap_variant = case when v_payload ? 'roadmapVariant'
          then v_payload ->> 'roadmapVariant' else t.roadmap_variant end,
        new_per_day = case when v_payload ? 'newPerDay'
          then (v_payload ->> 'newPerDay')::integer else t.new_per_day end,
        throttle = case when v_payload ? 'throttle'
          then nullif(v_payload -> 'throttle', 'null'::jsonb) else t.throttle end,
        weekly_template = case when v_payload ? 'weeklyTemplate'
          then nullif(v_payload -> 'weeklyTemplate', 'null'::jsonb) else t.weekly_template end,
        include_bonus = case when v_payload ? 'includeBonus'
          then (v_payload ->> 'includeBonus')::boolean else t.include_bonus end
      where t.user_id = v_uid and t.track_id = v_track and t.status <> 'removed';
      if not found then
        raise exception 'track_not_enrolled';
      end if;

    when 'track.paused', 'track.resumed', 'track.removed' then
      -- active -> paused, paused -> active, active | paused -> removed. One conditional update,
      -- so concurrent transitions cannot both pass the check.
      update public.user_tracks t
      set status = case v_type
        when 'track.paused' then 'paused' when 'track.resumed' then 'active' else 'removed' end
      where t.user_id = v_uid and t.track_id = v_track
        and t.status = any (case v_type
          when 'track.paused' then array['active']
          when 'track.resumed' then array['paused']
          else array['active', 'paused'] end);
      if not found then
        if exists (
          select 1 from public.user_tracks t where t.user_id = v_uid and t.track_id = v_track
        ) then
          raise exception 'invalid_transition';
        end if;
        raise exception 'track_not_enrolled';
      end if;
      -- §5.9, decision 9: resuming shifts the track's due dates by the pause, so it does not
      -- create an instant backlog (set-based; project() mirrors it).
      if v_type = 'track.resumed' then
        update public.item_state s
        set due_on = s.due_on + v_paused_days, version = s.version + 1
        where s.user_id = v_uid and s.track_id = v_track and s.due_on is not null;
      end if;

    when 'track.reset' then
      -- §5.9, decision 9: "Bắt đầu lại" clears the track's item states and records the day;
      -- events, plans, check-ins and daily activity stay. An active or paused track only.
      update public.user_tracks t set reset_on = v_local_day
      where t.user_id = v_uid and t.track_id = v_track and t.status in ('active', 'paused');
      if not found then
        if exists (
          select 1 from public.user_tracks t where t.user_id = v_uid and t.track_id = v_track
        ) then
          raise exception 'invalid_transition';
        end if;
        raise exception 'track_not_enrolled';
      end if;
      delete from public.item_state s where s.user_id = v_uid and s.track_id = v_track;

    when 'schedule.changed' then
      -- The whole desired schedule is always sent, so a second change before the day start
      -- replaces the first. The schedule_versions triggers reject unknown zones and rewriting
      -- history (invalid_timezone, schedule_backdated, schedule_in_force).
      insert into public.schedule_versions (user_id, effective_at, timezone, day_starts_at)
      values (
        v_uid, (v_payload ->> 'effectiveAt')::timestamptz, v_payload ->> 'timezone',
        (v_payload ->> 'dayStartsAt')::time
      )
      on conflict (user_id, effective_at) do update set
        timezone = excluded.timezone,
        day_starts_at = excluded.day_starts_at;

    when 'settings.changed' then
      -- theme stays client-side (decision 7); share_notes_with_ai is guarded by a profiles
      -- trigger (ai_personalization_off).
      if v_payload ?| array['codeLanguage', 'shareNotesWithAi'] then
        update public.profiles p set
          code_language = case when v_payload ? 'codeLanguage'
            then v_payload ->> 'codeLanguage' else p.code_language end,
          share_notes_with_ai = case when v_payload ? 'shareNotesWithAi'
            then (v_payload ->> 'shareNotesWithAi')::boolean else p.share_notes_with_ai end
        where p.id = v_uid;
      end if;

    else
      -- Results, completions, skips, re-adds and check-ins change only derived rows.
      null;
  end case;

  -- 8. The derived rows, with the event's stored rules_version and local day.
  return jsonb_build_object(
    'outcome', 'applied',
    'versions', public.apply_derived_changes(
      v_uid, p_event || jsonb_build_object('rules_version', v_rules), v_local_day, v_changes,
      v_expected
    )
  );
end $$;

-- ---------------------------------------------------------------------------------------------
-- Function privileges (controller ruling R5). apply_event keeps its 20260925000300 grants
-- (restated here); apply_derived_changes: the invoker apply_event calls it as the learner, and
-- the server (service_role) may call it too. apply_system_event calls it as its owner.
-- ---------------------------------------------------------------------------------------------

revoke execute on function
  public.apply_derived_changes(uuid, jsonb, date, jsonb, jsonb),
  public.apply_event(jsonb, jsonb, jsonb)
from public, anon, authenticated, service_role;

grant execute on function public.apply_derived_changes(uuid, jsonb, date, jsonb, jsonb)
to authenticated, service_role;
grant execute on function public.apply_event(jsonb, jsonb, jsonb) to authenticated;
