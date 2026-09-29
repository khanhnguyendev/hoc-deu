# ADR-0040: Bot-written notes show "tested (bot tests)" until an admin publishes them

- **Status:** accepted
- **Date:** 2026-09-28
- **Spec:** platform design §3.5, §3.7, §6.6, §6.11; implementation plan Part B-M6 decision 20
  (task 6.7a)

## Context

A problem note shows how its solutions are verified (§3.7): "Đã kiểm thử" when `content-verify`
ran them against the problem's `tests.yaml`, "Chỉ biên dịch" otherwise. For a note a person wrote,
the tests come from LeetCode's examples plus edge cases checked by hand, so "tested" means the
solution is right on those cases. For a note the bot wrote, the same bot wrote the solution **and**
`tests.yaml`: a pass proves they agree, not that either matches the problem.

## Decision

- The catalog keeps a note's provenance: `origin: bot` in its frontmatter becomes
  `ProblemNote.origin` (`content:build`; absent for a human-written note, so the catalog and its
  version are unchanged for them).
- While such a note is a **draft**, its verification badge reads **"Đã kiểm thử (test do bot
  viết)"** ("tested (bot tests)") — the `warning` tone with a bot icon — instead of "Đã kiểm thử".
  A compile-only note stays "Chỉ biên dịch".
- Only drafts carry it, and learners never see drafts (§3.3), so the badge appears in
  `/admin/content`'s drafts list only (`vi.publish.badge.testedByBot`).
- **Publishing clears it:** the admin publishes with the §6.6 checklist — the `tests.yaml`
  examples match LeetCode's, the explanation and complexity are right, the bilingual line reads
  naturally — all three required. The publish PR flips the note to `active`, and an active note
  shows the plain "Đã kiểm thử": an admin has vouched for the tests.

## Consequences

- Easier: an admin sees at a glance which drafts rest only on the bot's own tests, and the
  checklist names exactly what to check.
- Accepted: the admin's check is a human reading, not a proof; a published bot note is as
  trustworthy as the admin's review of its examples.
- If learners ever see bot notes before publishing (not planned), the badge must go with them.
