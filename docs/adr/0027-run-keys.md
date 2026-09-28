# ADR-0027: Run keys by the Asia/Ho_Chi_Minh date; one resumable plan run per date, numbered publish runs

- **Status:** accepted
- **Date:** 2026-09-28
- **Spec:** platform design §2.3, §2.4, §4.2, §6.2, §6.3, §6.4, §6.4.1, §6.4.6, §6.11;
  implementation plan Part B-M6 decisions 6, 8–12, 21, 38 and 41 (task 6.4a)

## Context

The daily bot works in runs: `POST /api/bot/v1/runs` starts one, the bot then reads contexts and
writes plans, custom items and overrides for the run's users, and `PATCH /runs/{runId}` finishes
it. The forces:

- **Triggers repeat.** The Routine's `/fire` trigger has no idempotency key, the fallback runner
  (§6.9) may start while the Routine is still working, and either may crash and be restarted. Two
  runs on one day would write two plans for a learner, or race each other.
- **A "day" must be the learners' day.** Most learners live in Viet Nam; a UTC date turns at 07:00
  there, in the middle of the morning.
- **The bot must never escalate.** Dry-run (`bot_settings.dry_run`) is on until the M7 acceptance
  week; the bot may ask for dry-run, never for live, and an admin may turn dry-run on in the middle
  of a run.
- **Publishing is separate work.** Admin publish requests (§6.6) must be processed even when
  today's plan run has already completed, and more than once a day ("Chạy ngay", M7).
- **Cost and time are bounded.** Every pending user costs model time; a run must stop at a cap
  and say how many users it left out.
- **A run can die silently.** A crashed runner never finishes its run; the run log must not show it
  as running forever.
- **Pseudonymity.** The bot addresses learners, but must not learn who they are (§6.3).

## Decision

- **Run keys by the Asia/Ho_Chi_Minh date** (`OPS_TIMEZONE`, `lib/bot/ops-day.ts`, `Intl` only):
  the plan run is `run_<YYYY-MM-DD>`, unique per date across modes (`bot_runs.run_key` is unique).
  The API's `runId` is the key; `bot_runs.id` is a UUID that stays server-side and namespaces the
  run's event ids (`deriveEventId(<run uuid>, …)`) and refs.
