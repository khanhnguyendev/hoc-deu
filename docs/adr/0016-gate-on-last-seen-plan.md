# ADR-0016: Gate rule on the last **seen** plan; stale-plan resume

- **Status:** accepted
- **Date:** 2026-09-25; amended 2026-09-26 (M5 task 5.0a: M-5 and M-6, owner rulings)
- **Spec:** platform design §5.2, §5.6, §5.8, §5.9

## Context

The roadmap must advance by **study days**, never by calendar days: a learner who opens `/today`,
does nothing and closes the tab should not silently lose a day of new items, but a learner who
never opens the app at all should not either — the two need to be distinguishable from history
alone, without a session flag.

Two further constraints shape the rule:

- The bot pre-creates AI plans (v1.1) for days the learner may never visit. If an unopened AI plan
  could close the gate, an AI user and a baseline user would behave differently for the same
  studying pattern — the plan the bot writes on their behalf would count against them.
- A learner who resumes after a gap does one thing (the stale plan's leftover work) that must
  count as **today's** work, not as evidence that a whole new plan should also be built the same
  day (decision 32) — otherwise "Học tiếp hôm nay" and the ordinary daily plan could both fire.

## Decision

- **Seen plans only.** `day_plans.seen_at` is set once, by a browser effect on `/today`
  (`markPlanSeen`, ADR-0039) — never by `ensurePlan`, which also runs for prefetches, "Học thêm"
  and settings rebuilds. The **last seen plan** is the seen plan with the latest `planDate` before
  today (`lastSeenPlan`); an unseen plan, whatever its date, is invisible to the gate. This keeps
  AI and baseline users on one rule: skipping a day never closes the gate on a plan nobody opened.
- **Open** when there is no last seen plan, when it has no blocks (an empty plan gave nothing to
  do — RF-4), when any of its blocks has been checked in `done` or `partial`, at any time
  including a later day, or when none of its blocks belongs to a track that is still active
  (M-5, below). **Closed** otherwise (nothing done, or everything skipped).
- **`resumedToday`.** When the gate is open because of a check-in on an **earlier** day's plan,
  `gateStatus` reports whether the *earliest* qualifying (`done`/`partial`) check-in landed on
  `today`. When it did, the caller (`ensurePlan`, M5 task 5.1) builds no new plan today — the resumed work
  already counts as today's study day, so `/today` keeps showing the resumed plan and the next
  plan is built on the next local day. This is the one piece of gate state that depends on
  `today`, not just on plan history, which is why it is returned as a field of `GateStatus` rather
  than folded into `open`.
- **Closed means:** no new plan, no roadmap advance, `/today` shows the last seen plan's
  unfinished blocks (`unfinishedBlocks`, plan order, `done`/`partial` dropped) with the paused
  banner, and check-ins go to that old plan. The bot cannot write a plan for this user
  (`skipped_gate_closed`).
- **Blocks of tracks no longer active never hold the gate closed (M-5 A, owner ruling
  2026-09-26).** `gateStatus` and `unfinishedBlocks` take the learner's active track IDs
  (`activeTrackIds`: the `active` enrollments, which `ensurePlan` passes — M5 task 5.1a). A `done` /
  `partial` check-in on any block still opens the gate, whatever its track; when there is none,
  only blocks of active tracks count, so a last seen plan whose blocks all belong to tracks paused
  or removed since is treated like an empty plan (open), and the paused view lists only the active
  tracks' unfinished blocks. Pausing a track to open the gate gains nothing: the roadmap moves only
  on introduced items, so the next plan holds the same unfinished items plus the due reviews, as
  "Học tiếp hôm nay" would. Without `activeTrackIds` every track counts (the M4 rule). Not a
  `RULES_VERSION` change: the gate reads history and derives no rows.
- **A skipped block resumed on a later day counts for that day (M-6 a, owner ruling
  2026-09-26).** A block counts for the local day of its first check-in (`checked_in_on`, Part B-M4
  decision 6) — except a `skipped` check-in edited to `done` / `partial` on a later local day,
  whose `checked_in_on` moves to that day (only forward, only from `skipped`; the projection and
  `apply_derived_changes` apply the same rule, `RULES_VERSION` 3). The earlier day is recomputed
  without the block, the later day with it, so the earliest qualifying check-in is today's and
  resuming through a skipped block is `resumedToday` — exactly like resuming through a block that
  was never checked in: one plan per day holds, and no day is completed after the fact. Correcting
  a skip after the day start counts for the new day; the earlier day stays incomplete. Doing every
  item of a skipped block never checks it in again by itself (the auto check-in fills only a block
  with no check-in, §5.5): the learner taps "Sửa" on it.
- **Stale-plan resume ("Học tiếp hôm nay").** Offered once the gate is closed **and** the last seen
  plan is **more than** `RESUME_AFTER_DAYS` (2) local days old (`daysSince > 2`) — a plan two days
  old does not yet warrant it, one three days old does. `plan/gate.ts` only computes the numbers
  (`daysSince`, `offerResume`); the resume plan itself is built by `buildResumePlan` in
  `plan/resume.ts` (task 4.6), which needs the budget and throttle rules `gate.ts` does not depend
  on, and `ensurePlan` (M5 task 5.1) stores and shows it.

## Consequences

- The gate reads history exactly once per check (`lastSeenPlan` + the blocks of that one plan), no
  session or request state, so the same rule runs unchanged for `ensurePlan`, the paused `/today`
  view, and the bot's `skipped_gate_closed` / `skipped_unseen` outcomes.
- An empty seen plan (a day with nothing schedulable) never closes the gate; the learner is never
  stuck behind a plan that could not have offered them anything to check in.
- `resumedToday` is the only place the gate rule reasons about "today" beyond `lastSeenPlan`'s
  `planDate < today` filter — callers must pass it through so a resume day and a fresh-plan day are
  never both triggered (decision 32); a caller that ignores it would double-build.
- The trade-off is that the gate can only reopen when a check-in event has already been recorded;
  a plan that was seen but never touched stays closed until the learner acts (by design — §5.2's
  "resuming counts as today's work" only means something once resuming has happened).
- Accepted (M4 final review, a routed 4.9c item): the untouched-plan check of a rebuild
  (`plan.generated` mode `rebuild`, decision 12 — no `plan_block_state` row and no event naming the
  plan, read under the `(user, plan_date)` lock) can miss a learner's own direct writes. An
  `events` or `plan_block_state` insert sent straight through PostgREST, outside `apply_event`,
  takes no plan lock, so it can commit between the check and the rebuild. It touches only the
  learner's own plan, and every app path (`apply_event` for events naming a plan,
  `apply_system_event`) takes the plan lock — the same class as ruling R14's direct writes.
