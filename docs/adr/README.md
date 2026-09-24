# Architecture decision records

Each decision listed in platform design §9.2 gets a file `NNNN-<slug>.md` (from
`0000-template.md`), written by the task that implements it (implementation plan, **Writes
ADR-NNNN**). Until then the decision is recorded in the platform design only.

| ADR | Decision | Written in task |
| --- | --- | --- |
| [0001](0001-nextjs-on-vercel-hobby.md) | Next.js 16 App Router on Vercel Hobby, non-commercial; offline-safe build with self-hosted fonts | 1.0 |
| [0002](0002-supabase-keys-and-getclaims.md) | Supabase with publishable/secret keys; `getClaims()` on the server | 2.6 |
| [0003](0003-oauth-and-test-login.md) | Google + GitHub OAuth only; env-gated test login for local/CI | 2.7a |
| 0004 | Open sign-up with admin approval | 2.8 |
| 0005 | Public repository; encrypted backups; security features on | 5.7 |
| [0006](0006-proxy-and-dal.md) | `proxy.ts` only refreshes the session; access checks in layouts + DAL | 2.6 |
| [0007](0007-event-log-and-apply-event.md) | Event log + derived state; pure TypeScript domain + `apply_event` RPC (`SECURITY INVOKER`) | 2.5b |
| 0008 | `rules_version` on events and derived rows | 4.2 |
| 0009 | Tracks are data, item types are code (registry) | 3.4 |
| 0010 | Namespaced IDs, append-only `ids.lock`, reserved `user:` prefix | 3.2 |
| 0011 | `@next/mdx` with a strict MDX safety check; code highlighting at build time | 3.3 |
| 0012 | Solutions verified in a sandboxed CI job; phased harness | 3.5 |
| 0013 | One lesson per pattern; notes upgradeable to deep-dives | 3.7–3.9 |
| 0014 | Simulation-backed SRS parameters per track; mastery | 4.8 |
| 0015 | DSA variant follows the budget; simulated finish shown | 2.10 |
| 0016 | Gate rule on the last **seen** plan; stale-plan resume | 4.3 |
| [0017](0017-day-start-and-schedule-versions.md) | Per-user day start; schedule versions effective at the next day start | 2.3 |
| 0018 | Baseline vs AI plan precedence: replace only an **untouched** plan (no check-in, no event with its `plan_id`); keep `seen_at` | 6.5 |
| [0019](0019-cache-components-off.md) | Cache Components off in v1 | 2.6 |
| [0020](0020-intl-only-time.md) | Intl-only time handling in `lib/domain`; no date library | 2.3 |
| [0021](0021-layer-rules-and-guards.md) | Layer rules via an in-repo ESLint rule + architecture tests; token guard | 1.10 |
| 0022 | Daily bot: two loops, app code off-limits; weekly code Routine is future work | 7.2 |
| 0023 | Auto-merge `claude/content-*` without an approving review (self-approval impossible) | 7.3 |
| 0024 | Content PRs only from the Routine; publishing via admin requests; no GitHub token in the app | 6.7 |
| 0025 | Publishing tiers for bot content | 6.7 |
| 0026 | Bot token hash in the database, rotated from admin | 6.3 |
| 0027 | Run keys by Asia/Ho_Chi_Minh date; numbered publish runs | 6.4 |
| 0028 | Far-west time-zone limitation accepted for v1 | 7.4 |
| 0029 | Backups: simple daily full dumps in v1.0; incremental, derived-free chain (incl. `day_plans` by `updated_at`) from 100 MB; chain restore test | 5.7 |
| [0030](0030-learner-write-quota.md) | Learner write quota: `SECURITY DEFINER` `BEFORE INSERT` trigger + internal `event_quota` table (no learner access); Upstash only from v1.1, for bot/auth/admin | 2.5 |
| 0031 | Event compaction after 180 days — deferred; **trigger: the 350 MB DB-size warning** | 5.6 |
| [0032](0032-tooling-pins.md) | Tooling pins: TypeScript 6.0.x, ESLint 9.39.x, Node 22.12+ | 1.0 |
| [0033](0033-license-split.md) | License split: code MIT, `content/**` CC BY-NC-SA 4.0 | 1.0 |
| 0034 | Daily maintenance cron (idempotent, `CRON_SECRET`) | 5.7 |
| 0035 | One content PR per plan run; stale bot PRs closed after 7 days | 7.3 |
| 0036 | No offline queue in v1; a future queue needs a clamped client timestamp | 5.2 |
| 0037 | Projection table keyed by a projection inputs hash; bots cannot edit manifests or roadmaps | 4.8 |
| 0038 | Release boundary v1.0 / v1.1 / later, week-4 content + harness constraint, dogfooding rollout | 5.8 |
| 0039 | `seen_at` set only by a browser-side effect on `/today` (never by `ensurePlan` or prefetch) | 5.1 |
| 0040 | Bot-written notes show "tested (bot tests)" until an admin publishes them via the checklist | 6.7 |
