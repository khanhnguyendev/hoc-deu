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
