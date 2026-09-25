# ADR-0014: Simulation-backed SRS parameters per track; mastery

- **Status:** accepted
- **Date:** 2026-09-25
- **Spec:** platform design §5.7, §5.10, §5.11; implementation plan Part B-M4 decisions 20, 21, 32

## Context

The brief fixed the pace (DSA in about 12 weeks at 60 min/day, English at 25 min/day) but not the
spaced-repetition parameters, and the parameters interact with everything else in §5: the weekly
template, the review cap and review debt, the half-fit rule, the recap day, the throttle and the
gate. An interval that looks right for one item can still produce a backlog that eats the new-item
budget weeks later. Picking intervals by intuition, or copying a generic SRS schedule, gives no
evidence that a realistic learner finishes the roadmap or that the review queue stays small.

## Decision

- **Parameters are chosen by simulation, per track, and live in the manifest (data):**
  - DSA problems: intervals `[7, 21, 60]`, `relearnDays: 3`, `masteredAfter: 2`.
  - English cards and DSA cards (`srs.byType.flashcard`): intervals `[1, 3, 7, 14]`,
    `relearnDays: 1`, `masteredAfter: 2`.
  - **Mastery is required for both tracks:** an item at the top level that succeeds
    `masteredAfter` times leaves the review queue. Without it the English backlog keeps growing
    (§5.10: due p90 at week 18 is 81 without mastery, 18 with it).
- **The §5.10 prototype chose them.** A throwaway Python simulator
  (`docs/plans/assets/2026-09-23-plan-sim.py`) ran the §5.2–§5.7 rules day by day for 18 weeks,
  one ideal and 200 realistic learners per scenario. `[7, 21, 60]` beat `[3, 7, 21, 60]` on every
  metric (about 1.5 weeks faster, roughly half the backlog): the Saturday review and the Sunday
  recap already revisit a problem within a week, and a failed problem still comes back after 3
  days (`relearnDays`).
- **The TypeScript simulation keeps them honest.** `lib/domain/plan/simulate.ts` (task 4.8) runs
  the real engine — `gateStatus` → `buildPlan` (the plan is seen) → the learner's results as
  events folded with `project` — day by day, deterministic for a seed (`mulberry32`). The learners:
  - **ideal:** every result a success, no skipped day;
  - **realistic:** per result 80 % success, 10 % partial, 10 % fail; one random day per 7-day block
    is skipped (the plan is created and seen, nothing is done); the next study day completes the
    paused plan, which counts as that day's work (`resumedToday`, decision 32), and the day after
    gets a new plan.
  DSA runs on the **planned** content of `lib/domain/plan/sim-inputs.generated.json` (ADR-0037);
  English on a fixed synthetic model (`lib/domain/plan/__tests__/englishModel.ts`: the §5.10 card
  counts, 0.9 derived cards a day, the real English template, 25 min, `newPerDay` 8, throttle
  above 40 due → 4, above 60 → 0), so English content PRs never make it stale.
- **`pnpm test` asserts the §5.10 thresholds** (`lib/domain/plan/__tests__/simulation.dsa.test.ts`,
  `simulation.english.test.ts`): 200 realistic learners (seeds 0…199) and one ideal learner per
  scenario, 126 days from Monday 2026-09-28.
- **Calibrated once, then frozen (decision 21).** The calibration run of task 4.8 met every
  threshold, so each stays as the spec wrote it:

| Threshold (§5.10) | Observed (TypeScript engine) |
| --- | --- |
| DSA 8w @ 60 realistic: finish p90 ≤ 12.5 weeks, max ≤ 13.5 | median 10.7, p90 11.4, max 11.71 |
| DSA 10w @ 90 realistic: finish p90 ≤ 11.5 | median 9.3, p90 9.6, max 10.14 |
| DSA 10w @ 75 realistic: finish p90 ≤ 14 | median 10.8, p90 11.4, max 12.57 |
| Ideal: 8w @ 60 ≤ 8.5; 10w @ 90 ≤ 7.5 | 8.29; 7.14 |
| DSA backlog (8w @ 60, 10w @ 75, 10w @ 90): max due p90 ≤ 40 | 18; 26.1; 26.1 |
| DSA backlog (same): due p90 on day 125 ≤ 15 | 4; 5.1; 5 |
| Snapshot: DSA 10w @ 60 realistic median > 12 | 15.6 (p90 16.4, max 17.43) |
| English realistic: mean due days 56–125 ("w8–12") ≤ 25 | 20.6 |
| English realistic: max due p90 ≤ 90; due p90 on day 125 ≤ 25 | 70; 18 |
| English: every core card introduced by day 125 | 135/135 in all 201 runs |
| Every simulated day: planned ≤ budget + the largest item | 0 days over, in every run |

A threshold is changed only by a ledger ruling or an update of this ADR — never to make a red test
green.

## Consequences

- Easier: a change to the plan rules, the SRS table, the templates or the DSA roadmaps that hurts
  pacing or lets the backlog grow fails `pnpm test`, with the observed numbers in the message.
- Easier: changing a parameter is a manifest edit plus a rerun; the table the learner sees is
  regenerated from the same engine (`pnpm sim:projections`, ADR-0037).
- Harder: the simulation costs about 50 s of CPU in `pnpm test` (DSA about 11 s, English about
  40 s; the English runs spend most of it copying the item-state record once per event in
  `project`).
- **The realistic learner model matters.** The prototype's learner, on the day after a skip,
  repeated the plan it had already done the day before the skip instead of the paused one — in
  effect two days a week without new work. The TypeScript learner follows the gate rule (the paused
  plan is completed, decision 32), so its realistic medians are 0.7–2.5 weeks earlier than the
  prototype's table (§5.11), while the ideal learner agrees within 0.3 weeks (8w @ 60: 8.29 vs
  8.1). Run on this engine with the prototype's resume, 8w @ 60 would give p90 13.3 and 10w @ 90
  p90 11.6 — over their thresholds. A change to the gate or resume rules must rerun the
  calibration.
- Accepted: the simulation models the planned content, not what is published on a given day, and a
  synthetic English track; real learners differ, so the screens say "thường" (usually).
