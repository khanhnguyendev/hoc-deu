# ADR-0020: Intl-only time handling in `lib/domain`; no date library

- **Status:** accepted
- **Date:** 2026-09-24
- **Spec:** platform design §2.1 (dependencies), §5.1, §5.9

## Context

`lib/domain` (platform design §7.2, CLAUDE.md) must be pure TypeScript: no React/Next/Supabase
imports, no date library, no clock reads — `now` and `localDay` are always parameters. Time-zone
handling still needs real IANA time-zone data (offsets, DST, historical rule changes), and pulling
in a date/time library (`date-fns`, `date-fns-tz`, `luxon`, …) is both a new dependency (not on
the approved list, platform design §7.10) and a pure-TypeScript-purity risk if that library ever
reads the process clock or a local time zone internally.

Two further problems are specific to running on Node's built-in ICU:

- **Legacy zone aliases.** Node 22.17 (ICU 77.1, tz 2025b — observed 2026-09-24, and reproduced
  during this task) reports `Asia/Saigon` from `Intl.DateTimeFormat().resolvedOptions().timeZone`
  for what a learner picks as `Asia/Ho_Chi_Minh`, and `Intl.supportedValuesOf('timeZone')` omits
  `Asia/Ho_Chi_Minh` entirely. Browsers can do the same. Storing or displaying the alias name is
  confusing and would make a naive equality check (`timezone === 'Asia/Ho_Chi_Minh'`) silently
  fail for exactly the learner population this product targets first.
- **Local-time drift in tests.** A `lib/domain` function that reads the process's local time zone
  (`Date#getHours`, `toLocaleDateString`, …) instead of an explicit `Intl.DateTimeFormat({
  timeZone })` call will pass on a UTC CI runner and fail — or worse, silently compute the wrong
  day — for a developer whose machine is in a different, especially half-hour-offset, zone.

## Decision

- `lib/domain/time` uses **`Intl.DateTimeFormat` only** for time-zone-aware reads: construct with
  `{ timeZone, hourCycle: 'h23', year, month, day, hour, minute, second }` and read
  `formatToParts(now)`, then rebuild a UTC millisecond value from those parts with `Date.UTC` and
  do all further calendar arithmetic on integer day numbers
  (`Date.UTC(y, m - 1, d) / 86_400_000`). No date library is added.
- `lib/domain/time/timeZones.ts` exports `TIME_ZONE_ALIASES`, a table of CLDR legacy IDs ICU still
  reports or accepts, mapped to their current IANA name (`Asia/Saigon` → `Asia/Ho_Chi_Minh`,
  `Asia/Calcutta` → `Asia/Kolkata`, and others), and `canonicalTimeZone()` applies it.
  `canonicalTimeZone()` runs before a time zone is shown, stored, or used to read wall-clock parts
  (`localDay` canonicalises internally), and the database independently validates every stored
  zone against `pg_timezone_names` (defence in depth, not a duplicate source of truth).
- **`vitest.config.ts` pins `process.env.TZ = 'America/St_Johns'`** at the top of the file, before
  the test workers spawn — a non-UTC, half-hour-offset zone chosen specifically to flush out any
  code that reads the process's local time instead of an explicit `Intl.DateTimeFormat({
  timeZone })`. `tools/guards/vitest-tz.test.ts` asserts the pin took effect
  (`Intl.DateTimeFormat().resolvedOptions().timeZone === 'America/St_Johns'`), and one of the
  fixtures in `lib/domain/time/fixtures.ts` uses `America/St_Johns` itself so the pin's own zone is
  exercised, not just assumed harmless.
- `tools/guards/domain-purity.ts` enforces the purity rules mechanically (TypeScript compiler
  API): `lib/domain/**` may import only `lib/domain` and `zod`; no `node:*`; no `.tsx` files; no
  `Date.now()`, `Date()` without `new`, or argument-less `new Date()`; no local-time
  getters/setters (`getHours`, `toLocaleDateString`, `setHours`, …) — only their UTC counterparts,
  which the day-number math in `localDay.ts` uses freely; no `performance.now()`, `Math.random()`,
  `fetch`. This is the stronger check; the existing ESLint rules in `lib/domain/**` catch a subset
  of the same mistakes earlier, in the editor.

## Consequences

- Easier: `lib/domain/time` stays dependency-free and trivially portable — the same functions run
  in Node, in a browser bundle, or (once ported) as the basis for the SQL parity test (task 2.5)
  without pulling a time-zone database along.
- Easier: a schedule stored or displayed in the app is always the canonical IANA name, even when
  the browser's or Node's `Intl` reports (or the learner's own OS supplies) a legacy alias.
- Harder: every time-zone-aware read must go through `Intl.DateTimeFormat` explicitly; there is no
  shorthand `date.getHours()` escape hatch, and the purity guard fails the build if one appears.
- Accepted: the alias table is a maintained, finite list rather than a live CLDR feed — new
  aliases (should ICU add one) need a manual addition, caught only when a fixture or a real
  learner's zone starts round-tripping incorrectly.
