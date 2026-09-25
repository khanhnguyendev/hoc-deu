# ADR-0008: `rules_version` on events and derived rows

- **Status:** accepted
- **Date:** 2026-09-25
- **Spec:** platform design §4.1, §4.4, §4.7; implementation plan Part B-M4 decisions 18, 19

## Context

The event log is the source of truth and the derived tables (`item_state`, `plan_block_state`,
`daily_activity`) are projections of it (ADR-0007). The rules that turn events into derived rows
will change: SRS intervals are tuned by simulation (§5.10), plan rules evolve. After a change, the
same history can mean two things — what the learner saw under the old rules, or what the new rules
make of it — and a replay has to pick one. The drift check (§4.7) compares stored rows with a
replay, so it must also tell a rules change apart from a bug or a learner writing their own rows
(`apply_event` is `SECURITY INVOKER`). And once old card results are compacted (§4.7, deferred)
the events a replay would need are gone.

Options considered:

- **No version** — nothing tells which rules produced a row; every rules change looks like drift.
- **Keep every historical rule set in code** and replay each event under the version it was
  stamped with — exact history, but old rules can never be deleted and every test multiplies.
- **Stamp the version, replay under the current rules only** — chosen.

## Decision

- **Every event and every derived row carries `rules_version`** (and `day_plans`, §4.1). A
  learner's event gets it from the database — the `events` insert trigger forces
  `public.rules_version()` — and a system event defaults to it; derived rows are stamped when they
  are written (task 4.9a adds the tables).
- **One number, two places, bumped together.** `RULES_VERSION` (`lib/domain/rules.ts`) and SQL
  `public.rules_version()` change in the same commit whenever SRS or plan behaviour changes.
  `tools/db/sql-sync.test.ts` compares the constant with the last `rules_version()` definition in
  the migrations; from task 4.9a a pgTAP assertion checks that the running database returns it,
  and a sql-sync case keeps that pgTAP literal equal to the constant (decision 18). Version 1 has
  no plan or SRS rules (M2); version 2 is the first with them (M4, task 4.9a).
- **Replay is an explicit choice of rules.** `replay(events, catalog, { rulesVersion })`
  (`lib/domain/projection/replay.ts`) takes the version to replay under. Only the current rules
  exist in code, so it must equal `RULES_VERSION` (the default); replay re-derives every event,
  whatever version it was stamped with, under the current rules. An event stamped with a **newer**
  version — written by a newer deploy than the code replaying it — throws instead of being
  misread. Events are ordered by (instant of `occurred_at`, id), so the input order and the
  timestamp's notation do not matter; an event that cannot apply (invalid payload, unknown item,
  wrong item type, missing keys) is listed in `ignored` with its reason instead of failing the
  replay.
- **`item.snapshot` makes compacted history replayable.** Its payload is a full `item_state` row —
  `level`, `weak`, `topSuccesses`, `dueOn`, `lapses`, `reps`, `introducedOn`, `lastResult`,
  `lastResultOn` and the `rulesVersion` it was computed under (decision 19). Replay sets the row to
  the snapshot (status derived from the item's SRS parameters) and applies later events on top.

## Consequences

- Easier: a rules change is one bump in two places that tests keep equal; stored rows with an
  older `rules_version` than the current one are expected to differ from a replay, so the drift
  check can separate a rules change from drift.
- Easier: replay is deterministic — same events, same catalog, same state — and the "ignored" list
  shows what history the current rules could not use.
- Harder: nothing detects a forgotten bump; the sql-sync tests only keep the two numbers equal.
  Reviews of SRS and plan changes must check it.
- Accepted: replaying under the current rules rewrites history — after an interval change, the
  replayed due dates are not the ones the learner saw. Replaying under historical rules would need
  the old rules kept as code; it is built only if a need appears, behind the same `rulesVersion`
  option.
- Accepted (limitation): a snapshot freezes the state it records. Rules changed after it cannot
  recompute what came before it — the compacted results are gone — so from a snapshot on, replay is
  exact only for the rules in force when the snapshot was written; later events are re-derived on
  top of it. A snapshot has no `status` field: a `skipped` status is not restored from it alone.
- Constraint for the compaction job (§4.7, built only when the 350 MB warning fires): a snapshot
  replaces the row, so it must be dated at the last result it replaces, not at compaction time —
  otherwise a later `item.skipped`, `item.readded`, `track.reset` or `track.resumed` that stays in
  the log would be undone by it in replay order.
- Accepted (known limitation, M4 final review M-7): replay order is not always the order the live
  tables saw. Replay sorts by `occurred_at`, but `occurred_at` is the transaction's start —
  `events_prepare` sets it to `now()` before `events_20_quota` waits on the user-day's quota row —
  while the live tables change in commit order. So under a concurrent `track.reset` or
  `track.resumed`, an item's first result can start first, wait on the quota row, and commit
  after the reset with the earlier `occurred_at`: live keeps the row it inserted, replay applies
  the reset after it and deletes (or, for a resume, shifts) that row. The window is the head start
  of a transaction before its insert, about a millisecond. v1.0 runs replay only in tests; the
  future drift check (§4.7) must reconcile such rows or order by commit (for example, the quota
  trigger could set `occurred_at := clock_timestamp()` once it holds the row, raising
  `day_changed` if the local day moved). Related: replay sorts to the millisecond
  (`Date.parse`, then `id`), while the database stores microseconds, so two events of one user in
  the same millisecond replay in id order, not in the order they happened.