- **One plan run per date, resumable.** Start first reads `run_<date>`; when it exists, the run is
  resumed. Otherwise the eligible users are walked **read-only**, under a run UUID chosen by the
  server (the refs need it), and only then is the run inserted — with its id, mode and counts —
  followed by all its users in one insert (ruling M6-R23b; no schema change). A unique violation
  on the run key means another start inserted first: this walk is discarded and that run resumed.
  So a run row never exists before its walk is done, and a start during another start's walk
  never sees an empty run. Starting again the same day returns the same run and its still-pending
  users (`outcome is null`, in ref order). A `running` or `failed` run goes back to `running`
  (`failure_reason` and `finished_at` cleared, `started_at` set to now — M6-R23a); a `completed`
  one answers `users: []`. A resume adds no users, with one exception: a run that counted eligible
  users (`users_eligible > 0`) but has no user rows — a crash between the run's insert and its
  users' — walks again under its own id and inserts them (`unique (run_id, user_id)` with `on
  conflict do nothing`, so concurrent repairs are safe). Nothing ever deletes a run row: another
  caller may already have resumed it.
- **The stricter mode wins.** At start the mode is `live` only when `bot_settings.dry_run` is off
  **and** the request did not ask for `dry_run`. A resume, and every later write (through
  `resolveRunUser`), takes the strictest of the stored mode, the requested mode and the **current**
  `bot_settings.dry_run`; when that makes a live run dry, the run row becomes `dry_run` and stays
  so. Nothing makes a dry run live again.
- **Numbered publish runs**, `run_<date>_publish-<n>`, n = 1 + the date's publish runs (a unique
  violation — a concurrent start took n — is retried once). They may run any time, also after the
  day's plan run completed, and touch no learner data: they return the pending publish requests
  that are in no PR yet (`pr_url is null`). Finishing one with `contentPrUrl` and
  `publishRequestIds` sets `pr_url` on the listed requests that are still pending
  (`publish_set_pr`); the other ids are answered back in `details`.
- **Eligibility and the pre-filter.** The eligible users are AI-flagged, `active` and onboarded,
  least recently processed first (`bot_eligible_users()`; never processed first). Each user's day
  is resolved as the learner's page would resolve it (`lib/plans/day.ts`, the secret-key client):
  `paused` and `resumed` (resuming is today's work) are recorded `skipped_gate_closed`, `noTracks`
  and `notStarted` get no row, a latest plan (on or before today) that is an unseen AI plan is
  `skipped_unseen`; `today` and `open` become pending. A user whose day cannot be read is recorded
  `error`.
- **The per-run cap and `deferredUsers`.** The walk stops once `per_run_user_cap` users are pending
  (skipped users do not count); the eligible users never examined are deferred. `users_eligible`
  and `users_deferred` are stored on the run; `/admin` and `/admin/bot` warn "N người dùng AI không
  được xử lý hôm nay — tăng giới hạn hoặc giảm số người dùng AI." while today's plan run has
  deferred users.
- **The lazy 2-hour timeout.** A run still `running` two hours after `started_at` is `failed` with
  reason `timeout` (`bot_timeout_runs()`). A resume sets `started_at` to the resume's time, so the
  two hours count from the last start or resume (M6-R23a) and a resumed run is not failed again by
  the next sweep. The timeout is applied whenever runs are read: on every run start, on
  `/admin/bot`'s render (`admin_bot_runs`) and in the daily maintenance cron (step `botRuns`; step
  `botDetails` drops the `detail` of runs older than 30 days). A run the bot finishes as `failed`
  records the reason `reported`.
- **Pseudonymous refs.** A user's ref in a run is `u_` + the first 16 lowercase base32 characters
  of HMAC-SHA256(`BOT_REF_SECRET`, `<user id>:<run uuid>`), stored in `bot_run_users.user_ref` at
  start. `resolveRunUser(runId, userRef)` is the only way the bot side learns a user id: null for an
  unknown run, a run that is not running or not a plan run, or a ref that is not in it.
- **Idempotent writes.** Every write carries `Idempotency-Key: <runId>:<userRef>:<kind>`; the
  answer is stored in `bot_run_users.writes[kind]` with the SHA-256 of the body's canonical JSON
  (keys sorted). The same body replays the stored answer, another body is `409
  idempotency_conflict`; an `invalid` answer never binds the key (a corrected body is accepted, the
  fourth invalid attempt is `409 too_many_attempts`). Bodies over 64 KB are `413 too_large` before
  parsing.
- **The run summary holds counts only.** `admin_bot_runs` shows `bot_runs.summary` to admins, so
  the contract (`runSummarySchema`) refuses a summary with a user ref, an `@`, a URL, markup or a
  control character; the bot writes counts ("10 users: 7 plans, 4 custom-item sets, 2 overrides; PR
  #41"), never learner data.

## Consequences

- Retries and a second runner are safe: the date key makes them the same run (the loser of the
  insert resumes the winner's run, walking again only to repair a run without users), and the
  stored write answers make repeated requests replays. Two starts racing may each walk once;
  only one walk is kept.
- Far-west learners (Americas) rarely get an AI plan: one run per Vietnamese date means their day
  may not have started, or may already be half over, when the run happens (§6.11). Accepted for v1.
- A dry-run request or an admin's switch can only make a run stricter; turning dry-run off takes
  effect with the next day's run.
- A crashed run shows as running for up to two hours, then as failed / timeout; its pending users
  are picked up by a resume the same day, or deferred to the next day's run (least recently
  processed first).
- The cap bounds a run's cost; the deferred-users warning tells the owner when the AI audience
  outgrows it.
- `bot_run_users.writes` and `detail` grow with the audience; M7's dry-run week measures them
  (decision 41).
