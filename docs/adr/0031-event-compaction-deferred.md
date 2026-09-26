# ADR-0031: Event compaction — designed, deferred until the 350 MB warning

- **Status:** accepted
- **Date:** 2026-09-27
- **Spec:** platform design §4.5, §4.7, §4.9, §8.4 items 4 and 5; implementation plan Part B-M5
  task 5.6

## Context

The event log is the source of truth (ADR-0007): derived rows are rebuilt by replaying it, and a
replay can use either the rules of the day an event was recorded or the current rules (ADR-0008).
It is also most of the database. The spec's estimate (§4.9) is ~300 B per event with its indexes
and ~35 events per active learner per day, most of them card results: at 100 daily learners about
1 MB a day, ~365 MB a year, against the free plan's 500 MB. Without anything done the 350 MB mark
arrives around month 8 and ~530 MB around month 12 (§8.4).

§4.7 designs the remedy — **compaction**: card results (`item.result` of flashcards) older than 180
days are replaced by one `item.snapshot` event per item holding the SRS state at that point; plan,
check-in and every other event is kept. It is approved but costs real work and real risk: a
secret-key job that deletes source-of-truth rows, a snapshot writer whose output must equal what a
replay would have produced, a drift check around it, and backups that must not resurrect deleted
rows.

At 1–10 learners in v1.0 the database is ~35–80 MB (§2.3). Building compaction now would spend
that effort years before it can pay off and put a delete path into the event log with nothing to
exercise it.

## Decision

- **Compaction stays designed and unbuilt.** Until it is built, events are kept whole: nothing
  deletes an `events` row except the account-deletion cascade (§4.5).
- **What is ready for it:** `item.snapshot` is a reserved event type and replay already handles it
  (M4); `ops_metrics` records the database size every day (ADR-0034); the only role that could
  delete events is the secret key's (§4.5).
- **The trigger is the 350 MB DB-size warning on `/admin`** (task 5.6). `/admin` reads the latest
  `db.size_bytes` from `ops_metrics` and shows:
  - ≥ 100 MB — warning: "chuyển sao lưu sang chuỗi gia tăng" (the incremental, derived-free
    backup chain of §2.3; a separate change);
  - ≥ 350 MB — warning: "đến lúc bật nén sự kiện cũ (ADR-0031)", linking here — **build and turn on
    compaction now**;
  - ≥ 450 MB — critical (red): compaction, or an upgrade (§8.5), cannot wait.
  Sizes are MiB, as Postgres and the Supabase dashboard report them.
- **When it is built** it follows §4.7: card results older than 180 days that a snapshot covers,
  deleted by a job added to the daily maintenance cron (ADR-0034), idempotent, secret key only,
  with its own pgTAP and a replay-equality test (the rebuilt derived rows before and after
  compaction are equal). Replay from a snapshot cannot recompute the pre-snapshot history under new
  rules — accepted in §4.7.

## Consequences

- Easier: no delete path into the event log in v1.0; every replay can still start from the first
  event under any rules version.
- Harder: storage grows linearly until the warning fires; the owner has to act on a warning
  rather than rely on automation. The warning comes from a daily reading, so it can be up to a day
  late — at ~1 MB a day that is negligible against the 100 MB between warn and the free limit.
- Accepted: if the warning is ignored past 450 MB, the red critical banner stays on `/admin` until
  compaction ships or the plan is upgraded.
