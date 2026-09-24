# ADR-0030: Learner write quota — `SECURITY DEFINER` insert trigger + internal `event_quota`

- **Status:** accepted
- **Date:** 2026-09-24
- **Spec:** platform design §2.3, §4.1, §4.5, §8.4

## Context

Learners write their own events. `apply_event` is `SECURITY INVOKER` (ADR-0007), so RLS applies,
and it also means a learner can insert into `events` directly with their JWT, without going
through the app. Nothing on that path limits how much a single account writes, and the database
lives on the Supabase free tier (500 MB, §8). v1.0 runs without Upstash (§0 release table):
sign-up is gated by manual approval, but an approved account, a leaked session or a buggy client
loop could still fill the log. The limit has to hold for **every** insert path, including direct
PostgREST inserts, and a learner must not be able to read or reset it.

Options considered:

- **Upstash per request** — only covers requests that pass through our server; a direct insert
  with the learner's JWT skips it. Upstash also arrives only in v1.1.
- **`count(*)` of today's events in a trigger** — cost grows with the log, and two concurrent
  inserts can both see 499.
- **A counter in `daily_activity`** — that table is learner-writable (`apply_event` upserts it),
  so a learner could reset their own counter.

## Decision

- A `BEFORE INSERT` row trigger on `events`, **`events_20_quota`**, runs the `SECURITY DEFINER`
  function `events_enforce_quota()` (`search_path = ''`). For `source = 'learner'` it upserts
  `event_quota (user_id, local_day)` with `on conflict … do update set count = count + 1
  returning count`, and raises **`quota_exceeded`** (`P0001`) when the count exceeds **500 per
  local day**. No `count(*)`: the upsert takes the row lock for that user-day, which also
  serialises concurrent inserts, and a failed insert rolls its increment back with it.
- The trigger counts what the log stores: **`events_10_prepare`** fires first (row triggers fire
  in name order) and, for the `authenticated` role, rejects non-learner types
  (`forbidden_event_type`, `42501`), forces `source = 'learner'`, `actor_id = auth.uid()` and
  `occurred_at = now()`, and computes `local_day` from the user's schedule. A learner cannot
  escape the quota by claiming another source or another day.
- **`event_quota` is internal:** RLS on, **no policies**, no grants to `anon` or
  `authenticated`. Only the definer trigger touches it. It is not backed up and not needed for
  replay; the maintenance cron (task 5.7) deletes rows older than 2 days.
- **System, bot and admin events are not counted** — they come from the server (secret key or
  a `SECURITY DEFINER` function), which has its own limits.
- `apply_event` (task 2.5b) turns `quota_exceeded` into the message "Bạn đã ghi nhận quá nhiều
  hoạt động hôm nay. Hãy thử lại vào ngày mai."
- **Upstash only from v1.1**, for what a database quota cannot cover: the bot API, the OAuth
  callback, account deletion and admin actions (§2.3).

## Consequences

- Easier: the limit holds for every insert path, including direct inserts, and costs one indexed
  upsert per learner event. It needs no external service, so it works offline in local
  development and CI (`030-events.test.sql` checks 500 inserts pass and the 501st fails).
- Harder: every learner insert takes a row lock on its user-day counter. Only inserts by the same
  user on the same day contend, which is fine at our size.
- Accepted: the counter is keyed by the insert's `local_day`, so a schedule change can start a
  new day's counter early (at most once per change, and changes take effect only at the next day
  start, ADR-0017). A rejected insert that fails after the trigger (an RLS or constraint error)
  rolls back its increment, but an insert that `on conflict do nothing` skips still counts:
  the trigger fires before the conflict is found, so a retry path should check the id first
  (task 2.5b). The limit is per day, not per minute; 500 events of at most 2 KB of payload bound
  one account to about 1 MB of payload a day.
