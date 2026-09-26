# ADR-0007: Event log + derived state; pure TypeScript domain + `apply_event` RPC (`SECURITY INVOKER`)

- **Status:** accepted
- **Date:** 2026-09-24
- **Spec:** platform design §4.1, §4.3, §4.4, §4.5, §5.13

## Context

Học Đều's learning state — spaced-repetition levels, plan check-ins, streaks, roadmap position —
comes from rules that will change (`rules_version`, ADR-0008) and that must be testable without a
database. Learners write often and sometimes twice (double submits, retries after a timeout), and
the free-tier Supabase project has no room for a server-side worker. Every write path is also a
security boundary: a learner must never write another user's rows, an admin decision must never
be overridden, and the secret key must be the only way to write system events.

Options considered:

- **Mutable state only** (update `item_state` in place) — simple, but a rules change or a bug
  cannot be replayed, and nothing records why a row has its value.
- **Rules in SQL** (`plpgsql` computing levels and plans) — atomic, but the engine becomes hard to
  unit-test, cannot share code with the plan preview, and ties the domain to Postgres.
- **A `SECURITY DEFINER` write function** — one trusted path, but a bug in it writes any user's
  rows, and every check RLS already does has to be repeated by hand.

## Decision

- **The event log is the source of truth.** `events` is append-only (a trigger rejects updates;
  rows go only with the account, and later the compaction job — §4.7). State tables
  (`profiles`, `schedule_versions`, `user_tracks`) and derived tables (`item_state`,
  `plan_block_state`, `daily_activity`, from 4.9) are projections that replay can rebuild.
  Payloads are Zod-validated per type (`lib/domain/events.ts`, ADR-0030 for the size limit).
- **The learner-writable state tables are bounded by the database itself** (ruling R14), because
  a learner can write them directly (see Consequences) and the write quota counts only `events`:
  `user_tracks` holds at most **16 rows per user** (`too_many_tracks`), and its `throttle` and
  `weekly_template` at most **2048 bytes** each (`throttle_size`, `weekly_template_size`);
  `schedule_versions` holds at most **2 pending versions** (`effective_at > now()`) per user
  (`too_many_pending_schedules`). The row an upsert would update is not counted, so re-enrolling a
  track or replacing a pending schedule change always works; a per-user advisory lock makes the
  counts hold under concurrency. `lib/events/apply.ts` maps both codes to Vietnamese messages.
- **The derived tables are bounded like the state tables** (implementation plan Part B-M4
  decision 11, task 4.9a): for `authenticated` writes, `item_state` holds at most 5000 rows per
  user (`too_many_items`), a new `daily_activity` row must be within one day of the user's local
  day (`invalid_local_day`) and a `plan_block_state` row must name a block of the user's own plan
  (`unknown_block`); `UPDATE` is granted per column, never on a key column. Since task 5.0b
  `plan_block_state.checked_in_on` is granted too, because the invoker `apply_event` moves it for
  owner ruling M-6 (below); the `check_in_day` trigger lets an `authenticated` write change it only
  from `skipped` to `done` / `partial`, only forward and only to the learner's local day now
  (`invalid_event`), and lets an unchanged value pass (`apply_derived_changes` always names the
  column).
- **The domain is pure TypeScript** (`lib/domain`: no React, Next, Supabase, date library or
  clock reads). The server loads state, computes the new derived rows in TypeScript and sends
  them with the event.
- **`apply_event(p_event, p_changes, p_expected)` is `SECURITY INVOKER`.** It runs as the
  learner, so RLS and the `events` triggers (own `user_id` only, learner types only, forced
  `source`/`actor_id`/`occurred_at`/`local_day`, the write quota) apply exactly as for a direct
  insert: the function adds checks, never privileges. It inserts the event and applies its
  change in one transaction, so any error removes the event too. `p_expected` carries the
  `version` of each derived row it updates; a mismatch aborts and the server action retries.
- **Event ids are derived per request, which makes retries idempotent** (decision 9). The server
  page creates a `requestId` per render; the server derives each event id as
  UUIDv5(`requestId`, a stable key) (`lib/events/ids.ts`). `apply_event` returns
  `duplicate` without any change when the caller's own event with that id exists — checked
  before the insert, because the quota trigger counts an insert before its key conflict is found.
  An id already used by another user's event raises `id_conflict` (owner review SF4).
- **Server-only writes go through `SECURITY DEFINER` functions with explicit grants:**
  `apply_system_event` (system, bot and admin events; `service_role` only), `admin_bootstrap`
  (`service_role` only; promotes only a never-processed profile, decision 23) and
  `admin_set_status` / `admin_set_role` (`authenticated`, checking `is_admin()` and never the
  acting admin, decision 17). Each writes one audit event with `actor_id`. Every function revokes
  `EXECUTE` from `PUBLIC` explicitly and grants exactly its callers; the schema-invariants test
  and `041-system-and-admin` check the grants.
