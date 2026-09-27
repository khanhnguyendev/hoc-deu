/**
 * Version of the engine rules (platform design §4.7, ADR-0008) stamped on every event and derived
 * row. SQL `public.rules_version()` returns the same number — `tools/db/sql-sync.test.ts` keeps
 * the two equal, so a change bumps both in one commit. 2 = the first rules with plan and SRS
 * behaviour (M4, implementation plan Part B-M4 decision 18). 3 = owner ruling M-6 (a): a block
 * checked in `skipped` and corrected to `done` / `partial` on a later local day counts for that
 * later day (M5, Part B-M5 decision 23).
 */
export const RULES_VERSION = 3
