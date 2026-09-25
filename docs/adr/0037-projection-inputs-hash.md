# ADR-0037: Projection table keyed by a projection inputs hash; bots cannot edit manifests or roadmaps

- **Status:** accepted
- **Date:** 2026-09-25
- **Spec:** platform design §5.10, §5.11, §6.6, §7.9; implementation plan Part B-M4 decision 20

## Context

Onboarding and settings show the simulated realistic finish for the learner's budget and DSA
variant (ADR-0015). The numbers come from 2,000 simulated learners (two variants × five budgets ×
200 runs of 182 days) — far too slow to compute per request, and too slow to recompute in every
test run. So the table is generated once and committed, and something must say when it no longer
matches the content and the rules it was computed from.

Content changes often: from v1.1 a bot opens content PRs every day (lessons, notes, prompts, cards).
If any of those made the committed table stale, every bot PR would fail CI or need a slow
regeneration — so the table must depend only on what bots cannot change.

## Decision

- **`pnpm sim:projections` generates two committed files** (`tools/sim/cli.ts`):
  - `lib/domain/plan/projections.generated.json` = `{ inputsHash, rulesVersion, runs: 200,
    days: 182, table: { dsa: { '8w': [[budget, median, p90], …], '10w': […] } } }` — for budgets
    45, 60, 75, 90 and 120 min/day, realistic learners (seeds 0…199) of the TypeScript simulation
    (`lib/domain/plan/simulate.ts`, ADR-0014), weeks = (finish day + 1) / 7;
  - `lib/domain/plan/sim-inputs.generated.json` — the inputs themselves, which the DSA simulation
    test reads (`lib/domain` never reads the catalog).
  `lib/domain/plan/projections.ts` reads the table (validated when it loads) and interpolates it
  (`projectFinish`); English has no table.
- **The inputs are only what bots cannot edit** (`tools/sim/inputs.ts`, `SimInputs`):
  `RULES_VERSION`; the DSA manifest's `srs` (resolved for problems), `estimates.lesson`,
  `estimates.problem.new`, `review`, `weeklyTemplate` and `defaults`; every DSA roadmap file; and
  the `difficulty` and `topic` of every problem a roadmap lists (`problem.yaml`). The v1.1
  `bot-content-policy` check forbids bot edits to any `track.yaml`, `roadmaps/**` and
  `problem.yaml`, and a track or item status flip changes none of these fields.
- **The simulation runs the planned content, not the published content** (`simCatalog`): one
  active pattern lesson per topic a roadmap week lists, every listed problem active, and one
  repeatable prompt per practice `tag` of the weekly template, with that block's minutes. Prompt
  files are deliberately **not** inputs — the simulation derives its prompts from the template's
  practice blocks — and neither are lessons, notes, cards or statuses, so publishing content never
  changes the table and content-only PRs stay green.
- **The projection inputs hash** is the sha256 hex digest of the inputs as JSON with every object's
  keys sorted recursively (`inputsHash`), so it is independent of key order and changes with any
  value, `RULES_VERSION` included.
- **A stale table fails `pnpm test`** (`tools/sim/projections.test.ts`, on the generated catalog):
  the committed `inputsHash` must equal the hash of the current inputs, `rulesVersion` must equal
  `RULES_VERSION`, and `sim-inputs.generated.json` must deep-equal the current inputs — each
  failing with "run pnpm sim:projections". An owner PR that changes a DSA roadmap, a difficulty or
  the hashed manifest fields regenerates both files in the same PR; so does the commit that bumps
  `RULES_VERSION`.
- **No invented finish.** A run that does not finish within 182 days is rerun for 364 days; one
  that still does not finish makes the command exit non-zero without writing anything, so the UI
  never shows "~99 tuần".

## Consequences

- Easier: the finish a learner sees is always the current engine's, for the current roadmaps and
  parameters; a forgotten regeneration is a red test, not a silently wrong promise.
- Easier: the v1.1 bot's daily content PRs never touch the hashed inputs, so they never need the
  simulation.
- Harder: a change to a DSA roadmap, a difficulty or the manifest's srs / review / estimates /
  weeklyTemplate / defaults needs `pnpm sim:projections` (about 40 s) before its PR is green.
- Accepted: the table models the planned content (every listed problem, a lesson for every
  topic) even before all of it is published; a learner early in the rollout may meet a shorter
  roadmap than the one simulated.
