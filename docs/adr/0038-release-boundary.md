# ADR-0038: Release boundary v1.0 / v1.1 / later; week-4 content and harness constraint; dogfooding rollout

- **Status:** accepted
- **Date:** 2026-09-24; written 5.8a (2026-09-26)
- **Spec:** platform design §0 ("Release boundary", "Release scope by feature")

## Context

The brief describes one product, but not everything in it can ship at once: the AI layer (§6)
needs a working baseline product to evolve, and content coverage (notes, pattern lessons) grows
week by week rather than all at launch. Without a written boundary, "done" has no fixed meaning
from one milestone to the next, and a milestone could quietly pull in a feature — or a piece of
content — the schedule never budgeted for.

A second, narrower risk sits inside the boundary itself: even a v1.0-only learner advances through
roadmap weeks under their own pace, and week 4 is the first week whose content needs machinery
(the `content-verify` harness phases) that ships later than week 1–3's. A learner who reaches
week 4 before that machinery and its content exist would meet broken or unverifiable problems.

## Decision

- **v1.0 is M0–M5:** sign-up with approval, onboarding, baseline plans (the AI flag stays off for
  everyone), check-in, review and progress. Content at launch: metadata for every DSA problem,
  notes and pattern lessons for weeks 1–3, English weeks 1–3 full decks and weeks 4–10 core cards.
  The full feature-by-feature table lives in platform design §0 ("Release scope by feature") — this
  ADR does not repeat it, only the boundary and its consequences.
- **v1.1 is M6–M7, the AI layer:** admin bot controls and the bot API (M6), then the Routine in
  dry-run and, after the acceptance week, live (M7, spec §6.10). Nothing in v1.0 depends on it: the
  baseline plan engine is complete and deterministic on its own (ADR-0007, ADR-0016, ADR-0017).
- **"Later"** is scoped work whose data model may already exist (a column, a default) but that has
  no UI or job in v1.0 or v1.1 — editing UI for weekly templates and throttle thresholds, the
  `include_bonus` toggle, the event-compaction job, data export, the drift check, and the items
  spec §0's table lists under "later". The implementation plan must never pull a `v1.1` or `later`
  item into a v1.0 milestone task (a rule this plan's Global Constraints already state; this ADR is
  where a task checks the boundary itself, not just the constraint).
- **The week-4 content and harness constraint applies inside v1.0 itself:** before any learner
  (dogfooding owner included) reaches roadmap week 4 of either track,
  - the `content-verify` harness phases **M3b** and **M3c** must be done (week 4 introduces linked
    lists and design problems such as 146 LRU Cache, which need them to verify at all); **and**
  - either week 4–5's notes and pattern lessons have been written by hand, or v1.1's content loop
    has shipped so it can write them.
  `/admin` and `/admin/content` enforce this as a red warning, not just a written rule: every
  roadmap week an active learner will reach within 14 days, with a missing pattern lesson or a
  placed problem without a note, is flagged (spec §0, §8.4; decision 25 of Part B-M5). A red
  warning during dogfooding or after invites open is expected until that week's content lands, not
  a bug — but invites do not open while one is showing for a week reachable within two weeks.
- **The rollout is staged, not a single cutover:**
  1. **Owner dogfooding**, one to two learners deep (the owner alone) for one to two weeks —
     `docs/ops/dogfooding.md`. The pace check (Part B-M5 decision 37) compares the owner's actual
     roadmap week against the onboarding projection for their variant and budget
     (`lib/domain/plan/projections.generated.json`, ADR-0037); more than 15 % slower stops the
     rollout at this step until the simulation model or the defaults are revisited and
     re-calibrated (`pnpm sim:projections`).
  2. **Invites open** (sign-up with approval, already built — spec §2.5, §4.5) once the pace check
     passes and no week-4-constraint red warning blocks it.
  3. **The v1.1 dry-run week** runs on that real data once v1.1 ships (the owner's AI flag on,
     `dry_run` on, spec §6.10) — not before invites, and not before v1.0 has run on real learners
     for at least the dogfooding window.

## Consequences

- Easier: every milestone task can be checked against one written boundary instead of the
  implementer's judgment call — "is this v1.0" has one answer, in one place, for the life of the
  project.
- Easier: the week-4 constraint is enforced by a visible warning, not a rule someone has to
  remember to check before every invite — a red `/admin` warning is self-explaining and does not
  need this ADR open to act on.
- Harder: the rollout adds a real waiting period (dogfooding, then the pace check) between "code
  complete" and "learners invited" — a milestone being merged is not the same as it being live for
  anyone but the owner.
- Accepted: the pace check's 15 % threshold is a judgment call, not derived from the simulation the
  way the SRS parameters were (ADR-0014); a real "later" ADR or ledger ruling can move it if the
  owner's actual pace consistently sits just outside it for reasons unrelated to the model (e.g. a
  genuinely lighter real-world schedule than 60 min/day).
