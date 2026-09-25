# ADR-0016: Gate rule on the last **seen** plan; stale-plan resume

- **Status:** accepted
- **Date:** 2026-09-25
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
  do — RF-4), or when any of its blocks has been checked in `done` or `partial`, at any time
  including a later day. **Closed** otherwise (nothing done, or everything skipped).
- **`resumedToday`.** When the gate is open because of a check-in on an **earlier** day's plan,
  `gateStatus` reports whether the *earliest* qualifying (`done`/`partial`) check-in landed on
  `today`. When it did, the caller (`ensurePlan`, 4.6) builds no new plan today — the resumed work
  already counts as today's study day, so `/today` keeps showing the resumed plan and the next
  plan is built on the next local day. This is the one piece of gate state that depends on
  `today`, not just on plan history, which is why it is returned as a field of `GateStatus` rather
  than folded into `open`.
- **Closed means:** no new plan, no roadmap advance, `/today` shows the last seen plan's
  unfinished blocks (`unfinishedBlocks`, plan order, `done`/`partial` dropped) with the paused
  banner, and check-ins go to that old plan. The bot cannot write a plan for this user
  (`skipped_gate_closed`).
- **Stale-plan resume ("Học tiếp hôm nay").** Offered once the gate is closed **and** the last seen
  plan is `RESUME_AFTER_DAYS` (2) local days old or older — a two-day gap does not yet warrant it,
  a three-day gap does. `plan/gate.ts` only computes the numbers (`daysSince`, `offerResume`); the
  resume plan itself is built in `plan/resume.ts` (task 4.6), which needs the budget and throttle
  rules `gate.ts` does not depend on.

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
