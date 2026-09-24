-- Task 2.5b: the write paths for learner state, onboarding and admin decisions (platform design
-- §2.5, §4.3, §4.4, §4.5; ADR-0007).
-- - apply_event is SECURITY INVOKER: it runs as the learner, so RLS and the events triggers apply.
-- - apply_system_event and admin_bootstrap are SECURITY DEFINER and callable only with the secret
--   key (service_role).
-- - admin_set_status and admin_set_role are SECURITY DEFINER, callable by authenticated, and check
--   is_admin() themselves.
-- Errors are `raise exception '<code>'`, so PostgREST returns the code as `message`
-- (lib/events/apply.ts maps it). Every function revokes EXECUTE from PUBLIC explicitly and then
-- grants exactly what it needs (see 20260925000100); schema-invariants (001) and 041 check it.

-- ---------------------------------------------------------------------------------------------
-- §4.4: the types only the server writes (lib/domain/events.ts SYSTEM_EVENT_TYPES).
-- tools/db/sql-sync.test.ts compares the last definition with SYSTEM_EVENT_TYPES: change both
-- sides together.
-- ---------------------------------------------------------------------------------------------

create or replace function public.system_event_types() returns text[]
language sql immutable set search_path = '' as $$
  select array[
    'plan.generated',
    'plan.extra_added',
    'onboarding.completed',
    'plan.ai_proposed',
    'plan.ai_applied',
    'plan.ai_skipped',
    'block.checked_in',
    'user_item.created',
    'user_item.retired',
    'user_item.hidden',
    'roadmap.override_set',
    'roadmap.override_revoked',
    'roadmap.override_suspended',
    'roadmap.override_resumed',
    'admin.bot_token_rotated',
    'admin.bootstrapped',
    'admin.user_approved',
    'admin.user_rejected',
    'admin.user_suspended',
    'admin.role_changed',
    'admin.ai_flag_changed',
    'item.snapshot'
  ]::text[]
$$;

-- ---------------------------------------------------------------------------------------------
-- apply_event (§4.3, §4.5): learner events. SECURITY INVOKER, so a learner can do nothing here
-- they could not do with direct inserts and updates; the function adds the checks and applies
-- the event and its state change in one transaction — any error removes the event too.
-- M2 applies the state-table events only; p_changes / p_expected carry the derived rows from 4.9
-- (decision 8).
-- ---------------------------------------------------------------------------------------------

