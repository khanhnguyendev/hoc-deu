/**
 * Version of the engine rules (platform design §4.7, ADR-0008) stamped on every event and derived
 * row. SQL `public.rules_version()` returns the same number — `tools/db/sql-sync.test.ts` keeps
 * the two equal, so a change bumps both in one commit. 2 = the first rules with plan and SRS
 * behaviour (M4, implementation plan Part B-M4 decision 18).
 */
export const RULES_VERSION = 2
