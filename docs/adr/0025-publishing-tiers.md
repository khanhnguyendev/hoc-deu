# ADR-0025: Publishing tiers — bot flashcards and exercises may ship active; notes, deep-dives and lessons ship draft

- **Status:** accepted
- **Date:** 2026-09-28
- **Spec:** platform design §3.3, §3.5, §6.5 rule 4, §6.6, §6.11; implementation plan Part B-M6
  decision 20 (task 6.7a)

## Context

Content PRs from the Routine auto-merge once the required checks pass, without an approving
review (ADR-0023). The checks can verify shape (schemas, the MDX safety check, the path and size
guards) and consistency (the sandboxed `content-verify` runs a solution against its `tests.yaml`),
but not whether an explanation is right: the same bot writes a note's solution and its tests, so
passing tests prove only that the two agree (ADR-0040).

The content differs in risk. A flashcard or an exercise is small, self-contained, per week and
easy to judge at a glance; a wrong one costs a learner one review. A note, a deep-dive or a lesson
teaches a pattern; a wrong one teaches the wrong thing to every learner who reaches that week.

## Decision

- **New bot `flashcard` and `exercise` items may ship `active`** once the required checks pass.
- **New bot notes, deep-dives and lessons ship `draft`**: learners never see them (a draft note
  hides only the note, §3.3); admins see them in `/admin/content`'s drafts list.
- Every bot item carries `origin: bot` and `createdByRun` (§3.3 provenance).
- **A draft becomes `active` only through an admin publish request** (ADR-0024): "Xuất bản" with
  the §6.6 checklist, then a publish run's PR. `bot-content-policy` enforces all of this on
  `claude/*` branches: the tiers for new items, and a pending request for every draft → active
  flip.
- `track.yaml`, `roadmaps/**` and `problem.yaml` are never bot-written (they feed the plan engine
  and the projection table, §5.11).

## Consequences

- Easier: small practice content reaches learners the same day; teaching content always has a
  human reading it first.
- Harder: an admin has to read every bot note, deep-dive and lesson before it helps anyone; a
  busy week can leave drafts waiting (the drafts list and the "Yêu cầu xuất bản" section show
  them).
- Accepted: a wrong active flashcard or exercise is possible between two admin looks; the item can
  be retired by a normal content PR (IDs stay in `ids.lock`, ADR-0010).
