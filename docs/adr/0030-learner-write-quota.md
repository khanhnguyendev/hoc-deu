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
  serialises concurrent inserts, and a failed insert rolls its increment back with it. An event
  whose id already exists is not counted against the limit at 500: its insert fails on
  `events_pkey` and `apply_event` answers `duplicate` (task 5.0b, M2 quota #500).
- The trigger counts what the log stores: **`events_10_prepare`** fires first (row triggers fire
  in name order). For the `authenticated` role it:
  - rejects a `user_id` other than `auth.uid()` (`forbidden_user_id`, `42501`) before the quota
    trigger runs, so a learner never locks or probes another user's counter;
  - rejects non-learner types (`forbidden_event_type`, `42501`);
  - forces `source = 'learner'`, `actor_id = auth.uid()`, `occurred_at = now()` and
    `rules_version = rules_version()`.

  For every insert it computes `local_day` from the user's schedule. A learner cannot escape the
  quota by claiming another source or an arbitrary day.
- The quota caps rows, so each row is capped in size too: `payload` at 2048 bytes of
  `payload::text`, `track_id` at 32 bytes, and `item_id` and `block_id` at 128 bytes each.
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
- Accepted: the counter is keyed by the insert's `local_day`, and the database does not force a
  schedule change to wait for the next day start.
  - The app does wait (ADR-0017), but the history trigger only rejects versions more than
    5 minutes in the past. A learner who inserts a schedule version directly can make a new
    time zone and day start take effect at `now() − 5 min`.
  - The allowed schedules put the day boundary anywhere in a 37-hour window: with
    Pacific/Pago_Pago and a 12:00 day start, a local day starts 23 h after UTC midnight; with
    Pacific/Kiritimati and 00:00, 14 h before it. So by switching schedules a learner can reach
    2–3 local dates at the same instant.
  - Each date's counter still caps at 500, and only once. The worst case is a one-time burst of
    about 1000 extra events (dates borrowed from the near future); the long-run average stays
    500 a day.
- Accepted: a rejected insert that fails after the trigger (an RLS or constraint error) rolls
  back its increment, but a row that `on conflict do nothing` skips still counts. The trigger
  fires before the conflict is found, so a retry path should check the id first (task 2.5b).
- Accepted: the limit is per day, not per minute. With the size caps above, a row is at most
  about 2.5 KB (2048 bytes of payload, 288 bytes of ids, the fixed columns and the tuple header),
  so one account adds at most about 1.3 MB a day **to `events`**, plus the one-time burst above.
- The quota bounds `events` only. The state tables a learner can write directly are bounded by
  their own caps (ADR-0007, ruling R14): `user_tracks` at 16 rows per user with `throttle` and
  `weekly_template` at 2048 bytes each, and `schedule_versions` at 2 pending versions per user.
  Schedule versions already in force are not counted (ADR-0007 lists this open item).