create function public.apply_event(
  p_event jsonb, p_changes jsonb default '[]'::jsonb, p_expected jsonb default '{}'::jsonb
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  v_uid constant uuid := auth.uid();
  v_type constant text := p_event ->> 'type';
  v_track constant text := p_event ->> 'track_id';
  v_payload constant jsonb := coalesce(p_event -> 'payload', '{}'::jsonb);
  v_id uuid;
  v_constraint text;
begin
  -- 1. Signed in, and only for themselves.
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if p_event ? 'user_id' and lower(p_event ->> 'user_id') is distinct from v_uid::text then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- 2. Derived rows arrive in 4.9.
  if coalesce(p_changes, '[]'::jsonb) <> '[]'::jsonb
    or coalesce(p_expected, '{}'::jsonb) <> '{}'::jsonb
  then
    raise exception 'not_implemented';
  end if;

  -- 3. Learner types only, and in M2 only the state-table types (track.reset: 4.9, decision 18).
  if v_type is null or not v_type = any (public.learner_event_types()) then
    raise exception 'invalid_event';
  end if;
  if v_type not in (
    'track.enrolled', 'track.updated', 'track.paused', 'track.resumed', 'track.removed',
    'schedule.changed', 'settings.changed'
  ) then
    raise exception 'not_implemented';
  end if;
  if not coalesce(pg_catalog.pg_input_is_valid(p_event ->> 'id', 'uuid'), false)
    or not coalesce(pg_catalog.pg_input_is_valid(p_event ->> 'plan_id', 'uuid'), true)
    or not coalesce(pg_catalog.pg_input_is_valid(p_event ->> 'rules_version', 'integer'), true)
    or jsonb_typeof(v_payload) <> 'object'
    or (v_type like 'track.%' and v_track is null)
  then
    raise exception 'invalid_event';
  end if;
  v_id := (p_event ->> 'id')::uuid;

  -- 4. Active users only (RLS would reject the insert anyway; this names the reason).
  if not public.is_active() then
    raise exception 'inactive' using errcode = '42501';
  end if;

  -- 5. An idempotent retry (decision 9): the caller's own event with this id — RLS hides everyone
  --    else's — is a no-op. Checked before the insert, because the quota trigger counts an insert
  --    before its primary key conflict is found.
  if exists (select 1 from public.events e where e.id = v_id) then
    return jsonb_build_object('outcome', 'duplicate', 'versions', '{}'::jsonb);
  end if;

  -- 6. The event. The insert triggers check user_id, force source, actor_id, occurred_at,
  --    rules_version and local_day, and count the quota. A concurrent retry that commits first
  --    makes this insert fail on events_pkey (rolling back its quota increment): that is a
  --    duplicate if the winner is now visible as the caller's own, else another user's id
  --    (owner review SF4).
  begin
    insert into public.events
      (id, user_id, type, track_id, item_id, plan_id, block_id, payload, rules_version)
    values (
      v_id, v_uid, v_type, v_track, p_event ->> 'item_id', (p_event ->> 'plan_id')::uuid,
      p_event ->> 'block_id', v_payload,
      coalesce((p_event ->> 'rules_version')::integer, public.rules_version())
    );
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

  -- 7. The state change.
  case v_type
    when 'track.enrolled' then
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
        status = 'active';

    when 'track.updated' then
      -- Only the keys present change; a JSON null resets a nullable setting to the track default.
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
      where t.user_id = v_uid and t.track_id = v_track;
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
  end case;

  return jsonb_build_object('outcome', 'applied', 'versions', '{}'::jsonb);
end $$;

-- ---------------------------------------------------------------------------------------------
-- apply_system_event (§4.3, §4.4): system, bot and admin events for p_user_id, from the server
-- with the secret key only. M2 implements onboarding.completed.
-- ---------------------------------------------------------------------------------------------

create function public.apply_system_event(
  p_user_id uuid, p_event jsonb, p_changes jsonb default '[]'::jsonb,
  p_expected jsonb default '{}'::jsonb
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_type constant text := p_event ->> 'type';
  v_payload constant jsonb := coalesce(p_event -> 'payload', '{}'::jsonb);
  v_id uuid;
  v_status text;
  v_owner uuid;
  v_constraint text;
begin
  if coalesce(p_changes, '[]'::jsonb) <> '[]'::jsonb
    or coalesce(p_expected, '{}'::jsonb) <> '{}'::jsonb
  then
    raise exception 'not_implemented';
  end if;
  if v_type is null or not v_type = any (public.system_event_types()) then
    raise exception 'invalid_event';
  end if;
  if v_type <> 'onboarding.completed' then
    raise exception 'not_implemented';
  end if;
  if not coalesce(pg_catalog.pg_input_is_valid(p_event ->> 'id', 'uuid'), false)
    or not coalesce(pg_catalog.pg_input_is_valid(p_event ->> 'plan_id', 'uuid'), true)
    or not coalesce(pg_catalog.pg_input_is_valid(p_event ->> 'actor_id', 'uuid'), true)
    or not coalesce(pg_catalog.pg_input_is_valid(p_event ->> 'rules_version', 'integer'), true)
    or jsonb_typeof(v_payload) <> 'object'
  then
    raise exception 'invalid_event';
  end if;
  v_id := (p_event ->> 'id')::uuid;

  -- The row lock keeps the profile active until this transaction ends (admin_set_status waits).
  select p.status into v_status from public.profiles p where p.id = p_user_id for update;
  if v_status is distinct from 'active' then
    raise exception 'inactive' using errcode = '42501';
  end if;

  -- A definer sees every event: a duplicate only if the id is this user's, else a conflict.
  select e.user_id into v_owner from public.events e where e.id = v_id;
  if found then
    if v_owner = p_user_id then
      return jsonb_build_object('outcome', 'duplicate', 'versions', '{}'::jsonb);
    end if;
    raise exception 'id_conflict';
  end if;

  begin
    insert into public.events (
      id, user_id, actor_id, source, type, track_id, item_id, plan_id, block_id, payload,
      rules_version
    ) values (
      v_id, p_user_id, coalesce((p_event ->> 'actor_id')::uuid, p_user_id),
      case when p_event ->> 'source' in ('system', 'bot', 'admin')
        then p_event ->> 'source' else 'system' end,
      v_type, p_event ->> 'track_id', p_event ->> 'item_id', (p_event ->> 'plan_id')::uuid,
      p_event ->> 'block_id', v_payload,
      coalesce((p_event ->> 'rules_version')::integer, public.rules_version())
    );
  exception when unique_violation then
    -- A concurrent call with the same id committed first.
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

  -- onboarding.completed (§4.5: users cannot write onboarded_at). Set once.
  update public.profiles p set onboarded_at = coalesce(p.onboarded_at, now())
  where p.id = p_user_id;

  return jsonb_build_object('outcome', 'applied', 'versions', '{}'::jsonb);
end $$;

-- ---------------------------------------------------------------------------------------------
-- Admin decisions (§4.3, §4.5, decision 17): only an active admin, never on themselves; each
-- writes one audit event (user_id = target, actor_id = the admin, source admin).
-- ---------------------------------------------------------------------------------------------

create function public.admin_set_status(p_user_id uuid, p_status text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_admin constant uuid := auth.uid();
  v_from text;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_user_id = v_admin then
    raise exception 'cannot_change_self';
  end if;
  select p.status into v_from from public.profiles p where p.id = p_user_id for update;
  if not found then
    raise exception 'not_found';
  end if;
  -- pending -> active | rejected, active -> suspended, suspended | rejected -> active.
  if not coalesce(
    (v_from = 'pending' and p_status in ('active', 'rejected'))
      or (v_from = 'active' and p_status = 'suspended')
      or (v_from in ('suspended', 'rejected') and p_status = 'active'),
    false
  ) then
    raise exception 'invalid_transition';
  end if;

  update public.profiles p set
    status = p_status,
    approved_by = case when p_status = 'active' then v_admin else p.approved_by end,
    approved_at = case when p_status = 'active' then now() else p.approved_at end
  where p.id = p_user_id;

  insert into public.events (id, user_id, actor_id, source, type, payload)
  values (
    gen_random_uuid(), p_user_id, v_admin, 'admin',
    case p_status
      when 'active' then 'admin.user_approved'
      when 'rejected' then 'admin.user_rejected'
      else 'admin.user_suspended'
    end,
    jsonb_build_object('targetUserId', p_user_id, 'from', v_from, 'to', p_status)
  );

  return jsonb_build_object('from', v_from, 'to', p_status);
end $$;

create function public.admin_set_role(p_user_id uuid, p_role text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_admin constant uuid := auth.uid();
  v_from text;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_user_id = v_admin then
    raise exception 'cannot_change_self';
  end if;
  select p.role into v_from from public.profiles p where p.id = p_user_id for update;
  if not found then
    raise exception 'not_found';
  end if;
  if p_role is null or p_role not in ('learner', 'admin') then
    raise exception 'invalid_transition';
  end if;
  if p_role = v_from then
    raise exception 'no_change';
  end if;

  update public.profiles p set role = p_role where p.id = p_user_id;

  insert into public.events (id, user_id, actor_id, source, type, payload)
  values (
    gen_random_uuid(), p_user_id, v_admin, 'admin', 'admin.role_changed',
    jsonb_build_object('targetUserId', p_user_id, 'from', v_from, 'to', p_role)
  );

  return jsonb_build_object('from', v_from, 'to', p_role);
end $$;

-- §2.5: the auth callback calls this with the secret key for an e-mail in ADMIN_EMAILS. It
-- promotes only a never-processed profile (decision 23, owner review MF1) and only while no
-- active admin exists (ruling R13), so an admin decision — a suspension, a demotion, a rejection —
-- is never overridden by the env list: not even after the listed account deletes itself and signs
-- up again with a fresh, never-processed profile. With no active admin left, a listed e-mail is
-- the automatic break-glass (ADR-0004). Otherwise it returns false and writes no event.
-- The transaction-scoped advisory lock serialises bootstraps: of two concurrent calls (two listed
-- e-mails, or one e-mail twice), the second waits, then sees the first one's active admin.
create function public.admin_bootstrap(p_user_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('admin_bootstrap', 0));
  if exists (select 1 from public.profiles p where p.role = 'admin' and p.status = 'active') then
    return false;
  end if;

  update public.profiles p
  set role = 'admin', status = 'active', approved_at = now()
  where p.id = p_user_id
    and p.role = 'learner' and p.status = 'pending' and p.approved_at is null;
  if not found then
    return false;
  end if;

  insert into public.events (id, user_id, actor_id, source, type, payload)
  values (
    gen_random_uuid(), p_user_id, p_user_id, 'system', 'admin.bootstrapped',
    -- The old status is always pending: the update above matches nothing else.
    jsonb_build_object('targetUserId', p_user_id, 'from', 'pending', 'to', 'active')
  );
  return true;
end $$;

-- ---------------------------------------------------------------------------------------------
-- Function privileges (controller ruling R5): PUBLIC's default EXECUTE and Supabase's default
-- grants are revoked from every function, then each gets exactly its callers.
-- system_event_types is called only by apply_system_event (as its owner): no grants.
-- ---------------------------------------------------------------------------------------------

revoke execute on function
  public.system_event_types(),
  public.apply_event(jsonb, jsonb, jsonb),
  public.apply_system_event(uuid, jsonb, jsonb, jsonb),
  public.admin_set_status(uuid, text),
  public.admin_set_role(uuid, text),
  public.admin_bootstrap(uuid)
from public, anon, authenticated, service_role;

grant execute on function
  public.apply_event(jsonb, jsonb, jsonb),
  public.admin_set_status(uuid, text),
  public.admin_set_role(uuid, text)
to authenticated;

grant execute on function
  public.apply_system_event(uuid, jsonb, jsonb, jsonb),
  public.admin_bootstrap(uuid)
to service_role;
