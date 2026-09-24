# ADR-0015: DSA variant follows the budget; simulated finish shown

- **Status:** accepted
- **Date:** 2026-09-24
- **Spec:** platform design §5.10, §5.11, §2.4 (`/onboarding`, `/settings`)

## Context

The brief asked for two things about DSA at once: "10 weeks finishes within 12 weeks (realistic)"
and "60 minutes a day". The simulation (§5.10) shows they cannot both hold: a realistic learner on
the 10-week roadmap at 60 min/day finishes after about 16.5 weeks (90th percentile 17.4), while
the 8-week roadmap at 60 min/day lands near 12 (11.6, p90 12.4). A learner who picks a roadmap by
its name alone would be promised a finish date the plan cannot keep.

## Decision

- **Option A (§5.11): the default DSA variant follows the budget.** The manifest lists
  `roadmaps: [{ id: 8w, recommendedBelowMinutes: 75 }, { id: 10w }]`; `defaultVariant(roadmaps,
  budget)` picks the first roadmap whose `recommendedBelowMinutes` is above the budget, else the
  last one — `8w` below 75 min/day, `10w` at 75 or more. Learners can still pick any combination.
- **The default follows the minutes until the learner picks a variant**, then the pick sticks:
  in the onboarding wizard, changing DSA from 60 to 75 min/day moves the preselection from
  "8 tuần" to "10 tuần"; once the learner chooses one, later minute changes leave it alone.
- **Every choice shows the simulated realistic finish for the learner's actual budget**, e.g.
  "Với 60 phút/ngày, lộ trình 8 tuần thường hoàn thành sau ~12 tuần (90 %: ~12,4 tuần)" — the
  median rounded to whole weeks, the p90 with one decimal (vi-VN decimal comma). The value comes
  from `projectFinish(trackId, variant, budget)`: the §5.11 table interpolated linearly between
  budget rows and clamped at the ends. A track without a table (English) shows no finish line.
- The same `VariantPicker` (`features/tracks`) renders this in onboarding (task 2.10) and settings
  (task 2.11), so both screens always agree.
- **Until M4 the §5.11 table (182-day runs) is authoritative** (`lib/domain/plan/projections.ts`).
  In M4 the TypeScript simulation (`pnpm sim:projections`) regenerates it into
  `lib/domain/plan/projections.generated.json` with its projection inputs hash (ADR-0037); a
  stale hash fails a test.

## Consequences

- Easier: the default a learner sees is one the simulation says they can finish close to its
  name; the finish line explains *why* (DESIGN_SYSTEM §11) instead of a silent recommendation.
- Easier: one lookup table and one component serve both onboarding and settings.
- Harder: the prototype table is an estimate for a "realistic learner"; individual learners will
  differ, and the copy says "thường" (usually) rather than promising a date.
- Accepted: a learner who deliberately picks `10w` at 60 min/day sees "~17 tuần" and keeps that
  choice — the platform informs, it does not refuse.