- **Errors are codes.** Functions raise `'<code>'` (PostgREST returns it as `message`);
  `lib/events/apply.ts` validates payloads before calling, maps the code to an `EventError` with
  a Vietnamese `userMessage`, and maps anything unknown to `unknown`.
- **M2 applies state-table events only** (decision 8): `track.enrolled`, `updated`, `paused`,
  `resumed`, `removed`, `schedule.changed`, `settings.changed`, and `onboarding.completed` through
  `apply_system_event`. Every other type raises `not_implemented`, and `p_changes` / `p_expected`
  must be empty until task 4.9 adds the derived tables and `track.reset`.

## Consequences

- Easier: engine rules are plain functions with unit tests; a rules change can be replayed from
  the log; retries and double submits are harmless; the audit trail for admin actions is free.
- Easier: a bug in `apply_event` cannot touch another user's data — RLS still applies.
- Harder: every write needs a Zod schema, a stable event id and a matching branch in
  `apply_event`; the derived rows sent in `p_changes` are only as honest as the learner's own
  client (see below).
- Accepted: because `apply_event` runs as the learner, a learner could write their own rows
  directly with their JWT. That only affects their own self-reported data, and the drift check
  (§4.7) catches it. What bounds it:
  - the write quota (ADR-0030) bounds **only `events`** — 500 learner events per local day;
  - the state-table caps above bound `user_tracks` (16 rows of at most about 4 KB of JSON each)
    and the **pending** `schedule_versions`;
  - they do **not** bound versions already in force: the history guard lets a later version be
    effective up to 5 minutes in the past, and nothing counts those, so a learner who inserts
    rows directly can grow their own schedule history (tens of bytes a row) at the rate they can
    send requests. Recorded as an open item of the M2 final review (ruling R14 follow-up).
- **Rule for M4 readers** (the plan generator, §5): never trust a state-table value because the
  app wrote it — a learner may have written it directly. Check `user_tracks.track_id` against the
  content catalog (skip a track that is not in it), and Zod-validate `throttle` and
  `weekly_template` before use, falling back to the track's defaults when either is missing or
  invalid. `schedule_versions` needs no such check: its columns are checked by the database.
- Accepted: `id_conflict` tells a caller that some other event uses a given id. Ids are random
  UUIDs, so this reveals nothing useful.

## Loading derived state

Added after the M4 final review (finding I-1), for M5's write actions. The server computes an
event's derived rows from a `before` state it loads; `apply_event` checks each row's version but
cannot know whether `before` held every row the event reads. So a caller loads exactly these rows,
builds `before` and the versions with `derivedStateFromRows`, and then calls `project` →
`derivedWrite` (`lib/events/derived.ts`):

| Event type | Rows to load |
| --- | --- |
| `item.result`, `lesson.completed`, `exercise.submitted`, `prompt.completed` | the item's `item_state` row; the `daily_activity` row of the event's local day |
| `item.skipped`, `item.readded` | the item's `item_state` row |
| `block.checked_in` (learner or auto) | the block's `plan_block_state` row; **every** `plan_block_state` row of the user whose `checked_in_on` is the day the block counts for (its existing `checked_in_on`, else the event's local day), of every plan; that day's `daily_activity` row — and when the edit moves the block to the event's local day (M-6, below), the same rows of **both** days |

- A missing row that exists in the database fails loudly: it is sent as new (expected 0) and
  raises `version_conflict`.
- A missing **block** of the day does not. `project` recomputes the day's `minutes_by_track` and
  `completed` from the blocks it was given, and the day row's version matches, so the database
  stores a day rebuilt from a partial set: a `done` block of yesterday's paused plan plus a
  `skipped` block of today's "Học tiếp" plan becomes `completed: false`, and the streak breaks.
  `lib/events/derived.test.ts` shows both paths.
- An edited old check-in keeps counting for its first day (decision 6), so it loads and updates
  that older day's row. `plan_block_state_user_day_idx` serves the per-day query.
- **One exception since `RULES_VERSION` 3** (owner ruling M-6 (a), task 5.0b): a block checked in
  `skipped` and corrected to `done` / `partial` on a later local day counts for that later day.
  `apply_derived_changes` moves its `checked_in_on` to the event's local day itself (the row's own
  value is ignored, as before), and `project` does the same. So for such an edit the loader
  (task 5.2a) reads both days — the old day's block states and `daily_activity` row, which is
  recomputed without the block and stays incomplete, and the event's day's, which gains it — and
  sends both day rows. Any other edit (another status change, new minutes, a skip kept) keeps the
  first day.
- M5 (task 5.2) owns one loader for this (for example `loadDerivedFor(event)` in `lib/events`),
  tested with two plans checked in on the same day.
