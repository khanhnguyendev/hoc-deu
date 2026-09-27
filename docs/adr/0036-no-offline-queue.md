# ADR-0036: Results stay self-reported and online; no offline queue in v1

- **Status:** accepted
- **Date:** 2026-09-27 (M5 task 5.2c)
- **Spec:** platform design §4.1 (`events.id`), §4.4, §5.1, §5.5, §5.7; DESIGN_SYSTEM §9 (Code
  tabs / Solution); implementation plan Part B-M5 decisions 13–19

## Context

Every item page records a result: a problem's grade (new, redo, or quick recall), a card's grade,
a lesson completed, an exercise submitted, a prompt done, an item skipped or re-added (§4.4). Two
questions follow.

- **Who decides the result?** Nothing in the app can check that a LeetCode problem was solved,
  that a card was really known or that a prompt was recorded. The fill-blank checker grades a
  typed answer, but the learner can retype it after reading the hint or the solution.
- **What happens without a network?** A learner on a train could grade a dozen cards. A local
  queue replayed later would keep those grades, but the server decides the **local day** of every
  event from the database clock (`occurred_at = now()`, `local_day` computed in the database, §4.1,
  §5.1): SRS counts only the first result per item per local day and schedules from that day
  (§5.7), check-ins count for the day of their first check-in (ADR-0016), and the gate and the
  streak read those days. A queued event replayed after the day start would land on the wrong day
  — or, if its client timestamp were trusted, let a device clock rewrite past days.

## Decision

- **Results stay self-reported.** The grade buttons record what the learner says. Revealing the
  note's solution ("Xem lời giải") before grading preselects "Cần gợi ý" as a nudge (decision
  18); the learner can still choose any grade. The fill-blank checker's grade is submitted as it
  is; a respond / rewrite exercise is graded by the learner against the rubric, and its answer
  text is never sent.
- **Every write is online, through a server action** (`recordOutcome`, `checkInBlock`) called with
  the page's **per-render request id**. The event id is `deriveEventId(requestId, key)` with a
  digest of the payload in the key (decision 16), so a retry after an error — the same tap again,
  "Thử lại" in a card session — records the event once (`duplicate` is success). A call that never
  answers shows "Chưa lưu được kết quả" and nothing is assumed saved.
- **v1 has no offline queue.** Nothing is stored in the browser for later sending; a failed save
  is retried by the learner while online.
- **A future queue must clamp its client timestamps to the server's day.** If one is added, each
  queued event carries the time it happened on the device; the server accepts it only within the
  learner's current local day (and not before the last event it already holds), and otherwise
  records it at the server's time — never letting a device clock place an event on a past day
  (§4.1: "a future queue would need a clamped client timestamp").

## Consequences

- The event log, SRS and daily activity stay a pure function of server-timed events: replay (M4)
  and the drift check need no client clocks.
- A learner without a connection cannot record results; the pages say so and keep every control
  available. For a self-study app used at a desk this is accepted for v1; mobile apps and offline
  mode beyond safe retries are out of scope (§0).
- Self-reporting means a learner can inflate their own progress. The app nudges (the preselected
  hint after a revealed solution) but never overrides the learner, and nothing else depends on
  the grades being honest: they only schedule that learner's own reviews.
