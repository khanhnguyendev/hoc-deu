# ADR-0018: An AI plan replaces a baseline plan only while it is untouched

- **Status:** accepted
- **Date:** 2026-09-28
- **Spec:** platform design §2.3, §2.4, §5.2, §5.4, §6.4.3, §6.8; implementation plan Part B-M6
  decisions 9–16 and 36 (tasks 6.2b, 6.5b)

## Context

From v1.1 a daily bot may write an AI-personalised plan for an AI-flagged learner
(`PUT /api/bot/v1/runs/{runId}/users/{userRef}/plan`). Plans are also created by the learner's own
first visit to `/today` (`ensurePlan`, a baseline plan), by "Học tiếp hôm nay" (a resume plan) and
rebuilt by a settings change. The forces:

- **The bot is late for some learners.** It runs once a day at 05:30 Asia/Ho_Chi_Minh (§6.8). Early
  risers in Viet Nam (the day starts at 04:00) and far-west learners (for whom 22:30 UTC is the
  afternoon) may already have opened `/today`, recorded results or checked in.
- **Work must never be lost or re-labelled.** A check-in, an item result, a skip or an extra item
  names its plan (`plan_id`, a block id). Replacing that plan would detach the learner's work or
  attach it to blocks it was never done in — block ids repeat across versions
  (`<date>:dsa:new:1`).
- **The gate reads `seen_at`** (§5.2, ADR-0016). A replacement must not make a plan the learner has
  seen look unseen, or the reverse.
- **A resume plan holds the stale items** of the paused plan (M5 decision 11); the bot does not know
  them and must not replace them.
- **Writes race.** The bot's write, the learner's first result and a settings rebuild may arrive at
  the same moment.

## Decision

- **The untouched-plan rule.** `apply_system_event('plan.ai_proposed')` (6.2b), under the same
  `(user, plan_date)` advisory lock every plan writer takes: no plan for the date → the AI plan is
  inserted (`version 1`, `source 'ai'`); an **untouched, non-resume** plan → it is replaced
  (`version + 1`, `seen_at` kept, `source 'ai'`, `rationale`, `bot_run_id`); anything else → the
  plan stays as it is and the bot's answer is `skipped_plan_in_use`. **Untouched** = no block
  check-in (`plan_block_state`) and no event naming the plan other than its own generation
  (`plan.generated`) and the bot's `plan.ai_*` events. **Non-resume** = the plan's latest
  `plan.generated` is not `mode: resume`.
- **One event per write.** The caller sends `plan.ai_proposed` with the payload exactly `{ runId }`
  under the event id `deriveEventId(<run uuid>, '<userRef>:plan')`; the database stores exactly one
  event under that id — `plan.ai_applied { runId, outcome, planVersion }` or `plan.ai_skipped
  { runId, outcome }` — naming the plan. `plan.ai_proposed` itself is never stored. A retry after a
  crash finds that event and is answered from it, before any other check.
- **Checked again at the write.** The learner's state may have changed since the run started, so
  `PUT …/plan` re-resolves the day: a closed gate (`paused`) or a resume today (`resumed`) →
  `skipped_gate_closed`; a latest plan that is an unseen AI plan → `skipped_unseen`. The AI flag
  must still be on (`ai_off`), the plan date must be the learner's local day in the database
  (`day_changed`, retryable), and nothing is written while `bot_settings.dry_run` is on.
- **The server owns the plan's shape.** Minutes come from the catalog, block ids are the server's,
  and the plan's `roadmap_weeks` are the track snapshots of the baseline build for the same context
  (decision 15), so the throttle notice, the gate and the admin's track positions read an AI plan
  exactly like a baseline one.
- **A settings rebuild makes it baseline again.** The existing `plan.generated` rebuild of an
  untouched plan replaces an AI plan too and clears `rationale` and `bot_run_id`; the bot does not
  come back that day.
- **A stale page cannot act on a plan it never showed** (decision 36). Check-ins and the results
  graded on `/today` carry the rendered plan `version`; a mismatch with the current plan is
  answered with the existing "stale" message and `/today` re-renders.
- **The learner sees it.** `/today` shows a "Cá nhân hoá bởi AI" badge (an icon and words) and the
  cleaned rationale as plain text for a plan with `source 'ai'` — also in the paused and resumed
  views when their plan is an AI plan; a baseline plan shows nothing (v1.0 unchanged).

## Consequences

- Nothing the learner did is ever moved or relabelled: a touched plan stays, and the learner keeps
  the baseline plan for the day.
- An untouched plan the learner has already opened can change under them; they see the AI plan on
  the next load, and any action from the old page is refused as stale and re-renders.
- Far-west learners rarely get AI plans: one run per Vietnamese date means their plan is usually
  in use by the time the bot writes (§6.8; ADR-0028 in M7 records it as a v1 limitation).
- The bot's `skipped_*` answers are normal outcomes, not errors; the run log counts them.
