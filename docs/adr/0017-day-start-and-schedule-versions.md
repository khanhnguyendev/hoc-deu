# ADR-0017: Per-user day start; schedule versions effective at the next day start

- **Status:** accepted
- **Date:** 2026-09-24
- **Spec:** platform design §5.1, §5.9

## Context

A learner's "today" is not midnight-to-midnight: someone who studies at 01:30 usually means it to
count for the previous day. The plan, gate rule and streak all key off a single `LocalDay` derived
from a UTC instant, a time zone and a **day start** — and that day start, and the time zone, can
both change over the learner's lifetime (moving, or just adjusting the schedule). A schedule
change must not rewrite history: it must not retroactively change which day a past study session
belonged to.

## Decision

- A learner's schedule is `{ timezone, dayStartsAt }`. `dayStartsAt` is restricted to
  **00:00–12:00 in 30-minute steps** (`DAY_STARTS`, 25 values) — enforced by a DB check constraint
  and by Zod; never a full 24-hour range, because a day start past noon would make "today" harder
  to reason about than it saves in flexibility.
- `localDay(now, schedule)` is the date part of (the wall-clock reading of `now` in
  `schedule.timezone`, minus `dayStartsAt`).
- Schedules are versioned: `schedule_versions` rows carry an `effectiveAt` instant.
  `scheduleAt(versions, at)` picks the latest version with `effectiveAt <= at` (default schedule —
  `Asia/Ho_Chi_Minh`, `04:00` — when none applies).
- **The first schedule (onboarding) takes effect immediately** (`effectiveAt` = the server's
  `now`): there is no past day to protect yet.
- **Every later change takes effect at the next day start of the schedule in force**
  (`nextDayStart(now, currentSchedule)`), never immediately. This is what keeps history stable: an
  event recorded five minutes before a schedule change still resolves to the same `LocalDay` it
  did when it was recorded, because the change has not taken effect yet.
- `nextDayStart` is a **forward linear scan** in 15-minute steps (never a binary search): every
  current UTC offset and every allowed day start is a multiple of 15 minutes, so the boundary
  instant always falls on that raster, but `localDay` is not monotonic across a fall-back repeated
  hour (a day start inside it is reached twice) — the earliest instant is the one that counts, and
  only a forward scan finds it correctly.
- Moving the time zone west can make one calendar date span more than 24 wall-clock hours
  (`ensurePlan` then just returns the existing plan for that date); moving east can skip a date
  entirely (the gate rule uses the last **seen** plan, not the calendar, and the streak ignores a
  single date skipped by a schedule change) — platform design §5.9, "Timezone change".
- **The database enforces the history rule too** (owner review MF3, task 2.4), because
  `apply_event` is callable directly with any `effectiveAt` and `authenticated` may update
  versions: the `schedule_versions_guard_history` trigger, for every role, rejects a version more
  than 5 minutes in the past unless it is the user's first (`schedule_backdated`), and rejects an
  update or delete of a version already in force (`schedule_in_force`) — except the
  account-deletion cascade, which runs once the profile is gone (§4.6). A pending (future) version
  may still be updated or deleted, but not moved into the past. `nextDayStart` in the server is
  the normal path; the trigger is the backstop.
- **Since task 4.12 the database also enforces the next-day-start rule** (M2 deferred finding: a
  direct `apply_event` call could start a later version at `now()` and move the learner's own local
  day back; rulings M4-R16 to M4-R19). Once `profiles.onboarded_at` is set, a version inserted by
  `authenticated` (directly or through `apply_event`) never lands before an existing pending version
  (other than the one an upsert replaces), and takes effect inside **[D − 65 minutes, D]**, where D
  is the next day start of its predecessor — the latest version with an earlier `effective_at`,
  pending ones included, else the default schedule — as Postgres reads it at `greatest(now(),
  predecessor.effective_at)`: `((local_day(that instant) + 1) + day_starts_at) at time zone
  timezone`. As for every insert that is not an exempt first version, it also takes effect no more
  than 5 minutes before the write: slack that admits onboarding's "now − 1 minute" version and its
  retries. A settings request that crosses a day start falls outside the window and gets
  `schedule_backdated`, which the settings form treats as stale (a retry targets the next day
  start). The hour below D covers a day start inside a DST gap or overlap, where Postgres reads the
  later instant and `nextDayStart` the earliest one. A sweep of every picker zone × day start around
  each 2026 offset change (task 4.12) found `nextDayStart` never after D, and more than 65 minutes
  before it only for `Antarctica/Troll` (a 2-hour shift): its settings change is rejected on the day
  before its spring-forward day (day start 02:30: 90 minutes) and before its fall-back day (day
  starts 01:00–02:30: 120 minutes), and succeeds the next day. Such a learner may change a pending
  version (time zone and day start only, by their column grant) only while no later version is
  pending. Before onboarding, a learner's version takes effect no later than 5 minutes from now; the
  first may take effect at any earlier time (the exemption is bounded by `onboarded_at`) and later
  ones no more than 5 minutes back, so a retried onboarding still completes. Every insert runs its
  checks under the per-user advisory lock the pending-version cap takes, so two concurrent first
  inserts cannot both count as the first. `service_role` and SECURITY DEFINER functions keep the
  pre-4.12 rules.
- **The schedule lock comes before any row lock** (ruling M4-R22, task 5.0b). The insert triggers
  take the per-user lock (`hashtextextended('schedule_versions:' || user_id, 0)`) before any row
  is written, but an update took it in the row-level history guard, after the row was locked: a
  learner's direct update of a pending version (a crafted PostgREST `PATCH`) racing their own
  settings save (the `apply_event` upsert: the lock first, then the conflicting row) could
  deadlock (`40P01`). A statement-level `BEFORE UPDATE` trigger (`lock_user`) now takes the same
  key for `auth.uid()` before any row is locked — Postgres also fires it for an upsert's
  `ON CONFLICT DO UPDATE`, where the lock is re-entrant — so the two queue instead. RLS lets a
  learner update only their own rows; the secret-key role (no `auth.uid()`) is unchanged.

## Consequences

- Easier: a schedule change is a pure, provable operation (`lib/domain/time/localDay.ts`,
  independent of React/Next/Supabase/the database), so it can be fixture-tested against Python
  `zoneinfo` and given a SQL parity test (task 2.5) without a running server.
- Easier: history never needs a backfill or correction pass when a learner changes time zone or
  day start.
- Harder: the UI (onboarding, settings) must show the pending effective date/time of a schedule
  change rather than applying it immediately, which needs its own copy and confirmation state.
- Accepted: a west-moving learner can see "today" span unusually long, and an east-moving learner
  can see a date skipped outright; both are treated as expected consequences of the day-start
  model, not bugs, and are called out explicitly wherever the gate rule or streak reads the
  calendar.
- Accepted (task 4.12 minor, documented in task 5.0b): on a fall-back day whose day start lies
  inside the repeated hour (New York, day start 01:30, 1 November), the wall clock passes the day
  start, falls back and reads the previous local day again until the day start repeats. A settings
  save in that window that re-sends the version already pending for tomorrow's day start (saved
  after the day start's first occurrence) is rejected (`schedule_backdated`, shown as stale): the
  database reads the local day at `now()` as the previous day, so D is today's repeated day start
  and tomorrow's lies after it. It succeeds once the day start repeats — at most an hour later,
  once a year, only for day starts inside the repeated hour — so it is self-recovering and not
  fixed (a fix would skip the window when a pending row with the same key exists).
