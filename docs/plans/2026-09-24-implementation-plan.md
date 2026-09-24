# Học Đều Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking. Also required while executing:
> superpowers:test-driven-development, superpowers:verification-before-completion, and
> superpowers:requesting-code-review at the end of each milestone.

**Goal:** Build Học Đều — a multi-user, AI-driven learning platform with data-defined tracks, a
deterministic daily plan engine with spaced repetition, and (v1.1) a daily AI bot — as eight
milestones, each ending with a green `pnpm verify`.

**Architecture:** Next.js 16 App Router on Vercel Hobby with Supabase (Postgres + Auth + RLS). All
learning rules live once, in pure TypeScript (`lib/domain`); Postgres functions apply events
atomically; content is versioned data in `content/**`, validated at build time; UI is layered
tokens → ui → patterns → features → app.

**Tech Stack:** Next.js 16.3, React 19.3, TypeScript 6.0 (strict), pnpm 11, Tailwind CSS 4.3,
shadcn/ui, MDX (`@next/mdx`), Zod 4, Supabase (`@supabase/ssr`), Upstash (v1.1), Vitest 5,
Playwright + axe, GitHub Actions.

**Spec:** [`docs/plans/2026-09-23-platform-design.md`](./2026-09-23-platform-design.md) (approved)
and [`docs/design/DESIGN_SYSTEM.md`](../design/DESIGN_SYSTEM.md) +
[`docs/design/tokens.css`](../design/tokens.css) (approved). Executors read the relevant spec
sections for every task.

## How this plan is organised

- **Part A — Milestone roadmap (M0–M7).** Every milestone broken into tasks (one reviewable
  commit each) with files, interfaces, the tests that must exist, and the verification command.
- **Part B — M0 step by step.** Full code and commands for every M0 step. All M0 code in this
  plan was **run in a throwaway spike on 2026-09-24** (typecheck, lint, 42 unit/lint tests,
  build, 8 Playwright + axe runs — all green), so it is known to work with the pinned versions.
- **Just-in-time detail for M1–M7.** Each later milestone's step-level section ("Part B-M*n*") is
  written **at the start of that milestone** from the code that exists by then (component APIs,
  generated DB types, migrations), reviewed by the owner, then executed. Writing step-level code for
  M1–M7 today would describe interfaces that do not exist yet and go stale.
- **Execution status:** M0 done (PR #1, merged 2026-09-24). M1 done (PR #3, merged 2026-09-24):
  step-level detail in [Part B-M1](#part-b-m1--component-library-step-by-step), reviewed by the
  owner together with the M1 pull request. M2: step-level detail in
  [Part B-M2](#part-b-m2--auth-onboarding-settings-step-by-step), written at the start of M2;
  the owner reviews it before execution.
- **ADR ownership:** every ADR in platform design §9.2 is written by the task that implements it
  (marked **Writes ADR-NNNN** below); `docs/adr/README.md` lists the same mapping.

## Execution methods (approved by the owner, 2026-09-24)

| Milestone | Method |
| --- | --- |
| M0 | **Native** (superpowers:executing-plans), then one fresh reviewer on the whole branch |
| M1, M3, M5 | Native, with an end-of-milestone review |
| M2, M4, M6 | **Subagent-driven** (superpowers:subagent-driven-development) — fresh implementer and reviewer per task |
| M7 | Decided at the start of M7 |

Content tasks 3.6–3.11 have no plan-engine dependency and may run in parallel with M4–M5.

## Global Constraints

Every task implicitly includes these (values copied from the spec).

- **Versions:** Node ≥ 22.12 (`.nvmrc` `22`); pnpm `11.1.1` (`packageManager`); Next `16.3.6`;
  React `19.3.0`; **TypeScript `6.0.x` — not 7** (typescript-eslint supports < 6.1); **ESLint
  `9.39.x` — not 10**; Tailwind `4.3.x`. Install with exact versions (`--save-exact`).
- **Dependencies:** only those in platform design §7.10, plus `sonner` (shadcn's toast, approved
  2026-09-24). Anything else → ask the owner first.
- **Visual values** live only in `app/globals.css` (generated from `docs/design/tokens.css`). No hex,
  `rgb()`, `oklch()`, `px`/`rem`/`ms` literals or arbitrary Tailwind values (`p-[13px]`) anywhere
  else — enforced by ESLint and the token guard (§7.3).
- **Layer rules** (§7.2): tokens → `components/ui` → `components/patterns` → `features/<x>` →
  `app/`; each imports only from layers above. Enforced by ESLint.
- **Server Components by default;** `'use client'` only on interactive leaf components, never on
  `page.tsx` / `layout.tsx`. Browser APIs only in client components.
- **Every server action and route handler calls a guard** (`requireUser` / `requireActive` /
  `requireAdmin` / `requireBotToken` / `requireCronSecret` / `publicRoute()`), from M2 on.
- **`lib/domain` is pure:** no React/Next/Supabase imports, no date library, no clock reads —
  `now` and `localDay` are parameters; time zones via `Intl` only.
- **Copy:** all UI strings in Vietnamese in `lib/i18n/vi.ts`, technical terms in English;
  `<html lang="vi">`, English learning content wrapped in `lang="en"`.
- **Secrets:** never read or commit `.env*`, `docs/credentials/` or any credential; never put
  per-user data in the repo (`seed.sql` is synthetic only).
- **Accessibility:** WCAG 2.1 AA; axe must pass in light and dark, desktop and mobile.
- **Release scope** (§0 table): never pull a `v1.1` or `later` item into a v1.0 milestone.
- **Git:** Conventional Commits; one task ≈ one commit; work on a branch per milestone
  (`feat/m<n>-<slug>`), open a PR, CI must be green; the owner merges.
- **Done means verified:** a task is complete only when its verification command has been run and
  its output checked (superpowers:verification-before-completion).
- **Gates grow with the milestones:**
  - `pnpm verify` = typecheck → lint → unit tests → build; **from task 3.2 on it starts with
    `content:build`** (§7.8), and CI runs it.
  - `pnpm verify:full` = `verify` + `test:e2e` in M0; **from task 2.1 on** it is
    `verify` + `test:db` + `test:e2e`.
  - From 2.1, CI has a `db` job (local Supabase + pgTAP) and the `e2e` job runs against local
    Supabase with the test login, so RLS and quota regressions fail CI.
- **`main` is protected** from M0 (task 0.10): PRs only, required checks, no force pushes, no
  deletion, no approving review (self-approval is impossible, ADR-0023). It does **not** require
  branches to be up to date before merging — that would stall auto-merging bot PRs in v1.1
  (owner decision, 2026-09-24).
- **Offline build:** `next build` needs no network beyond the package registry at install time
  (fonts self-hosted, task 1.0), because the Routine's Custom network (§6.8) runs `pnpm verify`.

## Review Focus

Inputs and conditions the spec implies but no happy-path test exercises — most likely to bite a
real learner first. Each line's test is added to the owning task below (marked **[RF-n]**).

1. **[RF-1] Studying around the day boundary and across time zones** — a result at 01:30 local
   with `day_starts_at` 04:00 counts for the *previous* day; moving east/west never creates two
   plans for one date or loses the streak (owner: M2-3, M2-5).
2. **[RF-2] Double taps and retries** — the same check-in or grade sent twice (double tap, flaky
   network, two tabs) records one event and one state change; a version conflict retries cleanly
   (owner: M5-2, M4-9).
3. **[RF-3] Vietnamese text in every form** — decomposed (NFD) input from macOS/iOS keyboards is
   stored as NFC; content IDs and slugs stay ASCII; diacritics never break search, sorting or
   length limits (owner: M3-2, M5-2).
4. **[RF-4] Nothing to show yet** — a brand-new learner, a start date in the future, a week without
   notes or lessons, an empty review queue: every screen shows a meaningful state, never a crash
   or a blank page (owner: M4-6, M5-1, M5-3).
5. **[RF-5] Coming back after days away on another device** — the gate is closed, the paused banner
   and "Học tiếp hôm nay" appear, exactly one plan is created, the review backlog is throttled
   (owner: M4-3, M5-1).

---

## Part A — Milestone roadmap

Legend: **[owner]** = needs the owner's accounts or clicks; **v1.0 / v1.1** = release (§0).

### M0 — Scaffold, CI, tokens, CLAUDE.md (v1.0) — detailed in Part B

| Task | Deliverable | Verify |
| --- | --- | --- |
| 0.1 | Branch, `LICENSE` (MIT), `content/LICENSE` (CC BY-NC-SA 4.0 official text), `README.md` | `head -1 content/LICENSE` |
| 0.2 | Next.js 16 app scaffold (fonts, theme provider, placeholder home page) | `pnpm typecheck && pnpm build` |
| 0.3 | Vitest + `cn()` (TDD) | `pnpm test` |
| 0.4 | Design tokens wired into `app/globals.css` + tokens-sync test | `pnpm test && pnpm build` |
| 0.5 | ESLint layer + token rules with rule tests; Prettier | `pnpm lint && pnpm test` |
| 0.6 | Token guard (scanner) with tests | `pnpm test` |
| 0.7 | Playwright + axe smoke test (light/dark × desktop/mobile) | `pnpm test:e2e` |
| 0.8 | `pnpm verify`, CI workflow, Dependabot, CodeQL | `pnpm verify` |
| 0.9 | `CLAUDE.md`, `docs/design/COMPONENTS.md`, ADR template + index, M0 checks recorded | `pnpm verify` |
| 0.10 | GitHub security settings, PR, CI green on GitHub, `main` ruleset | `gh pr checks --watch` |

### M1 — Component library + `/dev/components` (v1.0)

| Task | Files | Tests that must exist | Verify |
| --- | --- | --- | --- |
| 1.0 Self-hosted fonts | `app/fonts/be-vietnam-pro/*.woff2` (400/500/600/700) + `OFL.txt`, `app/fonts/jetbrains-mono/*.woff2` (variable) + `OFL.txt`, `app/fonts/README.md` (source, version, subset command); `app/layout.tsx` → `next/font/local`; ESLint bans `next/font/google`; CI `verify` job builds with `fonts.googleapis.com` / `fonts.gstatic.com` blocked in `/etc/hosts`; spec §2.1, §6.8 **Writes ADR-0001, ADR-0032, ADR-0033.** | architecture test: no `next/font/google` import and no Google Fonts host in source; every font file `layout.tsx` references exists; each family folder has `OFL.txt`; ESLint rule test; e2e: no request to a Google Fonts host and the self-hosted face is loaded | `pnpm verify && pnpm test:e2e`; CI build with the hosts blocked |
| 1.1 shadcn init + React test setup | `components.json` (new-york, `stone`, `radix`, cssVariables); no `shadcn eject` CSS to merge — superseded by Part B-M1 decision 3, nothing to eject (M1 review); add `class-variance-authority`, `lucide-react`, `radix-ui`, `@vitejs/plugin-react`, `jsdom`, `@testing-library/react`, `@testing-library/user-event`; `vitest.config.ts` react plugin | tokens-sync test still green; a jsdom render smoke test | `pnpm verify` |
| 1.1a `tokens:sync` | `tools/tokens/sync.ts` + `tsx` (dev, approved §7.10): replaces only the block between `/* tokens:start */` and `/* tokens:end */` in `app/globals.css` with `docs/design/tokens.css`, leaving shadcn CSS intact; script `tokens:sync` = `gen_tokens.py` + sync; CLAUDE.md command list completed (deferred minor #10) | sync replaces the block and keeps the CSS outside it byte-for-byte; idempotent; clear error when markers are missing or duplicated; repo `globals.css` is in sync | `pnpm verify` |
| 1.2 `lib/i18n/vi.ts` | UI strings (Đóng, Mở menu, …) typed as `const` | key-presence test | `pnpm test` |
| 1.3 ui: Button, Input, Label, Textarea | `components/ui/*` with cva variants/sizes from DESIGN_SYSTEM §9 | render each variant; disabled/loading; focus ring class; 44 px default size class | `pnpm verify` |
| 1.4 ui: Card, Badge, Separator, Skeleton, Progress, Tooltip | `components/ui/*` | variants render; Progress `aria-valuenow` | `pnpm verify` |
| 1.5 ui: Dialog, Sheet, DropdownMenu, Tabs, ToggleGroup, Toast | `components/ui/*`; Toast uses `sonner` (approved) | focus trap + restore; `Esc` closes; labels from `vi.ts` | `pnpm verify` |
| 1.6 patterns: PageHeader, Section, StatCard, StatusPill, StreakBadge, ProgressRing | `components/patterns/*` | StatusPill renders icon + label for every status (§3.3); ProgressRing value/aria | `pnpm verify` |
| 1.7 patterns: EmptyState, ErrorState, LoadingState, DataState, ConfirmDialog, DataList, Banner + root pages | `components/patterns/*`; root `app/not-found.tsx`, `app/error.tsx`, `app/global-error.tsx` in Vietnamese built from these patterns (deferred minor #8) | DataState renders all 4 states; e2e: an unknown URL shows the Vietnamese 404 with a link home, axe clean | `pnpm verify && pnpm test:e2e` |
| 1.8 pattern: CalendarHeatmap | `components/patterns/calendar-heatmap/*` | year view ≥ 768 px, month view < 768 px with 44 px cells; dots on active days; arrow-key navigation; table view; legend | `pnpm verify` |
| 1.9 pattern: AppShell | sidebar ≥ 1024 px, bottom nav < 1024 px, account menu with admin entry (admins), ThemeToggle | nav `aria-current`; admin entry only when `isAdmin` | `pnpm verify` |
| 1.10 `/dev/components` + catalog guard | `app/dev/components/*` (404 when `VERCEL_ENV=production` until 2.8 makes it admin-only), catalog registry, `docs/design/COMPONENTS.md` entries; allowed-case rule tests for every layer (deferred minor #7) **Writes ADR-0021.** | Playwright + axe over the catalog in both themes; architecture test: every component file has a COMPONENTS.md entry and a catalog entry; dark-mode e2e asserts the light and dark backgrounds differ (deferred minor #9) | `pnpm verify && pnpm test:e2e` |

### M2 — Auth, onboarding, settings (v1.0)

| Task | Files | Tests that must exist | Verify |
| --- | --- | --- | --- |
| 2.1 Supabase local, env, DB CI | `supabase` CLI dev dep, `supabase/config.toml` (Google/GitHub from env; email only when `AUTH_TEST_LOGIN`), `lib/env.ts` (Zod server/client schemas, §2.5 v1.0 vars), scripts `db:start`, `db:reset`, `db:types`, `test:db`, `verify:full` = verify + test:db + test:e2e; CI: new `db` job (`supabase/setup-cli`, `supabase start`, `pnpm test:db`) and the `e2e` job starts local Supabase with `AUTH_TEST_LOGIN=true`; CI hygiene (deferred minor #11): `persist-credentials: false` on every checkout, `cancel-in-progress` only for pull requests; revisit Playwright trace artifacts in the public repo now that the test login exists (keep on failure only, or stop uploading) M1 deferred #19: overlay axe as a full-page scan with only `aria-hidden-focus` disabled; Sheet, ConfirmDialog, AccountMenu and Tooltip scanned open; e2e fails on `console` errors and `pageerror` (hydration). | env: missing var fails; `AUTH_TEST_LOGIN=true` + `VERCEL_ENV=production` throws; a first pgTAP smoke test runs in CI | `pnpm verify:full` + CI `db` job green |
| 2.2 Staging infra **[owner]** | Supabase **staging** project; Vercel project `hoc-deu` (claims `hoc-deu.vercel.app`) with preview deployments wired to staging env vars; Google and GitHub OAuth apps with staging-preview and local redirect URLs; runbook `docs/ops/staging.md` (no secrets) | preview deploy of `main` loads; Supabase migrations apply to staging | preview URL returns 200 |
| 2.3 Local day (moved from M4) | `lib/domain/time/localDay.ts`, `lib/domain/time/fixtures.ts` (shared with the SQL parity test) **Writes ADR-0017, ADR-0020.** | **[RF-1]** 01:30 with day start 04:00 → previous date; schedule-version lookup by `effective_at`; change applies from the next day start; east/west moves; `lib/domain` purity architecture test (§7.2, deferred minor #5): imports only `lib/domain` + `zod`, no `node:*`, no date library, no `Date()` / argument-less `new Date()`, no local-time getters, `performance.now()` or `Math.random()`, no `.tsx`; Vitest runs with a fixed non-UTC `TZ` (e.g. `America/St_Johns`) | `pnpm verify` |
| 2.4 Migration: profiles, schedule_versions, user_tracks | `supabase/migrations/*`, `supabase/tests/database/*.sql` M1 deferred #21: doc drift — plan Part A 1.1 ("merge `shadcn eject` CSS", superseded by Part B-M1 decision 3) and spec §7.2's className exceptions (`app/global-error.tsx`, `app/dev/**`). | pgTAP: profile created `pending` on sign-up; column grants; `is_admin`/`is_active`; `admin_*` functions check admin and write audit events; `admin_bootstrap`; layer rule gaps (deferred minor #6): `app/api/**` follows its §7.2 row (no components), `.js`/`.jsx`/`.mjs` files are checked, the `'use client'` rule also covers `app/dev/**` — each with a rule test | `pnpm test:db && pnpm verify` |
| 2.5 Events core | migration: `events`, `event_quota` + `SECURITY DEFINER` quota trigger, `local_day` SQL function, `apply_event` / `apply_system_event` (state-table events only; derived tables in M4); `lib/domain/events.ts` — Zod payload schemas for every event type (§4.4 table) **Writes ADR-0007, ADR-0030.** | pgTAP: **[RF-1]** SQL `local_day` equals TypeScript `localDay` on the shared fixtures; forced `actor_id`/`source`; `local_day` computed in DB; 501st learner event → `quota_exceeded`; learners cannot read/write `event_quota` | `pnpm test:db` |
| 2.6 Supabase clients, proxy, DAL, guards | `lib/supabase/{client,server,proxy,admin}.ts`, `proxy.ts` (matcher: pages only), `lib/auth/dal.ts`, `lib/auth/guards.ts` **Writes ADR-0002, ADR-0006, ADR-0019.** | DAL returns cached profile; `requireActive` redirects pending; architecture test: every `'use server'` module and route handler calls a guard | `pnpm verify` |
| 2.7 Sign-in, callback, pending | `app/(public)/sign-in`, `app/(public)/auth/callback/route.ts` (admin bootstrap), `app/(account)/pending`, `supabase/seed.sql` (synthetic test users only) **Writes ADR-0003.** M1 deferred #5: AppShell sign-out — `onSignOut` is a server action invoked as `() => void onSignOut()` (Radix passes a non-serializable Event); the top-bar title comes from the pathname, not a prop. | e2e with test login: pending user sees `/pending`; admin email becomes active admin; **real Google and GitHub sign-in checked on a staging preview [owner]** | `pnpm verify:full` |
| 2.8 Admin approval queue | `features/admin/*`, `app/(admin)/admin/users` **Writes ADR-0004.** | e2e: approve/reject/suspend; non-admin gets 404/redirect; `/dev/components` admin-only in production | `pnpm verify:full` |
| 2.9 Minimal track manifests + projection table | `content/tracks/{dsa,english}/track.yaml` (manifest fields only), tiny loader `lib/content/tracks.ts`, `lib/domain/plan/projections.ts` seeded with the §5.11 prototype table | loader parses both manifests; projection lookup interpolates and clamps | `pnpm verify` |
| 2.10 Onboarding | `features/onboarding/*`, `app/(onboarding)/onboarding` — tracks → minutes → DSA variant (default by budget, simulated finish) → start date/timezone/day start → code language → template preview; events `track.enrolled`, `schedule.changed`, `settings.changed`, `onboarding.completed`; uses `localDay` (2.3) **Writes ADR-0015.** | 60 min → 8w default, 75 → 10w; finish text uses vi-VN decimal comma; e2e completes onboarding | `pnpm verify:full` |
| 2.11 Settings + account deletion | `features/settings/*`, `app/(app)/settings` (template/throttle read-only), delete account + privacy text (90-day backup note); uses `localDay` (2.3) | e2e: change timezone takes effect next day start; deletion cascades (pgTAP) | `pnpm verify:full` |

**Part B-M2 changes to this table** (decisions there): the admin functions move from 2.4 to a new
task **2.5b** with `apply_event` / `apply_system_event` (1); a new task **2.6a** adds the form and
focus-page primitives (2); **2.11b** splits account deletion out of 2.11 (3); 2.2's owner steps
run at the PR stop (4); no browser client or client env schema until a consumer exists (11);
`yaml` becomes a runtime dependency (12); `track.reset` moves to 4.9 / 5.4 (18);
`admin_list_users()` is added in 2.8 (19); 2.7 splits into **2.7a** / **2.7b** (24).

### M3 — Track manifests, content loading and validation (v1.0)

| Task | Files | Tests that must exist | Verify |
| --- | --- | --- | --- |
| 3.1 Content schemas | `lib/content/item-types/{problem,flashcard,lesson,exercise,prompt}.ts`, `lib/content/schemas/roadmap.ts`; **extends** `lib/content/schemas/manifest.ts` (created loose in 2.9) | valid/invalid fixtures per schema; exercise kinds; premium needs alternative | `pnpm test` |
| 3.2 `content:build` | `tools/content/build.ts`, `tools/content/allowlist.ts`, MDX safety check, `ids.lock`, `.generated/catalog.json`, MDX import map, report; **`pnpm verify` now starts with `content:build`** and CI runs it **Writes ADR-0010.** | cross-refs; `requires` cycles and order; anchor ≠ practice; solutions/tests required only with a note; reserved `user:` prefix; MDX: `import`/`export`/expressions/`javascript:` rejected; **[RF-3]** IDs/slugs ASCII, titles NFC | `pnpm content:build && pnpm test` |
| 3.3 MDX pipeline | `next.config.ts` (`@next/mdx`, remark plugins as strings), `mdx-components.tsx` (allow-listed components), shiki at build **Writes ADR-0011.** M1 deferred #20: the offline-build guard also scans root files (`next.config.ts`, `postcss.config.mjs`, `mdx-components.tsx`). | lesson renders sections in order; `<Term>` sets `lang="en"`; quiz score | `pnpm verify` |
| 3.4 Item registry + track pages | `features/items/{registry.ts,<type>/Page.tsx,<type>/Row.tsx}`, `app/(app)/tracks`, `app/(app)/t/[trackId]`, `app/(app)/t/[trackId]/items/[itemId]` **Writes ADR-0009.** | no `switch` on item type outside registry (architecture test); each type renders page and row | `pnpm verify && pnpm test:e2e` |
| 3.5 `content-verify` M3a | `tools/content-verify/{orchestrator.ts,comparators.ts,validators/,runners/{python,java,go}}`, `.github/workflows/content-verify.yml` (no secrets, no network, in-job path check) **Writes ADR-0012.** | every comparator; timeout; `function` signatures pass; unsupported kinds → `compile-only` | `pnpm content:verify` |
| 3.6 DSA metadata + roadmaps | all ~110 `problem.yaml`, `roadmaps/{10w,8w}.yaml`, prompts (mock interview) | build passes; week sizes; prerequisites order; **owner review before merge** | `pnpm content:build` |
| 3.7–3.9 DSA W1, W2, W3 content | notes + Python/Java/Go solutions + `tests.yaml` per problem; pattern lessons (arrays-hashing, two-pointers, sliding-window, stack, binary-search) — one task per week **Writes ADR-0013.** | content-verify: `tested` for `function` problems, `compile-only` for 271/155/981; **owner review before merge, including checking every `tests.yaml` example against the LeetCode examples** | `pnpm content:build && pnpm content:verify` |
| 3.10 English manifest, roadmap, core decks W1–W10 | `content/tracks/english/**` | build passes; derived deck mapping | `pnpm content:build` |
| 3.11 English W1–W3 extended cards, exercises, weekend prompts | decks, `exercises/*.yaml`, `prompts/*.yaml` | build passes; exercise `week` set | `pnpm content:build` |

**Parallel content:** tasks 3.6–3.11 depend only on 3.1–3.5 (schemas, build, MDX, registry,
harness), not on the plan engine, so they may run in parallel with M4–M5 on their own branches.

### M4 — Plan engine + spaced repetition, pure functions, TDD (v1.0)

`localDay` moved to M2 (task 2.3), because onboarding, settings and the `local_day` SQL function
need it first.

| Task | Files (`lib/domain/…`) | Tests that must exist |
| --- | --- | --- |
| 4.1 SRS | `srs/applyResult.ts` | every row of §5.7 table; `byType`; relearn; mastery + `item.readded`; first result per day only |
| 4.2 Projection + replay | `projection/{project,replay}.ts`, `rules.ts` **Writes ADR-0008.** | replay rebuilds all derived tables; `item.snapshot` handled; `track.reset`; pause shifts due dates |
| 4.3 Gate + resume | `plan/{gate,resume}.ts` **Writes ADR-0016.** | last *seen* plan only; unseen AI plans ignored; **[RF-5]** > 2 days + closed gate → resume plan without pointer advance |
| 4.4 Queues | `plan/queues.ts` | roadmap order; core → recap → derived → extended → bonus; drafts/retired excluded; progress-based week; recap-done derivation; exercise picker |
| 4.5 Budget + throttle | `plan/{budget,throttle}.ts` | fixed blocks reserved; review skip rule + debt cap; first-item vs throttle 0; half-fit; spill; fallback |
| 4.6 buildPlan + invariants | `plan/buildPlan.ts` + fast-check property tests | planned minutes ≤ budget or budget + largest item; every core item queued once; **[RF-4]** empty catalog/new user/future start → valid empty state |
| 4.7 Stats | `stats/{streak,weeklySummary,weakTopics}.ts` | streak across schedule change; weak topics ≥ 2 Weak |
| 4.8 Simulation + projections | `plan/__tests__/simulation.test.ts`, `tools/sim/projections.ts` (`pnpm sim:projections`) **Writes ADR-0014, ADR-0037.** | §5.10 thresholds (recalibrated once); projection inputs hash |
| 4.9 Derived tables + SQL | migrations: `item_state`, `plan_block_state`, `daily_activity`, `day_plans` (+ `seen_at`, `updated_at`), full `apply_event` (incl. `track.reset` clearing the track's derived rows — Part B-M2 decision 18), `mark_plan_seen` | pgTAP: **[RF-2]** duplicate event id → one row; version mismatch aborts; RLS on every derived table |

Verify for every M4 task: `pnpm verify` (and `pnpm test:db` for 4.9).

### M5 — Dashboard, check-in, review (v1.0) → v1.0 launch

| Task | Files | Tests that must exist | Verify |
| --- | --- | --- | --- |
| 5.1 `/today` | `features/today/*` (queries, `ensurePlan` action, `<MarkPlanSeen>`), `app/(app)/today` **Writes ADR-0039.** M1 deferred #15: StatCard applies `tracking-tight` to numbers only (§4.3). | **[RF-4]** new learner / future start / missing notes states; **[RF-5]** paused banner + "Học tiếp hôm nay" after 3 days, one plan only; prefetch never sets `seen_at` | `pnpm verify && pnpm test:e2e` |
| 5.2 Check-in + results | `features/checkin/*` (sheet, one-tap, auto check-in), result actions per item type (recall/redo, flashcard grades, exercise, prompt, quiz), solution-reveal nudge **Writes ADR-0036.** | **[RF-2]** double tap → one event; retry after version conflict; **[RF-3]** NFD note stored NFC, 280-char limit counts graphemes | `pnpm verify && pnpm test:e2e && pnpm test:db` |
| 5.3 `/review` | `features/review/*` | Weak first; **[RF-4]** empty queue state | `pnpm verify && pnpm test:e2e` |
| 5.4 "Học thêm" + off-plan study; "Bắt đầu lại" | `features/today/*`; the "Bắt đầu lại" button (`track.reset`, ConfirmDialog) on the track page (Part B-M2 decision 18) | extra block auto-checked-in; reopens a closed gate | `pnpm verify` |
| 5.5 `/progress` | `features/progress/*` M1 deferred #8 (month-view selected day gets a visual state), #9 (year-view month labels never overlap), #22 (catalog: empty CalendarHeatmap demo, `/dev/components` title from `vi.dev`). | heatmap year/month views; weekly summary bars with values | `pnpm verify && pnpm test:e2e` |
| 5.6 Admin overview + content | `features/admin/*` (`/admin`, `/admin/content`) **Writes ADR-0031.** | red warning for weeks reached within 14 days without notes/lessons; DB-size warnings from `ops_metrics` | `pnpm verify` |
| 5.7 Ops | migration `ops_metrics`; `.github/workflows/{backup,restore-test}.yml` (v1.0 simple daily full dump, `age`, weekly restore test), `app/api/cron/maintenance/route.ts`, `vercel.json` cron, `app/api/health/route.ts` **Writes ADR-0005, ADR-0029, ADR-0034.** | cron idempotent + `CRON_SECRET`; health ok/fail only; **backup and restore-test workflows run against staging** | `pnpm verify` + workflow runs on staging |
| 5.8 Launch **[owner]** | Supabase **prod** project, prod env vars (Vercel production), prod OAuth redirect URLs, first production deploy; dogfooding checklist **Writes ADR-0038.** M1 deferred #17: `global-error.tsx` follows the saved theme. | full e2e against staging; smoke on prod | `pnpm verify:full` + checklist |

**Before any learner reaches week 4 (§0 constraint):** `content-verify` M3b (linked lists, trees,
graph nodes, random-pointer lists) and M3c (design classes) — tasks written just-in-time — and
either W4–W5 notes/lessons written or v1.1 shipped.

### M6 — Admin AI controls + bot API (v1.1)

| Task | Deliverable |
| --- | --- |
| 6.1 | Upstash rate limits (`lib/rate-limit.ts`, fail-open counter in `ops_metrics`) |
| 6.2 | Migrations: `bot_settings`, `bot_runs`, `bot_run_users`, `user_items`, `roadmap_overrides`, `content_publish_requests` + RLS + pgTAP |
| 6.3 | Bot token (hash in DB, rotation UI in `/admin/bot`), `requireBotToken`, kill switch, dry-run | **Writes ADR-0026.**
| 6.4 | `POST /runs` (plan + publish kinds, cap + `deferredUsers`, lazy timeout, resume mode rule), context endpoint (pseudonyms, sanitisation), `PATCH /runs/{runId}` | **Writes ADR-0027.**
| 6.5 | `PUT …/plan` (validation + untouched-plan precedence), AI plan rendering, mode badge, AI flag toggle in `/admin/users` | **Writes ADR-0018.**
| 6.6 | `PUT …/custom-items` + "Mục riêng" tab; `PUT …/overrides` + `effectiveRoadmap` + revoke UI |
| 6.7 | `GET …/content-signals`, publish requests (admin "Xuất bản", public endpoint), `share_notes_with_ai` | **Writes ADR-0024, ADR-0025, ADR-0040.**
| 6.8 | Contract test suite (§6.10) |

### M7 — Claude Code Routine in dry-run (v1.1)

| Task | Deliverable |
| --- | --- |
| 7.1 | `pnpm bot` CLI (`tools/bot/cli.ts`) sharing `lib/bot/contract.ts` |
| 7.2 | `bot/ROUTINE_PROMPT.md`, `.claude/settings.json` deny rules | **Writes ADR-0022.**
| 7.3 | Bot PR workflows: `path-guard`, `bot-content-policy`, `bot-automerge`, stale-PR closer + fixture PR tests; adds `path-guard`, `bot-content-policy`, `content-build` and `content-verify` to the existing `main` ruleset (0.10); pins every GitHub Action by commit SHA (deferred minor #11) **Writes ADR-0023, ADR-0035.** |
| 7.4 **[owner]** | Routine environment (Custom network, API credential, no connectors, schedule 22:30 UTC); fallback workflow (dry-run) | **Writes ADR-0028.**
| 7.5 | Dry-run acceptance week on real data → `dry_run` off, `content_proposals` on |

---

## Part B — M0 step by step

**Branch:** `feat/m0-scaffold` (created in Task 0.1). **Working directory:** repository root.
**Before starting:** `node -v` ≥ 22.12, `pnpm -v` = 11.1.1, `git status` clean.

### Task 0.1: Branch, licenses and README

**Files:**

- Create: `LICENSE`, `content/LICENSE`, `README.md`

**Interfaces:** none.

- [ ] **Step 1: Create the milestone branch**

```bash
git switch -c feat/m0-scaffold
```

- [ ] **Step 2: Write `LICENSE` (MIT, code)**

```text
MIT License

Copyright (c) 2026 khanhnguyendev

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 3: Fetch the official CC BY-NC-SA 4.0 legal code for `content/`** (never retype it)

```bash
mkdir -p content
curl -fsSL https://creativecommons.org/licenses/by-nc-sa/4.0/legalcode.txt -o content/LICENSE
head -1 content/LICENSE && wc -c content/LICENSE
```

Expected: `Attribution-NonCommercial-ShareAlike 4.0 International` and about 20 850 bytes.

- [ ] **Step 4: Write `README.md`**

````markdown
# Học Đều

**Nền tảng học tập dẫn dắt bởi AI** — mỗi ngày một chút, AI giúp bạn tiến đều.

An AI-driven learning platform for Vietnamese IT learners: data-defined tracks (DSA, English for IT
workplaces), a daily plan that only moves forward on days you study, spaced repetition, and — from
v1.1 — a daily AI bot that personalises plans and grows the shared content.

> Status: **M0 (scaffold)**. See the [platform design](docs/plans/2026-09-23-platform-design.md),
> the [design system](docs/design/DESIGN_SYSTEM.md) and the
> [implementation plan](docs/plans/2026-09-24-implementation-plan.md).

## Development

Requirements: Node ≥ 22.12, pnpm 11.

```bash
pnpm install
pnpm dev          # http://localhost:3000
pnpm verify       # typecheck, lint (ESLint + Prettier), unit tests, build
pnpm test:e2e     # Playwright + axe (run `pnpm exec playwright install chromium` once)
```

Contributor and agent rules live in [CLAUDE.md](CLAUDE.md).

## License

- **Code:** [MIT](LICENSE).
- **Learning content** (everything under `content/`): [CC BY-NC-SA 4.0](content/LICENSE) —
  share and adapt with attribution, non-commercially, under the same license.
````

- [ ] **Step 5: Verify and commit**

```bash
test -f LICENSE && head -1 content/LICENSE && grep -c "CC BY-NC-SA 4.0" README.md
git add LICENSE content/LICENSE README.md
git commit -m "chore: add MIT and CC BY-NC-SA 4.0 licenses and README"
```

Expected: the license title line and `1`.

### Task 0.2: Next.js 16 app scaffold

**Files:**

- Create: `package.json`, `pnpm-workspace.yaml`, `.nvmrc`, `tsconfig.json`, `next.config.ts`,
  `postcss.config.mjs`, `app/globals.css`, `app/layout.tsx`, `app/page.tsx`
- Generated: `pnpm-lock.yaml`

**Interfaces:**

- Produces: scripts `dev`, `build`, `start`, `typecheck`; CSS variables `--font-be-vietnam-pro`,
  `--font-jetbrains-mono` on `<html>` (consumed by the tokens in Task 0.4); `<html lang="vi">`;
  `ThemeProvider` with `attribute="class"` (the `.dark` class the tokens use).

- [ ] **Step 1: Write `package.json`, `pnpm-workspace.yaml` and `.nvmrc`**

`package.json`:

```json
{
  "name": "hoc-deu",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@11.1.1",
  "engines": {
    "node": ">=22.12"
  },
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "typecheck": "next typegen && tsc --noEmit"
  }
}
```

`pnpm-workspace.yaml` (pnpm 11 requires an explicit build-script decision; `unrs-resolver` ships
prebuilt bindings, so its postinstall is not needed):

```yaml
allowBuilds:
  unrs-resolver: false
```

`.nvmrc`:

```text
22
```

- [ ] **Step 2: Install the pinned dependencies**

```bash
pnpm add --save-exact next@16.3.6 react@19.3.0 react-dom@19.3.0 next-themes@0.4.6
pnpm add --save-exact -D typescript@6.0.3 @types/react@19.3.0 @types/react-dom@19.3.0 @types/node@22.20.4 tailwindcss@4.3.3 @tailwindcss/postcss@4.3.3
```

Expected: both finish with `Done in …`; no `ERR_PNPM_IGNORED_BUILDS`.

- [ ] **Step 3: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts",
    ".next/dev/types/**/*.ts"
  ],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Write `next.config.ts` and `postcss.config.mjs`**

`next.config.ts`:

```ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
}

export default nextConfig
```

`postcss.config.mjs`:

```js
const config = {
  plugins: { '@tailwindcss/postcss': {} },
}

export default config
```

- [ ] **Step 5: Write the app files**

`app/globals.css` (tokens arrive in Task 0.4):

```css
@import 'tailwindcss';
```

`app/layout.tsx`:

```tsx
import type { Metadata } from 'next'
import { Be_Vietnam_Pro, JetBrains_Mono } from 'next/font/google'
import { ThemeProvider } from 'next-themes'
import './globals.css'

const sans = Be_Vietnam_Pro({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-be-vietnam-pro',
  display: 'swap',
})

const mono = JetBrains_Mono({
  subsets: ['latin', 'vietnamese'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Học Đều',
  description: 'Nền tảng học tập dẫn dắt bởi AI — mỗi ngày một chút, AI giúp bạn tiến đều.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
```

`app/page.tsx` (placeholder; the positioning page is built from patterns in M2 — no `className`
in `app/` pages):

```tsx
export default function HomePage() {
  return (
    <main>
      <h1>Học Đều</h1>
      <p>Nền tảng học tập dẫn dắt bởi AI — mỗi ngày một chút, AI giúp bạn tiến đều.</p>
    </main>
  )
}
```

- [ ] **Step 6: Verify typecheck and build**

```bash
pnpm typecheck && pnpm build
```

Expected: `✓ Types generated successfully`, then `✓ Compiled successfully` and routes `○ /` and
`○ /_not-found`.

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-lock.yaml pnpm-workspace.yaml .nvmrc tsconfig.json next.config.ts postcss.config.mjs app
git commit -m "feat: scaffold Next.js 16 app with Tailwind v4, fonts and theme provider"
```

### Task 0.3: Vitest and `cn()`

**Files:**

- Create: `vitest.config.ts`, `lib/utils.ts`, `lib/utils.test.ts`
- Modify: `package.json` (script `test`)

**Interfaces:**

- Produces: `cn(...inputs: ClassValue[]): string` from `@/lib/utils` (used by every component
  from M1); script `pnpm test` (`vitest run`); the `@` alias in tests.

- [ ] **Step 1: Install and configure Vitest**

```bash
pnpm add --save-exact clsx@2.1.1 tailwind-merge@3.7.0
pnpm add --save-exact -D vitest@5.0.1
npm pkg set scripts.test="vitest run"
```

`vitest.config.ts` (React plugin and jsdom arrive with the first component tests in M1):

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: { alias: { '@': import.meta.dirname } },
  test: {
    environment: 'node',
    include: ['**/*.test.{ts,tsx}'],
    exclude: ['node_modules/**', '.next/**', 'e2e/**'],
  },
})
```

- [ ] **Step 2: Write the failing test** — `lib/utils.test.ts`

```ts
import { describe, expect, it } from 'vitest'
import { cn } from './utils'

describe('cn', () => {
  it('lets a later conflicting utility win', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4')
  })

  it('keeps a token colour and a font size together', () => {
    expect(cn('text-sm', 'text-muted-foreground')).toBe('text-sm text-muted-foreground')
  })

  it('drops falsy values', () => {
    expect(cn('bg-surface', false && 'bg-primary', undefined, null)).toBe('bg-surface')
  })
})
```

- [ ] **Step 3: Run it and watch it fail**

Run: `pnpm test`
Expected: FAIL — `Failed to resolve import "./utils"`.

- [ ] **Step 4: Implement** — `lib/utils.ts`

```ts
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Merge class lists; later Tailwind utilities win over conflicting earlier ones. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
```

- [ ] **Step 5: Run it and watch it pass**

Run: `pnpm test`
Expected: `Tests  3 passed (3)`.

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml vitest.config.ts lib
git commit -m "test: add Vitest and the cn() class helper"
```

### Task 0.4: Design tokens wired into `app/globals.css`

**Files:**

- Create: `tools/guards/tokens-sync.test.ts`
- Modify: `app/globals.css`, `package.json` (`tw-animate-css`)

**Interfaces:**

- Consumes: `docs/design/tokens.css` (generated, approved in gate 2).
- Produces: every token utility (`bg-surface`, `text-muted-foreground`, `bg-track`, `bg-heat-2`,
  `rounded-lg`, `shadow-sm`, `font-sans`, …) and the `.dark` variant; the lint's
  `better-tailwindcss` rules read this file in Task 0.5.

- [ ] **Step 1: Write the failing test** — `tools/guards/tokens-sync.test.ts`

```ts
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(path, 'utf8')
const SPEC = 'docs/design/tokens.css'
const GLOBALS = 'app/globals.css'

/** The token spec without its leading review comment. */
function specBody(): string {
  const css = read(SPEC)
  return css.slice(css.indexOf('*/') + 2).trim()
}

describe('design tokens (docs/design/DESIGN_SYSTEM.md)', () => {
  it('app/globals.css contains the token spec verbatim', () => {
    expect(read(GLOBALS)).toContain(specBody())
  })

  it('imports Tailwind before the tokens', () => {
    const globals = read(GLOBALS)
    expect(globals.indexOf('@import "tailwindcss";')).toBeGreaterThanOrEqual(0)
    expect(globals.indexOf('@import "tailwindcss";')).toBeLessThan(globals.indexOf(':root {'))
  })

  it.each([
    'background',
    'surface',
    'surface-muted',
    'surface-sunken',
    'foreground',
    'muted-foreground',
    'subtle-foreground',
    'border',
    'border-strong',
    'ring',
    'primary',
    'primary-foreground',
    'success',
    'warning',
    'danger',
    'track-1',
    'track-8',
    'heat-0',
    'heat-4',
  ])('defines --%s for light and dark', (token) => {
    const globals = read(GLOBALS)
    const light = globals.slice(globals.indexOf(':root {'), globals.indexOf('.dark {'))
    const dark = globals.slice(globals.indexOf('.dark {'))
    expect(light).toContain(`--${token}:`)
    expect(dark).toContain(`--${token}:`)
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm test tools/guards/tokens-sync.test.ts`
Expected: FAIL — `app/globals.css contains the token spec verbatim` and every `defines --…` case.

- [ ] **Step 3: Generate `app/globals.css` from the spec**

```bash
pnpm add --save-exact -D tw-animate-css@1.4.0
{ printf '@import "tailwindcss";\n@import "tw-animate-css";\n\n'; cat docs/design/tokens.css; } > app/globals.css
```

(`app/globals.css` is the only file allowed to hold visual values. To change a token: edit
`docs/design/assets/palette.py`, run `python3 docs/design/assets/gen_tokens.py`, then re-run this
command. The test keeps the two in sync.)

- [ ] **Step 4: Run the test and the build**

Run: `pnpm test && pnpm build`
Expected: `Tests  24 passed (24)` (3 + 21) and a successful build.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml app/globals.css tools/guards/tokens-sync.test.ts
git commit -m "feat: wire design tokens into globals.css with a sync test"
```

### Task 0.5: ESLint layer and token rules, Prettier

**Files:**

- Create: `eslint.config.mjs`, `tools/guards/eslint-rules.test.ts`, `.prettierrc.json`,
  `.prettierignore`
- Modify: `package.json` (scripts `lint`, `format`)

**Interfaces:**

- Consumes: `app/globals.css` (entry point for `better-tailwindcss`).
- Produces: `pnpm lint` = ESLint (zero warnings) + Prettier check; the layer and token rules every
  later task must satisfy.

- [ ] **Step 1: Install**

```bash
pnpm add --save-exact -D eslint@9.39.5 eslint-config-next@16.3.6 eslint-plugin-better-tailwindcss@4.7.0 prettier@3.9.9 prettier-plugin-tailwindcss@0.8.1
npm pkg set scripts.lint="eslint . --max-warnings=0 && prettier --check ."
npm pkg set scripts.format="prettier --write ."
```

- [ ] **Step 2: Write the failing rule tests** — `tools/guards/eslint-rules.test.ts`

```ts
import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'

const eslint = new ESLint({ cwd: process.cwd() })

async function ruleIds(code: string, filePath: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath })
  return (result?.messages ?? []).map((m) => m.ruleId ?? 'fatal')
}

describe('layer rules (platform design §7.2)', () => {
  it('forbids ui primitives importing patterns', async () => {
    const ids = await ruleIds(
      "import { PageHeader } from '@/components/patterns/page-header'\nexport const x = PageHeader\n",
      'components/ui/button.tsx',
    )
    expect(ids).toContain('no-restricted-imports')
  })

  it('lets ui primitives use lib/utils', async () => {
    const ids = await ruleIds(
      "import { cn } from '@/lib/utils'\nexport const x = cn\n",
      'components/ui/button.tsx',
    )
    expect(ids).not.toContain('no-restricted-imports')
  })

  it('forbids deep imports into another feature', async () => {
    const ids = await ruleIds(
      "import { X } from '@/features/review/components/x'\nexport const y = X\n",
      'features/today/components/plan.tsx',
    )
    expect(ids).toContain('no-restricted-imports')
  })

  it('forbids pages importing ui primitives', async () => {
    const ids = await ruleIds(
      "import { Button } from '@/components/ui/button'\nexport default function P() { return <Button /> }\n",
      'app/(app)/today/page.tsx',
    )
    expect(ids).toContain('no-restricted-imports')
  })

  it('forbids className in pages', async () => {
    const ids = await ruleIds(
      'export default function P() { return <main className="p-4" /> }\n',
      'app/(app)/today/page.tsx',
    )
    expect(ids).toContain('no-restricted-syntax')
  })

  it("forbids 'use client' in pages", async () => {
    const ids = await ruleIds(
      "'use client'\nexport default function P() { return <main /> }\n",
      'app/(app)/today/page.tsx',
    )
    expect(ids).toContain('no-restricted-syntax')
  })

  it('keeps lib/domain pure', async () => {
    const ids = await ruleIds(
      "import { cookies } from 'next/headers'\nexport const n = () => Date.now() + String(cookies)\n",
      'lib/domain/plan/x.ts',
    )
    expect(
      ids.filter((id) => id === 'no-restricted-imports' || id === 'no-restricted-syntax'),
    ).toHaveLength(2)
  })
})

describe('token rules (platform design §7.3)', () => {
  it('rejects arbitrary values', async () => {
    const ids = await ruleIds(
      'export const C = () => <div className="p-[13px]" />\n',
      'components/patterns/c.tsx',
    )
    expect(ids).toContain('better-tailwindcss/no-restricted-classes')
  })

  it('rejects raw palette colours', async () => {
    const ids = await ruleIds(
      'export const C = () => <div className="bg-red-500 hover:text-slate-700" />\n',
      'components/patterns/c.tsx',
    )
    expect(ids.filter((id) => id === 'better-tailwindcss/no-restricted-classes')).toHaveLength(2)
  })

  it('rejects unknown classes', async () => {
    const ids = await ruleIds(
      'export const C = () => <div className="bg-brand-blue" />\n',
      'components/patterns/c.tsx',
    )
    expect(ids).toContain('better-tailwindcss/no-unknown-classes')
  })

  it('accepts semantic token classes', async () => {
    const ids = await ruleIds(
      'export const C = () => <div data-accent="track-1" className="rounded-lg border bg-surface p-4 text-muted-foreground hover:bg-surface-muted data-[state=open]:bg-track-soft" />\n',
      'components/patterns/c.tsx',
    )
    expect(ids).toEqual([])
  })
})
```

- [ ] **Step 3: Run them and watch them fail**

Run: `pnpm test tools/guards/eslint-rules.test.ts`
Expected: FAIL — ESLint finds no configuration (every test fails).

- [ ] **Step 4: Write `eslint.config.mjs`**

```js
import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'
import betterTailwind from 'eslint-plugin-better-tailwindcss'

const PALETTE =
  '(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)'
const TOKEN_HINT = 'Use a semantic token utility (see docs/design/DESIGN_SYSTEM.md).'

// Layer rules (platform design §7.2). Each entry: files → import patterns they must not use.
const UP = (group, message) => ({ group, message })
const NO_APP = UP(['@/app', '@/app/*'], 'Nothing imports from app/ (layer 5).')
const NO_FEATURES = UP(['@/features', '@/features/*'], 'Lower layers must not import features.')
const NO_PATTERNS = UP(
  ['@/components/patterns', '@/components/patterns/*'],
  'components/ui must not import patterns.',
)
const NO_COMPONENTS = UP(['@/components', '@/components/*'], 'lib/ and tools/ are non-UI.')
const ONLY_UTILS_I18N = UP(
  ['@/lib/*', '!@/lib/utils', '!@/lib/i18n', '!@/lib/i18n/*'],
  'This layer may only use lib/utils and lib/i18n from lib/.',
)
const FEATURE_INTERNALS = UP(
  ['@/features/*/*', '!@/features/items/*'],
  'Import other features through their index.ts only.',
)
const NO_UI_IN_PAGES = UP(
  ['@/components/ui', '@/components/ui/*'],
  'Pages compose features and patterns, not ui primitives.',
)
const DOMAIN_ONLY = UP(
  [
    'react',
    'react-dom',
    'react/*',
    'next',
    'next/*',
    '@supabase/*',
    'date-fns',
    'date-fns/*',
    '@date-fns/*',
    '@/lib/*',
    '!@/lib/domain',
    '!@/lib/domain/*',
  ],
  'lib/domain is pure: only lib/domain and zod.',
)

const restrict = (...patterns) => ['error', { patterns }]

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'coverage/**',
    'next-env.d.ts',
    'playwright-report/**',
    'test-results/**',
    'docs/**',
  ]),
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { 'better-tailwindcss': betterTailwind },
    settings: { 'better-tailwindcss': { entryPoint: 'app/globals.css' } },
    rules: {
      'better-tailwindcss/no-unknown-classes': 'error',
      'better-tailwindcss/no-conflicting-classes': 'error',
      'better-tailwindcss/no-restricted-classes': [
        'error',
        {
          restrict: [
            {
              pattern: '\\[[^\\]]*\\](?!:)',
              message: `Arbitrary values are not allowed. ${TOKEN_HINT}`,
            },
            {
              pattern: `^(?:.*:)?(bg|text|border|ring|fill|stroke|outline|decoration|from|via|to|shadow|divide|placeholder|caret|accent)-${PALETTE}-\\d{2,3}$`,
              message: `Raw palette colours are not allowed. ${TOKEN_HINT}`,
            },
            {
              pattern: '^(?:.*:)?(bg|text|border)-(black|white)$',
              message: `Raw black/white are not allowed. ${TOKEN_HINT}`,
            },
          ],
        },
      ],
    },
  },
  {
    files: ['components/ui/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': restrict(NO_APP, NO_FEATURES, NO_PATTERNS, ONLY_UTILS_I18N) },
  },
  {
    files: ['components/patterns/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': restrict(NO_APP, NO_FEATURES, ONLY_UTILS_I18N) },
  },
  {
    files: ['features/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': restrict(NO_APP, FEATURE_INTERNALS) },
  },
  {
    files: ['lib/**/*.{ts,tsx}', 'tools/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': restrict(NO_APP, NO_FEATURES, NO_COMPONENTS) },
  },
  {
    files: ['lib/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': restrict(NO_APP, NO_FEATURES, NO_COMPONENTS, DOMAIN_ONLY),
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']",
          message: 'lib/domain receives `now` as a parameter.',
        },
        {
          selector: "NewExpression[callee.name='Date'][arguments.length=0]",
          message: 'lib/domain receives `now` as a parameter.',
        },
        { selector: "CallExpression[callee.name='fetch']", message: 'lib/domain does no I/O.' },
      ],
    },
  },
  {
    files: ['app/**/*.{ts,tsx}'],
    ignores: ['app/api/**', 'app/dev/**'],
    rules: {
      'no-restricted-imports': restrict(NO_UI_IN_PAGES, FEATURE_INTERNALS),
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXAttribute[name.name='className']",
          message: 'Pages contain no styling logic — compose patterns and features.',
        },
      ],
    },
  },
  {
    files: ['app/**/page.tsx', 'app/**/layout.tsx'],
    ignores: ['app/dev/**'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXAttribute[name.name='className']",
          message: 'Pages contain no styling logic — compose patterns and features.',
        },
        {
          selector: "Program > ExpressionStatement[directive='use client']",
          message:
            "Pages and layouts are Server Components; put 'use client' in an interactive leaf component.",
        },
      ],
    },
  },
  {
    // The root layout sets the font variables on <html>; it is the only className allowed in app/.
    files: ['app/layout.tsx'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "Program > ExpressionStatement[directive='use client']",
          message: 'The root layout is a Server Component.',
        },
      ],
    },
  },
])
```

- [ ] **Step 5: Write the Prettier config**

`.prettierrc.json`:

```json
{
  "semi": false,
  "singleQuote": true,
  "printWidth": 100,
  "trailingComma": "all",
  "plugins": ["prettier-plugin-tailwindcss"],
  "tailwindStylesheet": "./app/globals.css",
  "tailwindFunctions": ["cn", "cva"]
}
```

`.prettierignore`:

```text
.next/
node_modules/
pnpm-lock.yaml
coverage/
playwright-report/
test-results/
docs/
content/LICENSE
app/globals.css
```

- [ ] **Step 6: Format, then run the rule tests and the full lint**

```bash
pnpm format
pnpm test tools/guards/eslint-rules.test.ts
pnpm lint
```

Expected: `Tests  11 passed (11)`; `pnpm lint` prints no problems and
`All matched files use Prettier code style!`.

- [ ] **Step 7: Commit** (check `git status` first — only config, tests and Prettier-reformatted
  source files should be listed; `.env.local` and `docs/credentials/` stay ignored)

```bash
git status --short
git add -A
git commit -m "build: add ESLint layer and token rules with tests, and Prettier"
```

### Task 0.6: Token guard

**Files:**

- Create: `tools/guards/token-guard.ts`, `tools/guards/token-guard.allow.ts`,
  `tools/guards/token-guard.test.ts`

**Interfaces:**

- Produces: `findTokenViolations(file: string, source: string): TokenViolation[]`,
  `scanRepo(root: string, allow: Readonly<Record<string, string>>): TokenViolation[]`,
  `type TokenViolation = { file: string; line: number; rule: string; excerpt: string }`,
  `TOKEN_GUARD_ALLOW` (empty). The repository test fails CI on any hard-coded visual value in
  `app/`, `components/` or `features/` outside `app/globals.css`.

- [ ] **Step 1: Write the empty allow-list** — `tools/guards/token-guard.allow.ts`

```ts
/**
 * Files allowed to break the token guard, each with a reason. Keep this empty; an entry needs a
 * review comment explaining why a token cannot be used.
 */
export const TOKEN_GUARD_ALLOW: Readonly<Record<string, string>> = {}
```

- [ ] **Step 2: Write the failing tests** — `tools/guards/token-guard.test.ts`

```ts
import { describe, expect, it } from 'vitest'
import { TOKEN_GUARD_ALLOW } from './token-guard.allow'
import { findTokenViolations, scanRepo } from './token-guard'

const rules = (file: string, source: string) => findTokenViolations(file, source).map((v) => v.rule)

describe('findTokenViolations', () => {
  it('flags hex colours', () => {
    expect(rules('components/patterns/a.tsx', 'const c = "#1C1917"')).toEqual(['hex-colour'])
  })

  it('flags colour functions', () => {
    expect(rules('features/x/b.tsx', "style={{ color: 'oklch(0.5 0.1 180)' }}")).toContain(
      'colour-function',
    )
  })

  it('flags literal units in style props', () => {
    expect(rules('components/ui/c.tsx', '<div style={{ padding: 12px }} />')).toEqual([
      'style-literal-unit',
    ])
  })

  it('allows CSS custom properties that carry data', () => {
    expect(
      rules('components/patterns/ring.tsx', "<div style={{ '--progress': value }} />"),
    ).toEqual([])
  })

  it('flags !important and inline style tags', () => {
    expect(rules('app/x/page.tsx', '<style>{`a { color: red !important }`}</style>')).toEqual([
      'important',
      'inline-style-tag',
    ])
  })

  it('flags any CSS file except the token file', () => {
    expect(rules('components/patterns/extra.css', '.a {}')).toEqual(['css-file'])
    expect(rules('app/globals.css', ':root { --x: #fff !important; }')).toEqual([])
  })
})

describe('repository', () => {
  it('has no hard-coded visual values outside app/globals.css', () => {
    expect(scanRepo(process.cwd(), TOKEN_GUARD_ALLOW)).toEqual([])
  })
})
```

- [ ] **Step 3: Run them and watch them fail**

Run: `pnpm test tools/guards/token-guard.test.ts`
Expected: FAIL — `Failed to resolve import "./token-guard"`.

- [ ] **Step 4: Implement** — `tools/guards/token-guard.ts`

```ts
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

export type TokenViolation = { file: string; line: number; rule: string; excerpt: string }

const SCANNED_DIRS = ['app', 'components', 'features'] as const
const TOKEN_FILE = 'app/globals.css'

const LINE_RULES: ReadonlyArray<{ rule: string; pattern: RegExp }> = [
  { rule: 'hex-colour', pattern: /#[0-9a-fA-F]{3,8}\b/ },
  { rule: 'colour-function', pattern: /\b(?:rgba?|hsla?|oklch|oklab|lab|lch|color)\(/ },
  { rule: 'important', pattern: /!important/ },
  { rule: 'inline-style-tag', pattern: /<style[\s>]/ },
  { rule: 'style-literal-unit', pattern: /style=\{\{[^}]*\b\d+(?:\.\d+)?(?:px|rem|em|ms|s)\b/ },
]

/** Find hard-coded visual values in one source file (platform design §7.3). */
export function findTokenViolations(file: string, source: string): TokenViolation[] {
  const normalized = file.split(sep).join('/')
  if (normalized === TOKEN_FILE) return []
  if (normalized.endsWith('.css')) {
    return [
      {
        file: normalized,
        line: 1,
        rule: 'css-file',
        excerpt: 'Only app/globals.css may contain CSS.',
      },
    ]
  }
  const violations: TokenViolation[] = []
  source.split('\n').forEach((text, index) => {
    for (const { rule, pattern } of LINE_RULES) {
      if (pattern.test(text)) {
        violations.push({
          file: normalized,
          line: index + 1,
          rule,
          excerpt: text.trim().slice(0, 120),
        })
      }
    }
  })
  return violations
}

/** Scan app/, components/ and features/ under `root`, skipping allow-listed files. */
export function scanRepo(root: string, allow: Readonly<Record<string, string>>): TokenViolation[] {
  const results: TokenViolation[] = []
  for (const dir of SCANNED_DIRS) {
    let entries: string[]
    try {
      entries = readdirSync(join(root, dir), { recursive: true, encoding: 'utf8' })
    } catch {
      continue // the layer does not exist yet
    }
    for (const entry of entries) {
      if (!/\.(tsx?|css|mdx?)$/.test(entry)) continue
      const file = relative(root, join(root, dir, entry))
        .split(sep)
        .join('/')
      if (allow[file]) continue
      results.push(...findTokenViolations(file, readFileSync(join(root, file), 'utf8')))
    }
  }
  return results
}
```

- [ ] **Step 5: Run them and watch them pass**

Run: `pnpm test`
Expected: `Tests  42 passed (42)` (3 + 21 + 11 + 7).

- [ ] **Step 6: Commit**

```bash
git add tools/guards
git commit -m "test: add token guard for hard-coded visual values"
```

### Task 0.7: Playwright and axe smoke test

**Files:**

- Create: `playwright.config.ts`, `e2e/smoke.spec.ts`
- Modify: `package.json` (script `test:e2e`)

**Interfaces:**

- Produces: `pnpm test:e2e` (builds and serves on port 3100); projects `desktop` and `mobile`;
  the WCAG tag set every later e2e test reuses.

- [ ] **Step 1: Install**

```bash
pnpm add --save-exact -D @playwright/test@1.63.0 @axe-core/playwright@4.13.0
npm pkg set scripts.test:e2e="playwright test"
pnpm exec playwright install chromium
```

- [ ] **Step 2: Write `playwright.config.ts`**

```ts
import { defineConfig, devices } from '@playwright/test'

const PORT = 3100

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: `http://localhost:${PORT}`, trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: `pnpm build && pnpm start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
```

- [ ] **Step 3: Write the smoke test** — `e2e/smoke.spec.ts`

```ts
import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`home page (${colorScheme})`, () => {
    test.use({ colorScheme })

    test('renders in Vietnamese with the design tokens applied', async ({ page }) => {
      await page.goto('/')
      await expect(page.locator('html')).toHaveAttribute('lang', 'vi')
      await expect(page.getByRole('heading', { level: 1, name: 'Học Đều' })).toBeVisible()
      const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'))
      expect(isDark).toBe(colorScheme === 'dark')
      const { painted, token } = await page.evaluate(() => {
        const style = getComputedStyle(document.documentElement)
        return {
          painted: style.backgroundColor,
          token: style.getPropertyValue('--background').trim(),
        }
      })
      // Tailwind compiles the OKLCH tokens (it may emit lab()); the page must paint the token colour.
      expect(token).not.toBe('')
      expect(painted).not.toBe('rgba(0, 0, 0, 0)')
    })

    test('has no WCAG 2.1 AA violations', async ({ page }) => {
      await page.goto('/')
      const results = await new AxeBuilder({ page }).withTags(WCAG).analyze()
      expect(results.violations).toEqual([])
    })
  })
}
```

- [ ] **Step 4: Run it**

Run: `pnpm test:e2e`
Expected: `8 passed` (2 tests × 2 themes × 2 projects).

- [ ] **Step 5: Format, lint and commit**

```bash
pnpm format && pnpm lint
git add package.json pnpm-lock.yaml playwright.config.ts e2e
git commit -m "test: add Playwright and axe smoke tests in light and dark"
```

### Task 0.8: `pnpm verify`, CI, Dependabot, CodeQL

**Files:**

- Modify: `package.json` (scripts `verify`, `verify:full`)
- Create: `.github/workflows/ci.yml`, `.github/workflows/codeql.yml`, `.github/dependabot.yml`

**Interfaces:**

- Produces: `pnpm verify` (the milestone gate); CI jobs named `verify` and `e2e` (future required
  checks); CodeQL for JavaScript/TypeScript and Actions.

- [ ] **Step 1: Add the scripts and run the gate locally**

```bash
npm pkg set scripts.verify="pnpm typecheck && pnpm lint && pnpm test && pnpm build"
npm pkg set scripts.verify:full="pnpm verify && pnpm test:e2e"   # task 2.1 adds test:db
pnpm verify
```

Expected: types generated, no lint problems, `Tests  42 passed (42)`, build succeeds.

- [ ] **Step 2: Write `.github/workflows/ci.yml`**

```yaml
name: ci

on:
  pull_request:
  push:
    branches: [main]

permissions:
  contents: read

concurrency:
  group: ci-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  verify:
    name: verify
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v7
      - uses: pnpm/action-setup@v6
      - uses: actions/setup-node@v7
        with:
          node-version-file: .nvmrc
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm verify

  e2e:
    name: e2e
    runs-on: ubuntu-latest
    timeout-minutes: 25
    steps:
      - uses: actions/checkout@v7
      - uses: pnpm/action-setup@v6
      - uses: actions/setup-node@v7
        with:
          node-version-file: .nvmrc
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec playwright install --with-deps chromium
      - run: pnpm test:e2e
      - if: failure()
        uses: actions/upload-artifact@v7
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 7
```

- [ ] **Step 3: Write `.github/workflows/codeql.yml`**

```yaml
name: codeql

on:
  push:
    branches: [main]
  pull_request:
  schedule:
    - cron: '17 3 * * 1'

permissions:
  contents: read

jobs:
  analyze:
    name: analyze (${{ matrix.language }})
    runs-on: ubuntu-latest
    timeout-minutes: 20
    permissions:
      actions: read
      contents: read
      security-events: write
    strategy:
      fail-fast: false
      matrix:
        language: [javascript-typescript, actions]
    steps:
      - uses: actions/checkout@v7
      - uses: github/codeql-action/init@v4
        with:
          languages: ${{ matrix.language }}
      - uses: github/codeql-action/analyze@v4
```

- [ ] **Step 4: Write `.github/dependabot.yml`** (TypeScript and ESLint majors are pinned by
  design — §2.1)

```yaml
version: 2
updates:
  - package-ecosystem: npm
    directory: /
    schedule:
      interval: weekly
    open-pull-requests-limit: 5
    groups:
      minor-and-patch:
        update-types: [minor, patch]
    ignore:
      - dependency-name: typescript
        update-types: ['version-update:semver-major']
      - dependency-name: eslint
        update-types: ['version-update:semver-major']
  - package-ecosystem: github-actions
    directory: /
    schedule:
      interval: weekly
```

- [ ] **Step 5: Format, check the YAML parses, and commit**

```bash
pnpm format && pnpm lint
python3 -c "import yaml,sys; [yaml.safe_load(open(f)) for f in sys.argv[1:]]; print('ok')" .github/workflows/ci.yml .github/workflows/codeql.yml .github/dependabot.yml
git add package.json .github
git commit -m "ci: add verify and e2e workflow, CodeQL and Dependabot"
```

Expected: `ok`.

### Task 0.9: CLAUDE.md, component catalog, ADR scaffolding, M0 checks

**Files:**

- Create: `CLAUDE.md`, `docs/design/COMPONENTS.md`, `docs/adr/0000-template.md`,
  `docs/adr/README.md`
- Modify: `docs/plans/2026-09-23-platform-design.md` (§9.3 "M0 checks" results)

**Interfaces:**

- Produces: the rules every agent and contributor follows; the catalog file M1 fills; the ADR
  format later milestones use.

- [ ] **Step 1: Write `CLAUDE.md`**

````markdown
# Học Đều — rules for agents and contributors

Read before changing anything. Specs: `docs/plans/2026-09-23-platform-design.md` (platform),
`docs/design/DESIGN_SYSTEM.md` (design system), `docs/plans/2026-09-24-implementation-plan.md`
(plan).

## Stack (pinned — do not upgrade majors without asking)

Next.js 16.3 (App Router, Turbopack, `proxy.ts` not `middleware.ts`) · React 19.3 ·
**TypeScript 6.0.x (not 7)** · **ESLint 9.39.x (not 10)** · pnpm 11 · Node ≥ 22.12 · Tailwind CSS
4.3 · shadcn/ui · MDX via `@next/mdx` · Zod 4 · Supabase (`@supabase/ssr`, publishable/secret
keys, `getClaims()` never `getSession()` on the server) · Vitest 5 · Playwright + axe.

## Commands

```bash
pnpm dev            # dev server
pnpm verify         # typecheck → lint (ESLint + Prettier) → unit tests → build — must be green
pnpm test           # Vitest
pnpm test:e2e       # Playwright + axe
pnpm verify:full    # verify + e2e
pnpm format         # Prettier write
```

Later milestones add `pnpm test:db`, `pnpm content:build`, `pnpm content:verify`, `pnpm bot`.

## Component layers (enforced by ESLint — platform design §7.2)

1. **Tokens** — `app/globals.css`, generated from `docs/design/tokens.css`. The only place visual
   values live.
2. **`components/ui`** — shadcn/ui primitives, themed only through tokens. May import `lib/utils`,
   `lib/i18n`.
3. **`components/patterns`** — shared composites (PageHeader, StatCard, EmptyState, …).
4. **`features/<domain>`** — domain components, `queries.ts` (server-only loaders), `actions.ts`
   (`'use server'`), `index.ts` (public API). Other features are imported only via `index.ts`.
5. **`app/`** — routes compose features. **No `className` in pages**, no `components/ui` imports
   in pages.

- **Search `docs/design/COMPONENTS.md` before creating a component.** If two or more places need
  something similar, extract it into `components/patterns`. Update `COMPONENTS.md` and
  `/dev/components` in the same commit as any new or changed component.
- Variants via `cva`, merged with `cn()`; never copy-paste class strings.
- Item rendering goes through the item-type registry (`features/items/registry.ts`); never switch
  on item type in screens.
- Every data-driven component handles loading, empty and error states.

## Visual values

No hex, `rgb()`, `oklch()`, `px`/`rem`/`ms` literals, `!important`, extra CSS files or arbitrary
Tailwind values (`p-[13px]`, `text-[#fff]`) outside `app/globals.css`. Use token utilities
(`bg-surface`, `text-muted-foreground`, `bg-track`, `rounded-lg`). ESLint and the token guard
(`tools/guards`) fail the build otherwise. To change a token: edit
`docs/design/assets/palette.py`, run `python3 docs/design/assets/gen_tokens.py`, regenerate
`app/globals.css`.

## React / Next.js

- **Server Components by default.** `'use client'` only on interactive leaf components — never on
  `page.tsx` or `layout.tsx`. Browser APIs (`window`, `localStorage`, …) only in client components.
- Every server action and route handler calls a guard first (`requireUser`, `requireActive`,
  `requireAdmin`, `requireBotToken`, `requireCronSecret` or `publicRoute()`).
- `lib/domain` is pure TypeScript: no React/Next/Supabase imports, no date library, no
  `Date.now()` / `new Date()` — `now` and `localDay` are parameters.

## Copy and accessibility

- All UI strings are Vietnamese, in `lib/i18n/vi.ts`; technical terms stay English.
  `<html lang="vi">`; wrap English learning content in `lang="en"`.
- WCAG 2.1 AA: visible focus, keyboard access, 44 px touch targets, never colour alone,
  `prefers-reduced-motion` respected. axe runs in CI.

## Safety

- **Never read or commit `.env*`, `docs/credentials/` or any secret.** Never print secrets.
- Per-user data never goes into the repo; `supabase/seed.sql` holds synthetic users only.
- **No new dependencies without asking the owner** (approved list: platform design §7.10).
- Do not pull `v1.1` or `later` features into v1.0 (release scope table, platform design §0).

## Git

- Conventional Commits (`feat:`, `fix:`, `test:`, `docs:`, `ci:`, `build:`, `chore:`,
  `refactor:`).
- Small commits, one reviewable change each; work on a branch and open a PR; CI must be green.
````

- [ ] **Step 2: Write `docs/design/COMPONENTS.md`**

```markdown
# Component catalog

The single list of every component in `components/ui`, `components/patterns` and
`features/*/components`. **Search here before creating a component.** Add or update the entry in
the same commit as the component; the architecture test (M1) fails when an entry is missing.
Every entry is also rendered at `/dev/components`.

## Entry format

### ComponentName

- **Layer:** ui | pattern | feature (`features/<domain>`)
- **File:** `components/…/component-name.tsx`
- **Props:** `prop: Type` — what it does (required props first)
- **Variants:** cva variants and sizes
- **States:** default, hover, focus-visible, disabled, loading; for data-driven components:
  loading, empty, error, ready
- **Usage:** a short TSX example
- **Accessibility:** roles, labels, keyboard behaviour

## ui

_None yet — M1 adds the primitives._

## patterns

_None yet — M1 adds the patterns._

## features

_None yet._
```

- [ ] **Step 3: Write the ADR template and index**

`docs/adr/0000-template.md`:

```markdown
# ADR-NNNN: Title

- **Status:** proposed | accepted | superseded by ADR-XXXX
- **Date:** YYYY-MM-DD
- **Spec:** platform design §x.y

## Context

What forces are at play; what the spec requires.

## Decision

What we do.

## Consequences

What becomes easier, what becomes harder, what we accept.
```

`docs/adr/README.md`:

```markdown
# Architecture decision records

Each decision listed in platform design §9.2 gets a file `NNNN-<slug>.md` (from
`0000-template.md`) in the milestone that implements it. Until then the decision is recorded in
the platform design only.

| ADR | Decision | Written in |
| --- | --- | --- |
| 0001 | Next.js 16 App Router on Vercel Hobby, non-commercial | M0 follow-up |
| 0020 | Intl-only time handling in `lib/domain` | M4 |
| 0021 | Layer rules via ESLint + architecture tests; token guard | M0 follow-up |
| 0002–0040 (rest) | See platform design §9.2 for the full list | per milestone |
```

- [ ] **Step 4: Run the M0 checks and record them**

```bash
curl -sI https://hoc-deu.vercel.app | grep -i x-vercel-error
```

Expected: `x-vercel-error: DEPLOYMENT_NOT_FOUND` (the subdomain is not taken yet; it is claimed
when the Vercel project is created in M5).

Then read the GitHub Actions billing page
(`https://docs.github.com/en/billing/concepts/product-billing/github-actions`) for the artifact
storage rule on public repositories. Replace the "M0 checks (to do)" bullet in §9.3 of
`docs/plans/2026-09-23-platform-design.md` with the three results: Vercel subdomain status (with
the date), the trademark/app-store search result for "Học Đều" (no conflicting learning app found
in the 2026-09-23 search), and the artifact-storage finding with its URL.

- [ ] **Step 5: Verify and commit**

```bash
pnpm format && pnpm verify
git add CLAUDE.md docs
git commit -m "docs: add CLAUDE.md, component catalog, ADR template and M0 check results"
```

Expected: `pnpm verify` green (`docs/` is ignored by ESLint and Prettier; `CLAUDE.md` is formatted by Prettier).

### Task 0.10: Security settings, pull request, CI green

**Files:** none (repository settings and the PR).

**Interfaces:**

- Produces: PR `feat/m0-scaffold → main` with green `verify`, `e2e` and CodeQL checks; secret
  scanning with push protection and Dependabot alerts enabled; a `main` ruleset (PR required,
  required checks `verify` and `e2e`, no force pushes, no deletion, no approving review).

- [ ] **Step 1: Enable the free security features for the public repository**

```bash
gh api -X PATCH repos/khanhnguyendev/hoc-deu \
  -f 'security_and_analysis[secret_scanning][status]=enabled' \
  -f 'security_and_analysis[secret_scanning_push_protection][status]=enabled'
gh api -X PUT repos/khanhnguyendev/hoc-deu/vulnerability-alerts
gh api -X PUT repos/khanhnguyendev/hoc-deu/automated-security-fixes
gh api repos/khanhnguyendev/hoc-deu -q '.security_and_analysis'
```

Expected: `secret_scanning` and `secret_scanning_push_protection` both `"enabled"`.

- [ ] **Step 2: Final local gate**

```bash
pnpm verify:full
git status --short
```

Expected: green; no uncommitted files (`.env.local` and `docs/credentials/` stay ignored).

- [ ] **Step 3: Push and open the PR**

```bash
git push -u origin feat/m0-scaffold
gh pr create --base main --head feat/m0-scaffold --title "M0: scaffold, design tokens, CI, CLAUDE.md" --body-file - <<'EOF'
## Summary
- Next.js 16 + Tailwind v4 scaffold with Be Vietnam Pro / JetBrains Mono and next-themes
- Design tokens from docs/design/tokens.css wired into app/globals.css (sync test)
- ESLint layer + token rules (with rule tests), token guard, Prettier
- Vitest, Playwright + axe (light/dark × desktop/mobile)
- CI (verify, e2e), CodeQL, Dependabot; MIT + CC BY-NC-SA 4.0 licenses; CLAUDE.md

## Verification
- `pnpm verify` and `pnpm test:e2e` green locally
- CI checks green on this PR

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
```

- [ ] **Step 4: Watch CI**

Run: `gh pr checks --watch`
Expected: `verify`, `e2e` and both `analyze` jobs pass. If a check fails, fix it on the branch
(superpowers:systematic-debugging), push, and watch again.

- [ ] **Step 5: Protect `main` with a ruleset** (after the checks above have reported once, so the
  `verify` and `e2e` check names exist)

```bash
gh api -X POST repos/khanhnguyendev/hoc-deu/rulesets --input - <<'EOF'
{
  "name": "main",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["~DEFAULT_BRANCH"], "exclude": [] } },
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    {
      "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 0,
        "dismiss_stale_reviews_on_push": false,
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_review_thread_resolution": false
      }
    },
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": false,
        "required_status_checks": [{ "context": "verify" }, { "context": "e2e" }]
      }
    }
  ]
}
EOF
gh api repos/khanhnguyendev/hoc-deu/rulesets -q '.[] | "\(.name) \(.enforcement)"'
```

Expected: `main active`. From now on every change to `main` — including docs — goes through a PR
with green `verify` and `e2e`. No approving review is required because the owner cannot approve
their own PRs (ADR-0023).

- [ ] **Step 6: Request review and stop**

Run superpowers:requesting-code-review for the branch, address findings, then **stop and hand the
PR to the owner**. Do not merge; do not start M1.

---

## Part B-M1 — Component library, step by step

Written at the start of M1 (2026-09-24) from the code merged in M0 and a throwaway spike
(`shadcn` 4.21 registry, Vitest 5 + jsdom, font subsetting). Executed natively
(superpowers:executing-plans) on `feat/m1-components`, then one fresh end-of-milestone review,
then the PR. The owner reviews this section together with the M1 pull request.

**Owner review (2026-09-24): approved**, including the eight decisions below; the ADR-0001 reading
of "ADR-0011's follow-up" confirmed; the design-system amendments approved (DESIGN_SYSTEM §14). Done
on the same PR before merge, one commit each, test first: deferred minors #10 (ConfirmDialog as an
alert dialog; loading buttons keep focus), #11 (`formatMinutes` vi-VN digits and a safe
fallback), #13 (scrollable sidebar nav), #14 (`Button asChild` honours disabled/loading), #18
(avatar initial = first NFC grapheme), #24 (dialog footer order); ThemeToggle options never wrap;
the heatmap month view below 1024 px or on touch; FilterChip (32 px visual, ≥ 44 px hit area);
Dependabot ignores `@types/node` majors. The remaining deferred M1 minors are assigned below
(tasks 2.1, 2.4, 2.7, 3.3, 5.1, 5.5, 5.8).

**Decisions taken while writing (each is a ledger ruling):**

1. **Component bodies are written during execution, not here.** This part fixes files,
   interfaces (props, variants, exported names), the tests that must fail first, and the code for
   infrastructure (fonts, test setup, `tokens:sync`, CI). Components are adapted from the shadcn
   new-york v4 sources and normalized to tokens under TDD. The plan's author is also the executor,
   so spelling every component body out twice buys nothing.
2. **No `shadcn add`.** shadcn 4.21 installs an unapproved `cn` package with caret versions and
   imports `cn` from it. `components.json` is written by hand; approved dependencies are installed
   with `--save-exact`; `cn` comes from `@/lib/utils`.
3. **Nothing to eject.** The new-york registry does not use `shadcn/tailwind.css`, and
   `tokens.css` already defines every variable shadcn expects, so `app/globals.css` stays
   imports + token block (1.1a adds the markers).
4. **Two layout tokens** are added through `gen_tokens.py`: `--spacing-safe-bottom`
   (`env(safe-area-inset-bottom, 0px)`) and `--spacing-bottom-nav` (56 px + the safe area), because
   the bottom navigation needs `env()` and arbitrary values are banned (task 1.9).
5. **CSS custom properties in `style` are typed** by augmenting `React.CSSProperties` with
   `` `--${string}` `` keys (`lib/react-css.d.ts`), so `style={{ '--progress': v }}` type-checks
   without an `as` cast (the style rule rejects anything but a plain object literal).
6. **CalendarHeatmap tooltip:** each cell carries an `aria-label` and a native `title` (hover), and a
   polite live "detail line" under the grid follows focus, hover and taps — instead of 371
   positioned tooltip elements that would need inline positioning styles. *(Final review: the detail line is visible but not a live region —
   each focused day already announces its label.)*
7. **`/dev/components` in production:** 404 when `VERCEL_ENV === 'production'` until task 2.8 makes
   it admin-only (there is no auth in M1).
8. **Vitest projects:** `*.test.ts` runs in `node`, `*.test.tsx` in `jsdom` with a setup file
   (Testing Library cleanup + the browser APIs Radix needs that jsdom lacks).

**Branch:** `git checkout -b feat/m1-components` from `main` after PR #1 merged (done, with the
plan/spec updates as its first commit).

### Task 1.0: Self-hosted fonts

**Files:**

- Create: `app/fonts/be-vietnam-pro/be-vietnam-pro-{400,500,600,700}.woff2`,
  `app/fonts/be-vietnam-pro/OFL.txt`, `app/fonts/jetbrains-mono/jetbrains-mono-variable.woff2`,
  `app/fonts/jetbrains-mono/OFL.txt`, `app/fonts/README.md`, `app/fonts/fonts.ts`,
  `tools/guards/offline-build.test.ts`, `docs/adr/0001-nextjs-on-vercel-hobby.md`,
  `docs/adr/0032-tooling-pins.md`, `docs/adr/0033-license-split.md`
- Modify: `app/layout.tsx`, `eslint.config.mjs`, `tools/guards/eslint-rules.test.ts`,
  `e2e/smoke.spec.ts`, `.github/workflows/ci.yml`, `README.md`, `docs/adr/README.md`

**Interfaces:**

- Produces: `sans` and `mono` (`next/font/local` results) from `app/fonts/fonts.ts`; the CSS
  variables stay `--font-be-vietnam-pro` and `--font-jetbrains-mono`, so `tokens.css` is unchanged.

- [ ] **Step 1: Write the failing tests**

`tools/guards/offline-build.test.ts`:

```ts
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/** The build must work offline (platform design §2.1, §6.8): fonts are self-hosted. */
const SOURCE_DIRS = ['app', 'components', 'features', 'lib']
const SOURCE = /\.(?:[cm]?[jt]sx?|css)$/
// Split so this file does not match itself.
const BANNED = ['next/font/' + 'google', 'fonts.' + 'googleapis.com', 'fonts.' + 'gstatic.com']
const FONTS = 'app/fonts'

function files(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return files(path)
    return SOURCE.test(name) ? [path] : []
  })
}

describe('offline build (platform design §2.1)', () => {
  it('never loads fonts from Google', () => {
    const hits = SOURCE_DIRS.flatMap(files).flatMap((file) => {
      const text = readFileSync(file, 'utf8')
      return BANNED.filter((needle) => text.includes(needle)).map((needle) => `${file}: ${needle}`)
    })
    expect(hits).toEqual([])
  })

  it('ships every font file the loaders reference, as woff2', () => {
    const loaders = readFileSync(join(FONTS, 'fonts.ts'), 'utf8')
    const paths = [...loaders.matchAll(/path: '\.\/([^']+)'/g)].map((m) => join(FONTS, m[1] ?? ''))
    expect(paths).toHaveLength(5)
    for (const path of paths) {
      expect(readFileSync(path).subarray(0, 4).toString('latin1'), path).toBe('wOF2')
    }
  })

  it('ships the OFL license next to every font family', () => {
    const families = readdirSync(FONTS).filter((d) => statSync(join(FONTS, d)).isDirectory())
    expect(families.sort()).toEqual(['be-vietnam-pro', 'jetbrains-mono'])
    for (const family of families) {
      expect(readFileSync(join(FONTS, family, 'OFL.txt'), 'utf8')).toContain(
        'SIL Open Font License',
      )
    }
  })
})
```

Add to `tools/guards/eslint-rules.test.ts` (inside `describe('layer rules …')`):

```ts
  it('bans next/font/google (the build must work offline)', async () => {
    const ids = await ruleIds(
      "import { Inter } from 'next/font/google'\nexport const f = Inter\n",
      'app/fonts/fonts.ts',
    )
    expect(ids).toContain('no-restricted-imports')
  })
```

Add to `e2e/smoke.spec.ts` (inside the per-scheme `describe`) — a regression guard: it passes
before and after, because `next/font/google` also self-hosts at build time; the build-time
guarantee comes from the architecture test and the CI step:

```ts
    test('loads only self-hosted fonts', async ({ page }) => {
      const hosts: string[] = []
      page.on('request', (request) => hosts.push(new URL(request.url()).hostname))
      await page.goto('/')
      const loaded = await page.evaluate(async () => {
        await document.fonts.ready
        return [...document.fonts].filter((face) => face.status === 'loaded').length
      })
      expect(loaded).toBeGreaterThan(0)
      expect(hosts.filter((h) => /(?:googleapis|gstatic)\.com$/.test(h))).toEqual([])
    })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test tools/guards`
Expected: FAIL — `never loads fonts from Google` lists `app/layout.tsx: next/font/google`; the font
file and license tests fail (no `app/fonts`); the ESLint test fails (no rule).

- [ ] **Step 3: Add the font files**

Source: `github.com/google/fonts` at a pinned commit (record the SHA in `app/fonts/README.md`):
`ofl/bevietnampro/BeVietnamPro-{Regular,Medium,SemiBold,Bold}.ttf`,
`ofl/jetbrainsmono/JetBrainsMono[wght].ttf` and each folder's `OFL.txt` (no Reserved Font Name is
declared, so subsetting is allowed). Subset to Google's `latin` + `vietnamese` ranges in a
throwaway virtualenv (`pip install fonttools brotli` — a local tool, not a project dependency):

```bash
U='U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD,U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,U+01AF-01B0,U+0300-0301,U+0303-0304,U+0308-0309,U+0323,U+0329,U+1EA0-1EF9,U+20AB'
for w in Regular:400 Medium:500 SemiBold:600 Bold:700; do
  pyftsubset "BeVietnamPro-${w%%:*}.ttf" --unicodes="$U" --layout-features='*' --flavor=woff2 \
    --output-file="app/fonts/be-vietnam-pro/be-vietnam-pro-${w##*:}.woff2"
done
pyftsubset 'JetBrainsMono[wght].ttf' --unicodes="$U" --layout-features='*' --flavor=woff2 \
  --output-file=app/fonts/jetbrains-mono/jetbrains-mono-variable.woff2
```

`app/fonts/README.md` records: source repo + commit, font versions (Be Vietnam Pro 1.002,
JetBrains Mono 2.211), license (SIL OFL 1.1, `OFL.txt` per folder), the subset command above, and
"never switch back to `next/font/google` — the build must work offline (platform design §2.1)".

- [ ] **Step 4: Load them with `next/font/local`**

`app/fonts/fonts.ts`:

```ts
import localFont from 'next/font/local'

// Self-hosted so `next build` needs no network (platform design §2.1). Files: see README.md.
export const sans = localFont({
  src: [
    { path: './be-vietnam-pro/be-vietnam-pro-400.woff2', weight: '400', style: 'normal' },
    { path: './be-vietnam-pro/be-vietnam-pro-500.woff2', weight: '500', style: 'normal' },
    { path: './be-vietnam-pro/be-vietnam-pro-600.woff2', weight: '600', style: 'normal' },
    { path: './be-vietnam-pro/be-vietnam-pro-700.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-be-vietnam-pro',
  display: 'swap',
})

export const mono = localFont({
  src: [{ path: './jetbrains-mono/jetbrains-mono-variable.woff2', weight: '100 800', style: 'normal' }],
  variable: '--font-jetbrains-mono',
  display: 'swap',
})
```

`app/layout.tsx`: replace the `next/font/google` import and the two loader calls with
`import { mono, sans } from './fonts/fonts'`.

`eslint.config.mjs`: a block for `**/*.{ts,tsx,js,jsx,mjs}` (before the `lib/domain` block, which
already bans `next/*`) with `no-restricted-imports` → `paths: [{ name: 'next/font/google', message:
'Fonts are self-hosted (app/fonts, next/font/local): the build must work offline (platform design
§2.1).' }]`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm test && pnpm test:e2e`
Expected: all unit tests pass; 10 e2e runs pass (8 + the new font test × 2 projects).

- [ ] **Step 6: Block Google Fonts in CI, record the decision**

`.github/workflows/ci.yml`, `verify` job, before `pnpm verify`:

```yaml
      - name: Block Google Fonts — the build must work offline (platform design §2.1)
        run: echo "0.0.0.0 fonts.googleapis.com fonts.gstatic.com" | sudo tee -a /etc/hosts
```

Write ADR-0001 (Next.js 16 App Router on Vercel Hobby, non-commercial; offline-safe build with
self-hosted fonts), ADR-0032 (tooling pins, including Dependabot ignoring TypeScript/ESLint minors)
and ADR-0033 (license split; fonts under OFL 1.1 in `app/fonts`). `README.md` license section:
one line on the fonts' OFL. `docs/adr/README.md`: link the three files.

- [ ] **Step 7: Verify and commit**

Run: `pnpm verify` — Expected: green.

```bash
git add app/fonts app/layout.tsx eslint.config.mjs tools/guards e2e/smoke.spec.ts \
  .github/workflows/ci.yml README.md docs/adr
git commit -m "feat(fonts): self-host Be Vietnam Pro and JetBrains Mono for an offline build"
```

### Task 1.1: shadcn configuration and React test setup

**Files:**

- Create: `components.json`, `tools/test/setup-dom.ts`, `app/page.test.tsx`
- Modify: `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml` (only if pnpm asks about a new
  build script), `vitest.config.ts`

**Interfaces:**

- Produces: runtime deps `radix-ui`, `class-variance-authority`, `lucide-react`; dev deps
  `@vitejs/plugin-react`, `jsdom`, `@testing-library/react`, `@testing-library/user-event` (all
  §7.10, exact versions). `*.test.tsx` files run in jsdom with automatic cleanup.

- [ ] **Step 1: Write the failing test** — `app/page.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import Home from './page'

it('renders the home page heading in jsdom', () => {
  render(<Home />)
  expect(screen.getByRole('heading', { level: 1, name: 'Học Đều' })).toBeTruthy()
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm test app/page.test.tsx`
Expected: FAIL — `@testing-library/react` cannot be resolved (or `document is not defined`).

- [ ] **Step 3: Install and configure**

```bash
pnpm add --save-exact radix-ui class-variance-authority lucide-react
pnpm add -D --save-exact @vitejs/plugin-react jsdom @testing-library/react @testing-library/user-event
```

`components.json` (hand-written; never run `shadcn add` — decision 2):

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "tailwind": { "config": "", "css": "app/globals.css", "baseColor": "stone", "cssVariables": true, "prefix": "" },
  "iconLibrary": "lucide",
  "aliases": { "components": "@/components", "utils": "@/lib/utils", "ui": "@/components/ui", "lib": "@/lib", "hooks": "@/hooks" }
}
```

`vitest.config.ts`:

```ts
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const exclude = ['node_modules/**', '.next/**', 'e2e/**']

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': import.meta.dirname } },
  test: {
    projects: [
      { extends: true, test: { name: 'node', environment: 'node', include: ['**/*.test.ts'], exclude } },
      {
        extends: true,
        test: {
          name: 'dom',
          environment: 'jsdom',
          include: ['**/*.test.tsx'],
          exclude,
          setupFiles: ['tools/test/setup-dom.ts'],
        },
      },
    ],
  },
})
```

`tools/test/setup-dom.ts`: `afterEach(cleanup)`; polyfill what Radix needs and jsdom lacks —
`ResizeObserver` (no-op class), `window.matchMedia` (returns `matches: false`),
`Element.prototype.{hasPointerCapture,setPointerCapture,releasePointerCapture,scrollIntoView}`
— each only when missing.

- [ ] **Step 4: Run the tests** — `pnpm test` — Expected: all pass (node + dom projects).

- [ ] **Step 5: Verify and commit** — `pnpm verify` green;
  `git commit -m "build(ui): configure shadcn/ui and a jsdom test project"`.

### Task 1.1a: `tokens:sync`

**Files:**

- Create: `tools/tokens/sync.ts`, `tools/tokens/cli.ts`, `tools/tokens/sync.test.ts`
- Modify: `app/globals.css` (markers), `package.json` (`tsx` dev dep, `tokens:sync` script),
  `pnpm-workspace.yaml` (`esbuild: false` under `allowBuilds` — `tsx` works without esbuild's
  install script, verified in the spike), `CLAUDE.md` (commands; token workflow)

**Interfaces:**

- Produces: `syncTokens(globals: string, tokens: string): string` and the markers
  `/* tokens:start */` … `/* tokens:end */`; `pnpm tokens:sync` = regenerate `tokens.css` from
  `palette.py`, then replace only the marked block.

- [ ] **Step 1: Write the failing tests** — `tools/tokens/sync.test.ts`:

```ts
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { END, START, syncTokens } from './sync'

const globals = (body: string) =>
  `@import "tailwindcss";\n\n${START}\n${body}\n${END}\n\n/* shadcn extras */\n.x { color: var(--primary); }\n`

describe('syncTokens', () => {
  it('replaces only the token block', () => {
    const out = syncTokens(globals(':root { --a: 1; }'), ':root { --a: 2; }\n')
    expect(out).toBe(globals(':root { --a: 2; }'))
  })

  it('is idempotent', () => {
    const once = syncTokens(globals('old'), 'new')
    expect(syncTokens(once, 'new')).toBe(once)
  })

  it.each([
    ['missing start', `x\n${END}\n`],
    ['missing end', `${START}\nx\n`],
    ['duplicated start', `${START}\n${START}\nx\n${END}\n`],
    ['end before start', `${END}\nx\n${START}\n`],
  ])('fails clearly on %s', (_, css) => {
    expect(() => syncTokens(css, 'new')).toThrow(/tokens:start|tokens:end/)
  })

  it('keeps the repository in sync', () => {
    const repo = readFileSync('app/globals.css', 'utf8')
    expect(syncTokens(repo, readFileSync('docs/design/tokens.css', 'utf8'))).toBe(repo)
  })
})
```

- [ ] **Step 2: Run to verify they fail** — `pnpm test tools/tokens` — Expected: FAIL, `./sync`
  not found.

- [ ] **Step 3: Implement** — `sync.ts` exports `START = '/* tokens:start — generated from
  docs/design/tokens.css by pnpm tokens:sync; do not edit by hand */'`, `END = '/* tokens:end */'`
  and `syncTokens` (exactly one of each marker, start before end, block replaced with
  `\n${tokens.trim()}\n`). `cli.ts` reads both files, writes `app/globals.css`, prints
  `tokens synced`. Wrap the existing token block in `app/globals.css` with the markers.
  `pnpm add -D --save-exact tsx`; script
  `"tokens:sync": "python3 docs/design/assets/gen_tokens.py && tsx tools/tokens/cli.ts"`.

- [ ] **Step 4: Run to verify they pass** — `pnpm test && pnpm tokens:sync && git diff --exit-code app/globals.css`
  — Expected: tests pass; sync leaves `globals.css` unchanged.

- [ ] **Step 5: CLAUDE.md** — command list gains `pnpm typecheck`, `pnpm lint`, `pnpm build`,
  `pnpm tokens:sync`; "To change a token" becomes: edit `palette.py`, run `pnpm tokens:sync`.

- [ ] **Step 6: Verify and commit** — `pnpm verify`;
  `git commit -m "feat(tokens): tokens:sync regenerates only the token block"`.

### Task 1.2: `lib/i18n` — Vietnamese strings and formatters

**Files:** Create `lib/i18n/vi.ts`, `lib/i18n/vi.test.ts`, `lib/i18n/format.ts`,
`lib/i18n/format.test.ts`.

**Interfaces:**

- Produces: `vi` (`as const`) with groups `common` (close "Đóng", openMenu "Mở menu", loading
  "Đang tải…", retry "Thử lại", cancel "Huỷ", confirm "Xác nhận", skipToContent "Bỏ qua đến nội
  dung", notifications "Thông báo", showTable "Xem dạng bảng", hideTable "Ẩn bảng", previous,
  next, …), `nav` (today "Hôm nay", review "Ôn tập", roadmap "Lộ trình", progress "Tiến độ",
  settings "Cài đặt", admin "Quản trị", account "Tài khoản", signOut "Đăng xuất", collapse "Thu
  gọn", expand "Mở rộng"), `theme` (light "Sáng", dark "Tối", system "Theo hệ thống", label
  "Giao diện"), `status` (§3.3: notStarted "Chưa học", weak "Yếu", ok "Ổn", strong "Vững",
  mastered "Thành thạo", skipped "Đã bỏ qua"), `block` (done "Xong", partial "Một phần", skipped
  "Bỏ qua"), `streak` (suffix "ngày liên tiếp"), `heatmap` (legend ranges, "phút", weekday
  abbreviations T2…CN), `states` (errorTitle "Không tải được dữ liệu", notFoundTitle "Không tìm
  thấy trang", notFoundBody, backHome "Về trang chủ", globalErrorTitle).
- Produces: `formatMinutes(n)` ("45 phút", "1 giờ", "1 giờ 15 phút"), `formatNumber(n)` (vi-VN,
  decimal comma), `formatDay(isoDay)` and `formatDayLong(isoDay)` for `YYYY-MM-DD` local days
  (formatted in UTC so the day never shifts), `formatMonth(isoDay)`.

- [ ] **Step 1: Failing tests** — `vi.test.ts`: every key the M1 components use exists and is a
  non-empty string; **[RF-3]** every string equals its NFC form; no string has leading/trailing
  spaces. `format.test.ts`: the examples above, `formatNumber(12.4) === '12,4'`, `formatDay` of
  `2026-01-01` is the same day in every `TZ`.
- [ ] **Step 2: RED** — `pnpm test lib/i18n` — modules missing.
- [ ] **Step 3: Implement.** **Step 4: GREEN.**
- [ ] **Step 5: Commit** — `git commit -m "feat(i18n): Vietnamese UI strings and formatters"`.

### Task 1.3: ui — Button, Input, Label, Textarea

**Files:** Create `components/ui/{button,input,label,textarea}.tsx` and colocated `*.test.tsx`;
`lib/react-css.d.ts` (decision 5).

**Interfaces:**

- `Button` — props `ComponentProps<'button'> & VariantProps<typeof buttonVariants> & { asChild?:
  boolean; loading?: boolean }`; variants `primary` (default) | `secondary` | `outline` | `ghost` |
  `destructive` | `link`; sizes `sm` (h-9, desktop only) | `md` (h-11, default) | `lg` (h-12) |
  `icon` (size-11). `loading`: `aria-busy`, disabled, spinner (`Loader2`, `aria-hidden`), children
  kept (invisible) so the width does not change. Renders `data-variant` / `data-size`. Exports
  `buttonVariants` for link-styled buttons in patterns.
- `Input`, `Textarea` — 44 px (`h-11`; textarea `min-h-24`), `border-border-strong`,
  `rounded-md`, `bg-surface`, `text-base` (no iOS zoom), `placeholder:text-subtle-foreground`,
  `aria-invalid:border-danger`.
- `Label` — Radix Label, `text-sm font-medium`.
- Focus: the global `:focus-visible` ring from `tokens.css`; components never set `outline-none`.

- [ ] **Step 1: Failing tests** — each Button variant and size renders its data attributes and
  classes (`h-11` default); disabled; loading keeps children, sets `aria-busy`, is disabled, spinner
  `aria-hidden`; `asChild` renders an `<a>` with the button classes; no `outline-none` anywhere;
  `Input`/`Textarea` found via `getByLabelText` with `Label htmlFor`; `aria-invalid` passes through.
- [ ] **Step 2: RED** — `pnpm test components/ui`. **Step 3: Implement.** **Step 4: GREEN** +
  `pnpm lint` (token rules pass on every class).
- [ ] **Step 5: Commit** — `feat(ui): Button, Input, Label and Textarea`.

### Task 1.4: ui — Card, Badge, Separator, Skeleton, Progress, Tooltip

**Files:** `components/ui/{card,badge,separator,skeleton,progress,tooltip}.tsx` + tests.

**Interfaces:**

- `Card`, `CardHeader`, `CardTitle` (`text-xl font-semibold`), `CardDescription`, `CardAction`,
  `CardContent`, `CardFooter`; `Card` prop `interactive?: boolean` (`hover:shadow-sm`). Padding
  per DESIGN_SYSTEM §5 (`p-4 md:p-5 lg:p-6`).
- `Badge` — `tone`: `neutral` | `primary` | `success` | `warning` | `danger` | `track` |
  `outline`; `rounded-sm text-xs font-medium`; `asChild`.
- `Separator` (Radix), `Skeleton` (`animate-pulse bg-surface-sunken`, `aria-hidden`).
- `Progress` (Radix) — `value` clamped to 0–100, `tone`: `primary` | `track`; the indicator moves
  with a transform driven by `style={{ '--progress-remaining': … }}` (opacity/transform only, §7).
- `Tooltip`, `TooltipTrigger`, `TooltipContent`, `TooltipProvider` (Radix;
  `bg-foreground text-background`, `text-xs`).

- [ ] **Step 1: Failing tests** — Card slots render; each Badge tone sets `data-tone`; Progress
  exposes `role="progressbar"` with `aria-valuenow="40"` and clamps 140 → 100; Skeleton is
  `aria-hidden`; Tooltip content appears on keyboard focus of the trigger.
- [ ] **Steps 2–4:** RED, implement, GREEN (+ `pnpm lint`).
- [ ] **Step 5: Commit** — `feat(ui): Card, Badge, Separator, Skeleton, Progress and Tooltip`.

### Task 1.5: ui — Dialog, Sheet, DropdownMenu, Tabs, ToggleGroup, Toaster

**Files:** `components/ui/{dialog,sheet,dropdown-menu,tabs,toggle-group,toaster}.tsx` + tests;
`pnpm add --save-exact sonner`.

**Interfaces:**

- `Dialog`, `DialogTrigger`, `DialogContent` (`showCloseButton?`, close button labelled
  `vi.common.close`), `DialogHeader`, `DialogFooter`, `DialogTitle`, `DialogDescription`,
  `DialogClose`. Scrim `bg-background/50` (DESIGN_SYSTEM §6); content `rounded-xl bg-surface
  shadow-md`, centred with `inset-x-4 top-1/2 mx-auto max-w-lg -translate-y-1/2`; enter
  `duration-(--duration-slow) ease-enter`, exit `duration-(--duration-exit) ease-exit`.
- `Sheet` family — Radix Dialog with `side`: `bottom` (default, mobile) | `right` | `left` |
  `top`; bottom sheet `rounded-t-xl max-h-4/5 overflow-y-auto`.
- `DropdownMenu` family — `Trigger`, `Content`, `Item` (`variant`: `default` | `destructive`),
  `Label`, `Separator`, `Group`, `RadioGroup`, `RadioItem`; items `min-h-11` (44 px targets).
- `Tabs` family — list `bg-surface-muted`, triggers `min-h-11`, active `bg-surface`.
- `ToggleGroup`, `ToggleGroupItem` — segmented control (`min-h-11`; on: `bg-primary-soft
  text-primary-soft-foreground`).
- `Toaster` ('use client', `sonner`): 4 s, bottom-centre below 768 px and bottom-right above,
  `containerAriaLabel={vi.common.notifications}`, theme from `next-themes`, colours through CSS
  custom properties only; re-exports `toast`.

- [ ] **Step 1: Failing tests** — Dialog: opens from its trigger, focus moves inside, Tab stays
  inside, `Esc` closes and focus returns to the trigger, close button named "Đóng"; Sheet: same +
  `data-side`; DropdownMenu: opens with Enter, items are `menuitem`s, `Esc` closes; Tabs: ArrowRight
  activates the next tab; ToggleGroup: single choice, `aria-checked` moves; Toaster: `toast('Đã
  lưu')` shows the text in a region labelled "Thông báo".
- [ ] **Steps 2–4:** RED, implement, GREEN (+ `pnpm lint`).
- [ ] **Step 5: Commit** — `feat(ui): Dialog, Sheet, DropdownMenu, Tabs, ToggleGroup and Toaster`.

### Task 1.6: patterns — PageHeader, Section, StatCard, StatusPill, StreakBadge, ProgressRing

**Files:** `components/patterns/{page-header,section,stat-card,status-pill,streak-badge,progress-ring}.tsx`
+ tests.

**Interfaces:**

- `PageHeader({ title, description?, actions? })` — `h1` `text-2xl md:text-3xl font-semibold`;
  actions right on ≥ 768 px, stacked below on mobile.
- `Section({ title, description?, actions?, children })` — `section` labelled by its `h2`.
- `StatCard({ label, value, hint?, icon? })` — value `font-mono tabular-nums`.
- `StatusPill({ status, size? })` — `status`: `not-started` | `weak` | `ok` | `strong` |
  `mastered` | `skipped` | `block-done` | `block-partial` | `block-skipped`; colours, lucide icon
  and label exactly as DESIGN_SYSTEM §3.3; `size`: `sm` (h-6) | `md` (h-8, filter chips); icon
  `aria-hidden`, label visible. Exports `STATUS_PILL` (the mapping) for the catalog.
- `StreakBadge({ days })` — `Flame` + number (`font-mono tabular-nums`) + "ngày liên tiếp".
- `ProgressRing({ value, label, tone?, size? })` — SVG, `role="progressbar"`, `aria-valuenow`,
  `aria-label={label}`; `tone`: `primary` | `track` (`stroke-primary` / `stroke-track` on a
  `stroke-surface-sunken` track); the arc via the SVG `strokeDashoffset` attribute.

- [ ] **Step 1: Failing tests** — StatusPill renders the §3.3 icon (lucide class) and Vietnamese
  label for **every** status; PageHeader renders one `h1` and the actions; Section is a region
  named by its title; StreakBadge text "12 ngày liên tiếp"; ProgressRing clamps and exposes
  `aria-valuenow`; StatCard prints the value.
- [ ] **Steps 2–4:** RED, implement, GREEN (+ `pnpm lint`).
- [ ] **Step 5: Commit** — `feat(patterns): headers, stats, status pills and progress ring`.

### Task 1.7: patterns — states, ConfirmDialog, DataList, Banner + root error pages

**Files:** `components/patterns/{empty-state,error-state,loading-state,data-state,confirm-dialog,data-list,banner}.tsx`
+ tests; `app/not-found.tsx`, `app/error.tsx`, `app/global-error.tsx`; `e2e/not-found.spec.ts`.

**Interfaces:**

- `EmptyState({ icon, title, description?, action? })` — `action`: `{ label, href }` (renders a
  `next/link` styled with `buttonVariants`) or `{ label, onClick }` — so pages (which may not import
  `components/ui` or use `className`) can still offer the next step.
- `ErrorState({ title?, description?, onRetry? })` — default title `vi.states.errorTitle`, retry
  button "Thử lại".
- `LoadingState({ variant?: 'list' | 'card' | 'page', rows? })` — skeletons shaped like content;
  `role="status"` with an `sr-only` "Đang tải…".
- `type DataState<T>` (§7.5) and `DataState({ state, loading?, empty, children })` — `children:
  (data: T) => ReactNode`; `error` renders `ErrorState` with `state.retry`.
- `ConfirmDialog({ open, onOpenChange, title, description, confirmLabel, tone?, pending?,
  onConfirm })` ('use client').
- `DataList({ items, getKey, renderItem, empty })` — `ul` rows `min-h-11`, dividers, `empty` when
  the list is empty.
- `Banner({ tone: 'warning' | 'danger' | 'info', children, action? })` — icon + one sentence + one
  action (DESIGN_SYSTEM §9).
- Root pages (deferred minor #8): `not-found.tsx` → `EmptyState` "Không tìm thấy trang" with "Về
  trang chủ" → `/`; `error.tsx` ('use client', Next 16 `retry` prop) → `ErrorState`;
  `global-error.tsx` → its own `<html lang="vi"><body>`, imports `./globals.css` and the fonts,
  `ErrorState`.

- [ ] **Step 1: Failing tests** — DataState renders each of the four states (loading → status,
  empty → the given node, error → "Thử lại" calls `retry`, ready → children with data);
  EmptyState with `href` renders a link; ConfirmDialog calls `onConfirm` and disables while
  `pending`; DataList renders rows or `empty`; Banner renders its tone icon and action; e2e: an
  unknown URL returns 404 with the Vietnamese heading and a link to `/`, axe clean.
- [ ] **Steps 2–4:** RED (`pnpm test components/patterns && pnpm test:e2e e2e/not-found.spec.ts`),
  implement, GREEN.
- [ ] **Step 5: Commit** — `feat(patterns): loading, empty and error states; root error pages`.

### Task 1.8: pattern — CalendarHeatmap

**Files:** `components/patterns/calendar-heatmap/{index.tsx,year-view.tsx,month-view.tsx,legend.tsx,table-view.tsx,levels.ts,dates.ts}`
+ `levels.test.ts`, `dates.test.ts`, `calendar-heatmap.test.tsx`.

**Interfaces:**

- `CalendarHeatmap({ days, today, label })` ('use client') — `days: { day: string; minutes:
  number }[]` (`YYYY-MM-DD` local days from the caller; the pattern never reads the clock),
  `today: string`.
- `levelFor(minutes)` → 0 (0) | 1 (1–15) | 2 (16–40) | 3 (41–75) | 4 (> 75); `bg-heat-N`; dots on
  levels ≥ 1 (`bg-foreground/40` on light levels, `bg-background/70` on dark levels — per theme as
  in `preview.html`); today `ring-2 ring-ring`.
- Date helpers in `dates.ts` (UTC arithmetic on `YYYY-MM-DD`; weeks start Monday) — the pattern
  may not import `lib/domain`.
- **Year view** (`hidden md:block`): 7 rows × up to 53 week columns ending at `today`, `size-3`
  cells; roving `tabIndex`: Arrow Left/Right = ∓7 days, Up/Down = ∓1 day, Home/End; each cell
  `aria-label` "3 tháng 2, 2026: 45 phút" and `title` (hover).
- **Month view** (`md:hidden`): 7 columns of `size-11` (44 px) day buttons with the day number;
  previous/next month buttons; horizontal swipe (pointer delta ≥ 40 px); tap selects a day.
- Detail line (`aria-live="polite"`) follows focus, hover and taps (decision 6); legend with the
  five ranges; "Xem dạng bảng" toggles a table of active days (date, minutes).

- [ ] **Step 1: Failing tests** — `levelFor` boundaries (0, 1, 15, 16, 40, 41, 75, 76); date
  helpers (week start, month grid, ±days across month/year ends); year view: last column ends at
  today, today has `aria-current="date"`, ArrowLeft moves focus 7 days back and updates the detail
  line, only active days have dots; month view: cells `size-11`, prev/next and a swipe change the
  month heading, tapping a day shows its minutes; legend has 5 items; the table lists active days.
- [ ] **Steps 2–4:** RED, implement, GREEN (+ `pnpm lint`).
- [ ] **Step 5: Commit** — `feat(patterns): CalendarHeatmap with year, month and table views`.

### Task 1.9: pattern — AppShell (+ ThemeToggle, layout tokens)

**Files:** `components/patterns/app-shell/{index.tsx,sidebar.tsx,bottom-nav.tsx,top-bar.tsx,account-menu.tsx,nav-items.ts}`,
`components/patterns/theme-toggle.tsx` + tests; `docs/design/assets/gen_tokens.py` →
`tokens.css` → `pnpm tokens:sync` (decision 4). *(Final review: no `viewport-fit=cover` — the
browser keeps content in the safe areas; root scroll padding keeps focus clear of the bars.)*

**Interfaces:**

- `AppShell({ user: { name }, isAdmin, title, onSignOut?, children })` ('use client' leaf parts
  only): skip link "Bỏ qua đến nội dung" → `#main`; **< 1024 px** sticky top bar (title + account
  menu) and a bottom nav (`h-14 pb-safe-bottom`, 5 items, 24 px icons + label); `main` gets
  `pb-bottom-nav lg:pb-0`; **≥ 1024 px** sidebar `w-60`, collapsible to `w-16` (toggle with
  `aria-expanded`), admin links (Quản trị, Người dùng, Nội dung) only when `isAdmin`; content
  `max-w-app`.
- `NAV_ITEMS`: Hôm nay `/today` (`Sun`), Ôn tập `/review` (`RotateCcw`), Lộ trình `/tracks`
  (`Map`), Tiến độ `/progress` (`BarChart3`), Cài đặt `/settings` (`Settings`); active item
  (pathname match via `usePathname`) gets `aria-current="page"`, `text-primary` and
  `bg-primary-soft`.
- `AccountMenu` — name, theme radio group (Sáng / Tối / Theo hệ thống), "Quản trị" → `/admin`
  only when `isAdmin`, "Đăng xuất" → `onSignOut`.
- `ThemeToggle` — `ToggleGroup` of the three themes (`next-themes`), reused by settings (M2).

- [ ] **Step 1: Failing tests** (mock `next/navigation` and `next-themes`) — 5 nav items in both
  navs; `aria-current="page"` on the active one only; admin entry in the account menu and admin
  links in the sidebar only when `isAdmin`; collapse toggles `aria-expanded`; choosing "Tối" calls
  `setTheme('dark')`; the skip link targets `#main`.
- [ ] **Steps 2–4:** RED, implement, GREEN (+ `pnpm lint`, tokens-sync tests).
- [ ] **Step 5: Commit** — `feat(patterns): AppShell with sidebar, bottom nav and account menu`.

### Task 1.10: `/dev/components`, catalog guard, rule and theme tests

**Files:** `app/dev/components/{page.tsx,registry.tsx,demos/*.tsx}`, `docs/design/COMPONENTS.md`,
`tools/guards/component-catalog.test.ts`, `e2e/components.spec.ts`, `e2e/smoke.spec.ts`,
`tools/guards/eslint-rules.test.ts`, `docs/adr/0021-layer-rules-and-guards.md`.

**Interfaces:**

- `CATALOG: { name, layer: 'ui' | 'patterns' | 'features', file, demos: { title, render }[] }[]`
  in `registry.tsx`; the page renders a two-pane layout (entry list + demos with every variant
  and state) and a `ThemeToggle`; `notFound()` when `VERCEL_ENV === 'production'` (decision 7).
- A **component file** is `components/{ui,patterns}/*.tsx`, `components/patterns/<name>/index.tsx`
  or `features/*/components/**/*.tsx`, excluding `*.test.tsx`; files beside a pattern's
  `index.tsx` are its internals.

- [ ] **Step 1: Failing tests** — `component-catalog.test.ts`: every component file has a
  `COMPONENTS.md` entry whose `File:` line names it and a `CATALOG` entry with the same `file`
  (read as text, no React import in node), and every catalog `file` exists; `eslint-rules.test.ts`
  (deferred minor #7): allowed cases for every layer — patterns → ui, features → ui/patterns/lib,
  a feature's own files, app → a feature's `index.ts` and patterns, `lib` → `lib`, `tools` →
  `lib`, `app/dev` → ui; `e2e/components.spec.ts`: every catalog entry's heading is visible and axe
  finds no violations in light and dark (desktop and mobile projects); `e2e/smoke.spec.ts`
  (deferred minor #9): the painted background differs between light and dark.
- [ ] **Steps 2–4:** RED, implement (catalog entries for every component from 1.3–1.9), GREEN.
- [ ] **Step 5: ADR-0021** — layer rules via the in-repo `layers/imports` rule, style/token rules,
  architecture tests (catalog, offline build, tokens sync); link it in `docs/adr/README.md`.
- [ ] **Step 6: Verify and commit** — `pnpm verify && pnpm test:e2e`;
  `feat(dev): component catalog with axe checks and catalog guard`.

### M1 finish

1. `pnpm verify:full` green; `git status` clean.
2. Fresh end-of-milestone review (most capable model) over `main..feat/m1-components`; one fix pass
   (each fix RED → GREEN, suite green); minors ledgered.
3. Push, open the PR "M1: component library + /dev/components", CI green (`verify` with Google
   Fonts blocked, `e2e`, CodeQL). **Stop for the owner's review** — do not merge, do not start M2.

## Part B-M2 — Auth, onboarding, settings, step by step

Written at the start of M2 (2026-09-24) from the code merged in M0–M1 (PR #1, PR #3) and a
throwaway spike of the Supabase tooling (CLI, `config.toml`, seed users, pgTAP, keys — findings in
task 2.1). Executed **subagent-driven** (superpowers:subagent-driven-development): a fresh
implementer and a fresh reviewer per task, then one whole-branch review on the most capable model,
then the PR. **Owner review (2026-09-24): approved** with three must-fix and five should-fix changes,
applied below (MF1 bootstrap only never-processed profiles — decision 23; MF2 schema invariants
test — 2.1 and every migration task; MF3 schedule history enforced in the database — 2.4; SF4
`id_conflict` in `apply_event` — 2.5b; SF5 `db` as a required check — M2 finish; SF6 staging
`db push` after merging a migration — 2.2; SF7 no `lib/env` / `lib/supabase/admin` in client
modules — 2.6; SF8 `Asia/Saigon` in the parity fixtures — 2.3).

**Branch:** `feat/m2-auth` from `main` at `c2a9583` (M1 merged); this section is its first commit.

**Execution order:** 2.1 → 2.3 → 2.4 → 2.5 → 2.5b → 2.6 → 2.6a → 2.7a → 2.7b → 2.8 → 2.9 → 2.10 →
2.11 → 2.11b → 2.2 (runbook). Each task is one reviewable change (one commit unless it says two) and ends
with its verification command green.

**Decisions taken while writing (each is a ledger ruling; the owner can overturn any):**

1. **Admin functions move from 2.4 to a new task 2.5b.** `admin_set_status`, `admin_set_role` and
   `admin_bootstrap` write audit events, and `events` is created in 2.5. Task 2.5 is split: **2.5**
   = `events`, `event_quota`, triggers, `local_day` SQL + parity, payload schemas (ADR-0030);
   **2.5b** = `apply_event`, `apply_system_event`, admin functions, the TypeScript apply helpers
   (ADR-0007). The AI-flag function `admin_set_ai_flag` is v1.1 (§0 release table) and is not
   built.
2. **New task 2.6a — form and focus-page primitives** (Checkbox, RadioGroup, NativeSelect,
   FocusLayout, FormField, FormErrorSummary, StepIndicator, ChoiceCard), because sign-in, pending,
   onboarding and settings all need them, and a component must exist (with its catalog entry)
   before its first consumer.
3. **2.11 is split** into **2.11** (settings) and **2.11b** (account deletion + privacy text): two
   independent review surfaces.
4. **2.2 runs last and only its repo part runs in the loop:** the runbook `docs/ops/staging.md`
   (no secrets). The owner's steps — Supabase staging project, Vercel project, Google/GitHub OAuth
   apps, the real Google and GitHub sign-in on a staging preview (2.7a) — happen at the PR stop and
   are listed in the PR description as open owner checks.
5. **Schedules.** A user without a `schedule_versions` row uses the default
   `{ Asia/Ho_Chi_Minh, 04:00 }`. The **first** schedule (onboarding) takes effect immediately
   (`effectiveAt` = the server's `now`), because no past day exists to rewrite; every later change
   takes effect at the **next day start** of the schedule in force (§5.9). `day_starts_at` is
   limited to **00:00–12:00 in 30-minute steps** (DB check + Zod).
6. **Time-zone IDs are canonicalised.** Node 22.17 (ICU 77.1, tz 2025b — observed 2026-09-24)
   reports `Asia/Saigon` from `resolvedOptions()` and omits `Asia/Ho_Chi_Minh` from
   `Intl.supportedValuesOf('timeZone')`; browsers may do the same. `canonicalTimeZone()` maps the
   CLDR legacy aliases to IANA names (`Asia/Saigon` → `Asia/Ho_Chi_Minh`, …) before anything is
   shown or stored, and the database validates every stored zone against `pg_timezone_names`.
7. **Theme stays client-side** (`next-themes`, local storage). `profiles` has no theme column, so no
   `settings.changed` event is emitted for the theme in v1.0; the payload field stays in the schema
   for later.
8. **`apply_event` in M2 applies state-table events only** (`track.*` except `reset`,
   `schedule.changed`, `settings.changed`); every other learner type raises `not_implemented`
   until M4/M5, and `p_changes` / `p_expected` must be empty (derived tables arrive in 4.9). The Zod
   payload schemas for **every** §4.4 type exist from 2.5.
9. **Event IDs are derived per request.** Every form that emits events carries a `requestId`: a
   UUID the **server page creates on each render** and passes as a prop (never `useState` in the
   client — that would repeat ids after a save and mismatch on hydration). The server derives each
   event id as UUIDv5(`requestId`, a stable key such as `track.enrolled:dsa`). A double submit or a
   retry within one render records each event once (groundwork for RF-2); a successful save
   revalidates the page, which brings a fresh `requestId`, so the next change is a new event.
10. **`requireOnboarded()`** (the `(app)` group: `requireActive` + onboarded) and
    **`requireDevAccess()`** (`/dev/*`: admin-only in production) join the DAL, the guard list in
    `CLAUDE.md` and the architecture test. `requireDevAccess` and the proxy read
    `process.env.VERCEL_ENV` directly: `/dev/*` is prerendered at build time, where no runtime
    secrets exist.
11. **No browser Supabase client in M2** (`lib/supabase/client.ts`) and no client env schema
    (§2.3 and Part A 2.6 list them): nothing client-side talks to Supabase yet; both arrive with
    their first consumer. `lib/env.ts` is **not** `server-only` (the proxy and `instrumentation.ts`
    import it, and the `server-only` package throws outside the `react-server` condition); secrets
    stay safe because only `NEXT_PUBLIC_*` values are ever inlined into client bundles, and the
    secret-key client lives behind `server-only` in `lib/supabase/admin.ts`.
12. **`yaml` is a runtime dependency** (approved package, §7.10): the M2 manifest loader reads
    `content/tracks/*/track.yaml` at request time, and `next.config.ts` ships those files with
    `outputFileTracingIncludes`. M3's generated catalog may move it back to `devDependencies`.
13. **Placeholders:** `/today` is a placeholder until 5.1; `/onboarding` is a placeholder in 2.7a and
    becomes the wizard in 2.10; `/admin` redirects to `/admin/users` until 5.6.
14. **End-to-end tests create their own users** through the local admin API (secret key of the
    local stack) — one user per test, so the parallel desktop and mobile projects never race.
    `supabase/seed.sql` keeps three synthetic users for manual local use only.
15. **Playwright always targets the local stack:** `playwright.config.ts` reads `supabase status`
    and passes the URL and keys to the web server and the tests explicitly, so a developer's
    `.env.local` can never point e2e at a remote project (process env wins over `.env*` files).
16. **Playwright traces** stay `retain-on-failure`, uploaded only when a job fails, kept 7 days:
    they hold synthetic local users and the local stack's default keys only (M1 follow-up at 2.1).
17. **Admin actions never target the acting admin** (no self-lockout). Status transitions:
    `pending → active | rejected`, `active → suspended`, `suspended | rejected → active`.
18. **Tracks in settings:** add, pause, resume and remove (state events). "Bắt đầu lại"
    (`track.reset`) needs derived rows to clear, so it moves to Part A: `apply_event` handles it in
    4.9 and the button ships in 5.4 (both rows updated).
19. **`admin_list_users()`** is added in 2.8: the approval queue needs e-mail addresses from
    `auth.users`; `admin_user_overview()` stays the M5 aggregate.
20. **Site URL:** `NEXT_PUBLIC_SITE_URL` on production and locally; on Vercel previews the OAuth
    `redirectTo` uses `https://$VERCEL_BRANCH_URL` (the owner allow-lists the preview wildcard in
    the staging project, 2.2).
21. **`CRON_SECRET` is optional** in `lib/env.ts` until task 5.7 adds the cron route.
22. **Onboarding ranges:** minutes per track 10–240 in steps of 5; a start date in the past becomes
    today, a future start date may be at most 60 days ahead.
23. **Bootstrap touches only a never-processed profile** (owner review MF1): `admin_bootstrap`
    promotes only when `role = 'learner' AND status = 'pending' AND approved_at IS NULL`; for any
    other profile it is a no-op. So a suspended admin stays suspended, a demoted listed admin stays a
    learner, and a rejected listed e-mail stays rejected — an admin decision is never overridden by
    the env list. If no active admin remains, the runbook's break-glass SQL restores one (2.2,
    ADR-0004).
24. **Task 2.7 is split** into **2.7a** (sign-in, OAuth callback, test login, bootstrap, seed, the
    guarded route groups with `loading.tsx` / `error.tsx` and placeholders) and **2.7b** (pending
    screen, landing page, AppShell sign-out and title — M1 deferred #5). The shared track pieces
    live in `lib/content/track-options.ts` (server) and `features/tracks` (client-safe components
    only), because a feature `index.ts` that client components import must not re-export
    server-only modules.

**Subagent contract for every task:** read `CLAUDE.md`, the platform-design sections the task
cites and this task's text; TDD (superpowers:test-driven-development) — the listed tests fail
first; `pnpm verify` green before the commit (plus `pnpm test:db` / `pnpm test:e2e` where the task
says so; both need the local stack: `pnpm db:start`); never read `.env*` or `docs/credentials/`;
no dependency beyond those named in the task. Call `redirect()` / `notFound()` outside
`try`/`catch` (or rethrow with `unstable_rethrow`) — they work by throwing. Nothing that runs
during `next build` prerendering may call `serverEnv()`: CI's `verify` job builds without runtime
secrets.

### Task 2.1: Supabase local stack, env, DB CI, e2e harness

**Spike findings (2026-09-24, CLI 2.117.0 — every item below was run):**

- Versions (install exact): `supabase` **2.117.0** (dev); `@supabase/supabase-js` **2.117.1**,
  `@supabase/ssr` **0.12.7**, `zod` **4.6.5**, `server-only` **0.0.1** (runtime). The CLI ships
  its binary as platform `optionalDependencies` (no postinstall), so `pnpm-workspace.yaml` needs
  **no** `allowBuilds` entry and `pnpm exec supabase` works right after install — CI uses it from
  `node_modules` (no `setup-cli` action).
- `supabase init` writes only `supabase/config.toml` (`[api] 54321`, `[db] 54322` / shadow 54320 /
  `major_version = 17`, `[studio] 54323`, `[local_smtp]` = Mailpit 54324 — there is no
  `[inbucket]` any more). Google/GitHub blocks are **not** generated.
- `env(...)` works only in **string** fields: `enabled = "env(X)"` fails with
  `CliConfigParseError`. With `enabled = true` and `client_id`/`secret` from unset env vars the
  stack still starts (empty credentials) — CI needs no OAuth secrets.
- `-x` names: `gotrue, realtime, storage-api, imgproxy, kong, mailpit, postgrest, postgres-meta,
  studio, edge-runtime, logflare, vector, supavisor`. The test stack (db + kong + gotrue +
  postgrest) starts in ~28 s warm, ~90 s cold (excluded images are still pulled).
- `supabase status -o env` prints `API_URL`, `PUBLISHABLE_KEY` (`sb_publishable_…`) and
  `SECRET_KEY` (`sb_secret_…`) — the new-style keys exist locally.
- pgTAP is **not** installed by default: every test file starts with
  `create extension if not exists pgtap with schema extensions;`. `supabase test db` runs every
  `*.sql` file under `supabase/tests/database/` with `pg_prove`, each file in its own transaction.
- Seeded password users work with the inserts in task 2.7a; `getClaims()` returns `sub` + `email`;
  the secret-key client bypasses RLS and `auth.admin.deleteUser()` cascades.
- `@supabase/ssr` 0.12.7: `createServerClient(url, key, { cookies: { getAll, setAll } })`;
  `setAll(cookiesToSet, headers)` receives cache headers that must be set on the response.

**Files:**

- Create: `supabase/config.toml` (from `pnpm exec supabase init`, then the edits below),
  `supabase/tests/database/_helpers.psql`, `supabase/tests/database/000-smoke.test.sql`,
  `supabase/tests/database/001-schema-invariants.test.sql`,
  `lib/env.ts`, `lib/env.test.ts`, `instrumentation.ts`, `.env.example`, `tools/test/server-only.ts`,
  `lib/supabase/database.types.ts` (generated), `tools/db/local-env.ts`,
  `tools/db/local-env.test.ts`, `e2e/support/test.ts`, `e2e/support/axe.ts`
- Modify: `package.json`, `vitest.config.ts`, `.github/workflows/ci.yml`,
  `.github/workflows/codeql.yml` (`persist-credentials: false`), `playwright.config.ts`, every
  `e2e/*.spec.ts` (import `test`/`expect` from `./support/test`, axe via `./support/axe`),
  `e2e/components.spec.ts` (overlays), `README.md` (Development), `CLAUDE.md` (Commands, Safety)

**Interfaces:**

- Produces `lib/env.ts` (deliberately **not** `server-only` — decision 11):

  ```ts
  export type VercelEnv = 'production' | 'preview' | 'development'
  export type ServerEnv = {
    supabaseUrl: string              // NEXT_PUBLIC_SUPABASE_URL (url)
    supabasePublishableKey: string   // NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (non-empty)
    supabaseSecretKey: string        // SUPABASE_SECRET_KEY (non-empty)
    siteUrl: string                  // decision 20 — see below
    adminEmails: readonly string[]   // ADMIN_EMAILS: comma list, trimmed, lower-cased, empties dropped
    authTestLogin: boolean           // AUTH_TEST_LOGIN: 'true' | 'false' | unset (= false)
    vercelEnv: VercelEnv | undefined // VERCEL_ENV
    cronSecret: string | undefined   // CRON_SECRET: optional until 5.7; ≥ 32 chars when set
  }
  export class EnvError extends Error {}            // message lists variable NAMES only, never values
  export function parseServerEnv(source: Record<string, string | undefined>): ServerEnv
  export function serverEnv(): ServerEnv            // memoised parseServerEnv(process.env)
  /** Only the two public Supabase values (the proxy and the session client need nothing else). */
  export function publicSupabaseEnv(): { supabaseUrl: string; supabasePublishableKey: string }
  // reads process.env.NEXT_PUBLIC_SUPABASE_URL / _PUBLISHABLE_KEY by their literal names
  ```

  `siteUrl`: when `VERCEL_ENV === 'preview'` and `VERCEL_BRANCH_URL` is set →
  `https://${VERCEL_BRANCH_URL}`; otherwise `NEXT_PUBLIC_SITE_URL` (required, a URL, no trailing
  slash kept). `AUTH_TEST_LOGIN=true` with `VERCEL_ENV=production` throws
  `EnvError('AUTH_TEST_LOGIN must not be enabled in production')` (§2.3). No client schema yet
  (decision 11).
- Produces `tools/db/local-env.ts`:
  `parseStatusEnv(output: string): { NEXT_PUBLIC_SUPABASE_URL: string;
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: string; SUPABASE_SECRET_KEY: string }` (from `API_URL`,
  `PUBLISHABLE_KEY`, `SECRET_KEY`; throws naming the missing key) and `localSupabaseEnv()` (runs
  `pnpm exec supabase status -o env`; on failure throws
  `Error('Local Supabase is not running — run `pnpm db:start` first.')`).
- Produces `e2e/support/test.ts`: `test` (Playwright `test` extended so each test **fails on any
  `console` error or `pageerror`**, with an option `allowedConsoleErrors: RegExp[]`, default `[]`;
  a "Failed to load resource" error whose `msg.location().url` contains `_rsc=` is ignored — the
  AppShell's links prefetch `/review`, `/tracks`, `/progress`, `/admin/content`, which 404 until
  M3/M5)
  and `expect`; `e2e/support/axe.ts`: `WCAG_TAGS` and
  `expectNoAxeViolations(page: Page, options?: { disableRules?: string[] }): Promise<void>` (full
  page, WCAG 2.1 A/AA tags).
- Produces scripts: `db:start`, `db:stop`, `db:reset`, `db:types`, `test:db`, `verify:full`.
- Produces the pgTAP include convention used by 2.4–2.11b: test files `NNN-name.test.sql`, shared
  helpers in `supabase/tests/database/_helpers.psql` (not `*.sql`, so it is never run as a test),
  included with `\ir _helpers.psql` right after the `create extension` line.

- [ ] **Step 1: Install** (exact versions above):

  ```bash
  pnpm add --save-exact -D supabase@2.117.0
  pnpm add --save-exact @supabase/supabase-js@2.117.1 @supabase/ssr@0.12.7 zod@4.6.5 server-only@0.0.1
  pnpm exec supabase --version   # 2.117.0
  ```

- [ ] **Step 2: `supabase init`** (`pnpm exec supabase init`), then edit `supabase/config.toml`:
  `project_id = "hoc-deu"`; `[auth] site_url = "http://localhost:3000"`,
  `additional_redirect_urls = ["http://localhost:3000/**", "http://localhost:3100/**"]` (the
  callback URL carries `?next=`); keep `[auth.email] enable_signup = true` and
  `enable_confirmations = false` (the email provider must stay on locally for the test login; the
  second lock is the hosted projects' disabled email provider, 2.2); append:

  ```toml
  # OAuth for the local stack is optional: unset variables start the stack with empty credentials.
  # Booleans cannot use env() (CliConfigParseError), so `enabled` stays literal.
  [auth.external.google]
  enabled = true
  client_id = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID)"
  secret = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET)"
  redirect_uri = ""
  url = ""
  skip_nonce_check = true

  [auth.external.github]
  enabled = true
  client_id = "env(SUPABASE_AUTH_EXTERNAL_GITHUB_CLIENT_ID)"
  secret = "env(SUPABASE_AUTH_EXTERNAL_GITHUB_SECRET)"
  redirect_uri = ""
  url = ""
  ```

- [ ] **Step 3: Scripts** in `package.json`:

  ```json
  "db:start": "supabase start -x studio,imgproxy,storage-api,realtime,edge-runtime,logflare,vector,postgres-meta,supavisor,mailpit",
  "db:stop": "supabase stop",
  "db:reset": "supabase db reset",
  "db:types": "supabase gen types typescript --local --schema public > lib/supabase/database.types.ts && prettier --write lib/supabase/database.types.ts",
  "test:db": "supabase test db",
  "verify:full": "pnpm verify && pnpm test:db && pnpm test:e2e"
  ```

- [ ] **Step 4: pgTAP smoke + include convention (RED → GREEN).** `_helpers.psql`:

  ```sql
  -- Shared pgTAP helpers, included by every test file (`\ir _helpers.psql`) inside its
  -- transaction, so they are rolled back with the test. Tasks 2.4+ add the user/auth helpers.
  create schema if not exists tests;
  grant usage on schema tests to anon, authenticated, service_role;
  create or replace function tests.helpers_loaded() returns boolean language sql as $$ select true $$;
  ```

  `000-smoke.test.sql`:

  ```sql
  begin;
  create extension if not exists pgtap with schema extensions;
  \ir _helpers.psql
  select plan(2);
  select has_schema('public');
  select ok(tests.helpers_loaded(), 'shared helpers load via \ir');
  select * from finish();
  rollback;
  ```

  Run `pnpm db:start && pnpm test:db` → PASS. **If `\ir` is not supported by the CLI's
  `pg_prove`,** stop and report `BLOCKED` with the error — do not paste helpers into test files.
  Then `pnpm db:types` (generates the empty `public` schema types; committed) — confirm it works
  with `postgres-meta` excluded from `db:start`; if it does not, drop `postgres-meta` from the
  `-x` list and say so in the report. If ESLint flags
  the generated file, add `lib/supabase/database.types.ts` to `globalIgnores` in
  `eslint.config.mjs` (generated code) rather than editing it.

- [ ] **Step 4b: Schema invariants (owner review MF2).** `001-schema-invariants.test.sql` checks
  the whole `public` schema on every run, so every later migration is covered automatically:
  1. every table (`relkind` `r`, `p`) has RLS enabled (`relrowsecurity`);
  2. every view has `security_invoker=true` in `reloptions` (§4.3);
  3. `anon` holds **no** privilege on any table, view or sequence in `public` (checked with
     `has_table_privilege` / `has_any_column_privilege` / `has_sequence_privilege` over `pg_class`);
  4. every `SECURITY DEFINER` function in `public` has a `search_path=` entry in `proconfig`, an
     explicit ACL (`proacl` not null — null means PUBLIC may execute) with no PUBLIC entry
     (`aclexplode(proacl)` grantee `0`), and no EXECUTE for `anon`;
  5. `anon` has EXECUTE on **no** function in `public`;
  6. the set of `public` functions `authenticated` may EXECUTE (`has_function_privilege`,
     excluding extension-owned functions via `pg_depend` `deptype = 'e'`) **equals** an explicit
     allowlist kept at the top of the file (`set_eq`), with the comment "a migration that adds a
     function `authenticated` may call adds it here, in the same commit". In 2.1 the allowlist is
     empty (nothing exists yet, every check passes vacuously); 2.4, 2.5, 2.5b and 2.8 extend it.
     The final M2 list: `is_active`, `is_admin`, `local_day`, `user_local_day`,
     `learner_event_types`, `rules_version` (called as the invoker by policies, column defaults
     and the events trigger), `apply_event`, `admin_set_status`, `admin_set_role`,
     `admin_list_users`.
  Prove it bites before relying on it: in a scratch migration (not committed) create a table
  without RLS and a function granted to `anon`, run `pnpm test:db`, see both checks fail, delete
  the scratch file, `pnpm db:reset`.

- [ ] **Step 5: `lib/env.ts` test-first.** `lib/env.test.ts` (node) — each must fail first:
  1. a complete valid source parses; `ADMIN_EMAILS=' A@X.com, ,b@y.com '` →
     `['a@x.com', 'b@y.com']`; unset `ADMIN_EMAILS` → `[]`;
  2. missing `SUPABASE_SECRET_KEY` throws `EnvError` whose message contains
     `SUPABASE_SECRET_KEY` and **does not contain** any provided value (use a sentinel value in
     another variable and assert it is absent);
  3. `NEXT_PUBLIC_SUPABASE_URL='not a url'` throws naming it;
  4. `AUTH_TEST_LOGIN=true` + `VERCEL_ENV=production` throws; with `VERCEL_ENV=preview` →
     `authTestLogin === true`; `AUTH_TEST_LOGIN=yes` throws;
  5. `VERCEL_ENV=preview` + `VERCEL_BRANCH_URL=hoc-deu-git-x-me.vercel.app` → `siteUrl ===
     'https://hoc-deu-git-x-me.vercel.app'` even when `NEXT_PUBLIC_SITE_URL` is unset;
     `VERCEL_ENV=production` without `NEXT_PUBLIC_SITE_URL` throws;
  6. `CRON_SECRET` shorter than 32 characters throws; unset → `undefined`.

  Implement with Zod 4 (`z.object`, `safeParse`, collect `issue.path` names). `serverEnv()`
  memoises. `publicSupabaseEnv()`: a missing value throws `EnvError` naming it (test).
  **`server-only` in tests:** the package throws outside the `react-server` condition, so
  `vitest.config.ts` aliases `server-only` to an empty module (`tools/test/server-only.ts`,
  `export {}`) for both projects (later tasks' `lib/supabase/*`, `lib/auth/dal.ts`,
  `lib/events/apply.ts` import it); e2e code imports server modules' **types** only
  (`import type`).

- [ ] **Step 6: Startup validation.** `instrumentation.ts`:

  ```ts
  export async function register() {
    // Validate once at server start (§2.3); `next build` must work without runtime secrets.
    if (process.env.NEXT_RUNTIME !== 'nodejs') return
    if (process.env.NEXT_PHASE === 'phase-production-build') return
    const { serverEnv } = await import('./lib/env')
    serverEnv()
  }
  ```

  Check by hand and record in the report: `pnpm build` with no Supabase variables succeeds;
  `pnpm start` with `AUTH_TEST_LOGIN=true VERCEL_ENV=production` (plus the other variables) fails
  at startup with the EnvError message. If Next only logs the error and keeps serving, make
  `register()` log the message and `process.exit(1)`.

- [ ] **Step 7: `.env.example`** (committed; no secrets) listing every §2.5 v1.0 variable with
  local values or empty placeholders and one comment each (`NEXT_PUBLIC_SUPABASE_URL=
  http://127.0.0.1:54321`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=` "from `pnpm exec supabase
  status -o env`", `NEXT_PUBLIC_SITE_URL=http://localhost:3000`, `SUPABASE_SECRET_KEY=`,
  `ADMIN_EMAILS=admin@example.test`, `AUTH_TEST_LOGIN=true`, `# CRON_SECRET=` (5.7), the four
  optional `SUPABASE_AUTH_EXTERNAL_*` variables commented out). `.gitignore` already has
  `!.env.example`. `CLAUDE.md` Safety: "`.env.example` is the committed template; every other
  `.env*` stays unread."

- [ ] **Step 8: Playwright on the local stack (decision 15).** `tools/db/local-env.test.ts`
  (node): `parseStatusEnv` maps the three keys from a sample `-o env` output (quoted values) and
  throws naming a missing key. `playwright.config.ts`:

  ```ts
  import { localSupabaseEnv } from './tools/db/local-env'

  const PORT = 3100
  // Workers inherit process.env from the runner, so `supabase status` runs once.
  if (!process.env.E2E_STACK_READY) {
    Object.assign(process.env, {
      ...localSupabaseEnv(),
      NEXT_PUBLIC_SITE_URL: `http://localhost:${PORT}`,
      AUTH_TEST_LOGIN: 'true',
      // One listed address per bootstrap scenario, so the scenarios never race (2.7a).
      ADMIN_EMAILS:
        'bootstrap-admin@example.test,bootstrap-rejected@example.test,bootstrap-demoted@example.test',
      E2E_STACK_READY: '1',
    })
  }
  // … webServer.env: the same five variables, so the build inlines the local URL and key.
  ```

- [ ] **Step 9: e2e harness.** `e2e/support/test.ts` (console/pageerror fixture) and
  `e2e/support/axe.ts`; every existing spec imports from them; `not-found.spec.ts` sets
  `allowedConsoleErrors: [/status of 404/]` (the browser logs the 404 document load). M1 deferred
  #19 in `components.spec.ts`: overlays are scanned as a **full page** with only
  `aria-hidden-focus` disabled (`expectNoAxeViolations(page, { disableRules:
  ['aria-hidden-focus'] })`), for Dialog, Sheet, ConfirmDialog, DropdownMenu and Tooltip open on
  `/dev/components` and the AccountMenu open on `/dev/app-shell` — in light and dark. Traces stay
  `retain-on-failure` (decision 16).

- [ ] **Step 10: CI** — `.github/workflows/ci.yml` (deferred minor #11 included):

  ```yaml
  concurrency:
    group: ci-${{ github.workflow }}-${{ github.ref }}
    # Cancel superseded pull-request runs only; every push to main runs to completion.
    cancel-in-progress: ${{ github.event_name == 'pull_request' }}
  ```

  Every `actions/checkout@v7` gets `with: { persist-credentials: false }`. New job:

  ```yaml
    db:
      name: db
      runs-on: ubuntu-latest
      timeout-minutes: 20
      steps:
        - uses: actions/checkout@v7
          with:
            persist-credentials: false
        - uses: pnpm/action-setup@v6
        - uses: actions/setup-node@v7
          with:
            node-version-file: .nvmrc
            cache: pnpm
        - run: pnpm install --frozen-lockfile
        - run: pnpm db:start
        - run: pnpm test:db
        - name: Generated database types match the migrations
          run: pnpm db:types && git diff --exit-code -- lib/supabase/database.types.ts
  ```

  The `e2e` job adds `- run: pnpm db:start` before the Playwright install; the failure artifact
  stays `playwright-report/`, 7 days.

- [ ] **Step 11: Docs.** `README.md` Development: Docker is required for the local stack;
  `pnpm db:start`, `pnpm db:reset`, `pnpm test:db`, `pnpm verify:full`; copy `.env.example` to
  `.env.local` for `pnpm dev`. `CLAUDE.md` Commands: add `db:start`, `db:stop`, `db:reset`,
  `db:types`, `test:db`; `verify:full` = verify + test:db + test:e2e (needs `pnpm db:start`).

- [ ] **Step 12: Verify** — `pnpm verify`, then `pnpm db:start && pnpm test:db && pnpm test:e2e`
  (all existing e2e green through the new harness — including `/dev/app-shell`, whose prefetches
  exercise the `_rsc=` exception; the overlay scans pass). Record the timings.
- [ ] **Step 13: Commit** — `build(db): local Supabase stack, env validation and DB CI`.

### Task 2.3: `localDay` and time helpers (moved from M4)

**Files:**

- Create: `lib/domain/time/localDay.ts`, `lib/domain/time/timeZones.ts`,
  `lib/domain/time/fixtures.ts`, `lib/domain/time/localDay.test.ts`,
  `lib/domain/time/timeZones.test.ts`, `tools/guards/domain-purity.ts`,
  `tools/guards/domain-purity.test.ts`, `tools/guards/vitest-tz.test.ts`,
  `docs/adr/0017-day-start-and-schedule-versions.md`, `docs/adr/0020-intl-only-time.md`
- Modify: `vitest.config.ts` (fixed `TZ`), `docs/adr/README.md`

**Interfaces (produced — used by 2.5, 2.10, 2.11, M4, M5):**

```ts
/** A calendar date in the learner's schedule, `YYYY-MM-DD`. */
export type LocalDay = string
/** `HH:MM`, 00:00–12:00 in 30-minute steps (decision 5). */
export type DayStart = string
export type Schedule = { timezone: string; dayStartsAt: DayStart }
export type ScheduleVersion = Schedule & { effectiveAt: string /* ISO-8601 instant */ }
export const DEFAULT_SCHEDULE: Schedule // { timezone: 'Asia/Ho_Chi_Minh', dayStartsAt: '04:00' }
export const DAY_STARTS: readonly DayStart[] // '00:00', '00:30', …, '12:00' (25 values)

/** Date part of (wall-clock time of `now` in `schedule.timezone` − `dayStartsAt`) — §5.1. */
export function localDay(now: Date, schedule: Schedule): LocalDay
/** Latest version with effectiveAt ≤ at; DEFAULT_SCHEDULE when none (versions in any order). */
export function scheduleAt(versions: readonly ScheduleVersion[], at: Date): Schedule
/** Earliest instant (whole minute) > now whose localDay is the day after localDay(now). */
export function nextDayStart(now: Date, schedule: Schedule): Date
export function addDays(day: LocalDay, days: number): LocalDay
export function daysBetween(from: LocalDay, to: LocalDay): number // to − from, in days
export function isLocalDay(value: string): boolean
export function isDayStart(value: string): boolean
```

`timeZones.ts`:

```ts
/** CLDR legacy IDs that ICU still reports → IANA names (decision 6). */
export const TIME_ZONE_ALIASES: Readonly<Record<string, string>>
// at least: Asia/Saigon→Asia/Ho_Chi_Minh, Asia/Calcutta→Asia/Kolkata, Asia/Katmandu→Asia/Kathmandu,
// Asia/Rangoon→Asia/Yangon, Europe/Kiev→Europe/Kyiv, Atlantic/Faeroe→Atlantic/Faroe,
// America/Godthab→America/Nuuk, Pacific/Enderbury→Pacific/Kanton, Pacific/Truk→Pacific/Chuuk,
// Pacific/Ponape→Pacific/Pohnpei, America/Buenos_Aires→America/Argentina/Buenos_Aires
export function canonicalTimeZone(id: string): string
export function isValidTimeZone(id: string): boolean // Intl.DateTimeFormat accepts it
/** Sorted canonical IDs for pickers: supportedValuesOf, canonicalised, deduplicated, + Asia/Ho_Chi_Minh. */
export function timeZoneOptions(): readonly string[]
```

**Algorithm notes:** read wall-clock parts with `Intl.DateTimeFormat('en-US', { timeZone,
hourCycle: 'h23', year, month, day, hour, minute, second })`.`formatToParts(now)`; build a UTC
millisecond value from those parts with `Date.UTC`, subtract the day start, take the UTC date.
Calendar math on integer day numbers (`Date.UTC(y, m - 1, d) / 86_400_000`). `nextDayStart`:
scan **forward linearly** in 15-minute steps from the next quarter hour after `now` (every current
UTC offset and every allowed day start is a multiple of 15 minutes) for the first instant whose
`localDay` is `addDays(localDay(now), 1)`. Not a binary search: `localDay` is not monotonic when
the day start falls inside a fall-back repeated hour (New York, day start 01:30, on 1 November
reads 31 Oct → 1 Nov → 31 Oct → 1 Nov), and the earliest instant is the one that counts. No
`Date.now()`, no argument-less `new Date()`, no local-time getters.

**Fixtures** (`fixtures.ts` exports `LOCAL_DAY_FIXTURES: readonly { at: string; timezone: string;
dayStartsAt: DayStart; expected: LocalDay; note: string }[]`) — expected values checked
independently with Python `zoneinfo` on 2026-09-24; task 2.5 generates the SQL parity test from
this list:

| at (UTC) | timezone | day start | expected | note |
| --- | --- | --- | --- | --- |
| 2026-09-24T18:30:00Z | Asia/Ho_Chi_Minh | 04:00 | 2026-09-24 | RF-1: 01:30 counts for the previous day |
| 2026-09-24T18:30:00Z | Asia/Saigon | 04:00 | 2026-09-24 | legacy alias (ICU's name for VN) — SF8 |
| 2026-09-24T21:00:00Z | Asia/Saigon | 04:00 | 2026-09-25 | legacy alias at the day start — SF8 |
| 2026-09-24T21:00:00Z | Asia/Ho_Chi_Minh | 04:00 | 2026-09-25 | the day start itself is the new day |
| 2026-09-24T20:59:59Z | Asia/Ho_Chi_Minh | 04:00 | 2026-09-24 | one second before the day start |
| 2026-09-24T17:00:00Z | Asia/Ho_Chi_Minh | 00:00 | 2026-09-25 | midnight day start |
| 2026-09-25T04:59:00Z | Asia/Ho_Chi_Minh | 12:00 | 2026-09-24 | latest allowed day start, before |
| 2026-09-25T05:00:00Z | Asia/Ho_Chi_Minh | 12:00 | 2026-09-25 | latest allowed day start, at |
| 2026-09-24T06:00:00Z | America/St_Johns | 04:00 | 2026-09-23 | half-hour offset (NDT −2:30) |
| 2026-01-15T07:30:00Z | America/St_Johns | 04:00 | 2026-01-15 | half-hour offset (NST −3:30) |
| 2026-03-08T07:30:00Z | America/New_York | 04:00 | 2026-03-07 | spring forward, 03:30 EDT |
| 2026-03-08T08:00:00Z | America/New_York | 04:00 | 2026-03-08 | spring forward, 04:00 EDT |
| 2026-11-01T08:30:00Z | America/New_York | 04:00 | 2026-10-31 | fall back, 03:30 EST |
| 2026-11-01T09:00:00Z | America/New_York | 04:00 | 2026-11-01 | fall back, 04:00 EST |
| 2026-09-24T22:00:00Z | Asia/Kolkata | 04:00 | 2026-09-24 | +5:30 |
| 2026-09-24T22:00:00Z | Asia/Kolkata | 03:30 | 2026-09-25 | +5:30, half-hour day start |
| 2026-09-24T22:15:00Z | Asia/Kathmandu | 04:00 | 2026-09-25 | +5:45 |
| 2026-09-24T14:00:00Z | Pacific/Kiritimati | 04:00 | 2026-09-25 | +14 |
| 2026-09-25T14:59:00Z | Pacific/Pago_Pago | 04:00 | 2026-09-24 | −11 |
| 2028-02-29T23:30:00Z | Europe/London | 00:00 | 2028-02-29 | leap day |
| 2028-03-01T03:00:00Z | Europe/London | 04:00 | 2028-02-29 | after a leap day |
| 2026-12-31T18:59:59Z | Asia/Tokyo | 04:00 | 2026-12-31 | year boundary, before |
| 2026-12-31T19:00:00Z | Asia/Tokyo | 04:00 | 2027-01-01 | year boundary, at |

- [ ] **Step 1: Fixed test time zone.** At the top of `vitest.config.ts`:
  `process.env.TZ = 'America/St_Johns'` with a comment (a non-UTC, half-hour zone flushes out
  local-time bugs; §7.2). `tools/guards/vitest-tz.test.ts` asserts
  `Intl.DateTimeFormat().resolvedOptions().timeZone === 'America/St_Johns'`. RED → GREEN.
- [ ] **Step 2: Failing tests** (`localDay.test.ts`):
  - every `LOCAL_DAY_FIXTURES` row (`it.each`);
  - `scheduleAt`: no versions → `DEFAULT_SCHEDULE`; picks the latest `effectiveAt ≤ at` from an
    unsorted list; a version effective exactly at `at` applies; a future version does not;
  - **[RF-1] a change applies from the next day start:** schedule A = VN 04:00; at
    2026-09-24T03:00:00Z (10:00 local) the user switches to America/Los_Angeles 04:00 with
    `effectiveAt = nextDayStart(at, A)` = `2026-09-24T21:00:00Z`; `localDay` for an instant one
    minute before uses A, at `effectiveAt` uses the new schedule;
  - `nextDayStart`: VN 04:00 at 2026-09-24T03:00:00Z → 2026-09-24T21:00:00Z; at
    2026-09-24T19:00:00Z (02:00 local, still the 24th) → 2026-09-24T21:00:00Z; America/St_Johns
    04:00 at 2026-09-24T12:00:00Z → 2026-09-25T06:30:00Z; America/New_York **02:30** at
    2026-03-07T12:00:00Z (the wall time does not exist on 8 March) → 2026-03-08T07:00:00Z;
    America/New_York 04:00 at 2026-10-31T12:00:00Z → 2026-11-01T09:00:00Z; America/New_York
    **01:30** at 2026-10-31T12:00:00Z (the day start repeats in the fall-back hour) →
    2026-11-01T05:30:00Z, the first occurrence; property over every
    fixture schedule and three `now` values: `localDay(result) === addDays(localDay(now), 1)` and
    `localDay(result − 60 s) === localDay(now)`;
  - **[RF-1] moving west or east:** sample `localDay` every 15 minutes across a
    VN → America/Los_Angeles switch (west) — the sequence never decreases and repeats at most one
    date; across America/Los_Angeles → VN (east) — never decreases and skips at most one date;
  - `addDays` across month/year/leap boundaries; `daysBetween('2026-09-24', '2026-10-01') === 7`;
    `isLocalDay`, `isDayStart` (`'04:30'` true, `'04:15'`, `'13:00'`, `'4:00'` false);
    `DAY_STARTS.length === 25`.
  `timeZones.test.ts`: `canonicalTimeZone('Asia/Saigon') === 'Asia/Ho_Chi_Minh'`; an IANA name is
  returned unchanged; `timeZoneOptions()` includes `Asia/Ho_Chi_Minh` and `Asia/Kolkata`, excludes
  `Asia/Saigon` and `Asia/Calcutta`, is sorted and duplicate-free; `isValidTimeZone('Mars/Base')`
  false, `isValidTimeZone('Asia/Saigon')` true.
- [ ] **Step 3: Purity guard (deferred minor #5), test first.** `tools/guards/domain-purity.ts`
  exports `purityViolations(file: string, source: string): string[]` (TypeScript compiler API:
  `ts.createSourceFile`, walk imports and calls). Rules for `lib/domain/**`: imports only from
  `lib/domain` (alias or relative) and `zod`; no `node:*`; no `.tsx` files; no `Date.now()`,
  `Date()` called without `new`, argument-less `new Date()`; no local-time getters/setters
  (`getHours`, `getDate`, `getDay`, `getMonth`, `getFullYear`, `getMinutes`, `getSeconds`,
  `getTimezoneOffset`, `toLocaleDateString`, `toLocaleTimeString`, `toLocaleString` and the
  `set*` counterparts); no `performance.now()`, `Math.random()`, `fetch`. Test files
  (`*.test.ts` and `__tests__/**`) are scanned with the same rules, except that they may also
  import `vitest` and `fast-check` (M4's property tests). The test feeds one bad snippet per rule
  (each yields exactly one violation), one clean snippet (zero), a test-file snippet importing
  `vitest` (zero; the same import in a non-test file: one), and scans the real `lib/domain/**`
  (zero).
- [ ] **Step 4: RED** — `pnpm test lib/domain tools/guards`. **Step 5: Implement**
  `localDay.ts`, `timeZones.ts`, `fixtures.ts`, `domain-purity.ts`. **Step 6: GREEN** +
  `pnpm lint`.
- [ ] **Step 7: ADRs** — 0017 (per-user day start, schedule versions effective at the next day
  start, the first schedule immediately, decision 5) and 0020 (Intl-only time handling, the TZ
  test pin, alias canonicalisation, decision 6); `docs/adr/README.md` links them.
- [ ] **Step 8: Verify** `pnpm verify`. **Commit** — `feat(domain): localDay and schedule
  versions with the day-start rule`.

### Task 2.4: Migration — profiles, schedule_versions, user_tracks (+ lint and doc hygiene)

Two commits: first the M1 hygiene (deferred #6, #21), then the migration.

**Files:**

- Commit 1 — Modify: `eslint.config.mjs`, `tools/eslint/layer-imports.mjs`,
  `tools/guards/eslint-rules.test.ts`, `docs/plans/2026-09-24-implementation-plan.md` (Part A
  row 1.1), `docs/plans/2026-09-23-platform-design.md` (§7.2 className exceptions)
- Commit 2 — Create: `supabase/migrations/20260925000100_profiles_schedules_tracks.sql`,
  `supabase/tests/database/010-profiles.test.sql`,
  `supabase/tests/database/011-schedules-tracks.test.sql`; Modify:
  `supabase/tests/database/_helpers.psql`, `supabase/tests/database/001-schema-invariants.test.sql`
  (allowlist), `lib/supabase/database.types.ts` (`pnpm db:types`),
  `docs/adr/0017-day-start-and-schedule-versions.md`

**Commit 1 — layer-rule gaps (M1 deferred #6) and doc drift (#21), rule tests first:**

- `app/api/**` follows its §7.2 row: it may import `lib/*` and features' `index.ts`, never
  `components/**` (today `layer-imports.mjs` returns early for `app/api`). `app/dev/**` keeps its
  exemption.
- The layer rule also checks `.js`, `.jsx` and `.mjs` files under `app`, `components`,
  `features`, `lib`, `tools` (the files glob in `eslint.config.mjs`).
- The "no `'use client'` in `page.tsx` / `layout.tsx`" rule also covers `app/dev/**`.
- `tools/guards/eslint-rules.test.ts`: one failing case per gap (an `app/api/x/route.ts`
  importing `@/components/ui/button`; a `lib/x.mjs` importing `@/features/a/internal`; an
  `app/dev/x/page.tsx` starting with `'use client'`) plus one allowed case each.
- Docs: Part A row 1.1 says "merge `shadcn eject` CSS" — superseded by Part B-M1 decision 3
  (nothing to eject); spec §7.2 lists `app/layout.tsx` as the only `className` exception — add
  `app/global-error.tsx` (replaces the root layout) and `app/dev/**` (the catalog). Note each
  edit as "(M1 review)".
- Commit: `chore(lint): layer rules cover app/api, .mjs files and app/dev pages`.

**Commit 2 — schema.** Write the migration exactly with these definitions (the contract later
tasks rely on); add comments where a rule comes from the spec. It starts by removing Supabase's
default grants for everything created later in `public` (MF2 — each object then grants exactly
what it needs):

```sql
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
```

Every function below states its grants explicitly; the schema-invariants allowlist (2.1) gains
`is_active` and `is_admin` in this commit.

```sql
-- §4.1, §4.5. Every table: RLS on, deny by default; Supabase's default grants are revoked.
create function public.set_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'learner' check (role in ('learner', 'admin')),
  status text not null default 'pending'
    check (status in ('pending', 'active', 'rejected', 'suspended')),
  ai_personalization boolean not null default false,
  share_notes_with_ai boolean not null default false,
  code_language text check (code_language in ('python', 'java', 'go')),
  display_name text check (char_length(display_name) between 1 and 80),
  avatar_url text check (avatar_url ~ '^https://'),
  onboarded_at timestamptz,
  approved_by uuid,  -- no FK: the approving admin may delete their account later
  approved_at timestamptz,
  bot_ref text not null unique default encode(extensions.gen_random_bytes(8), 'hex'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.schedule_versions (
  user_id uuid not null references public.profiles (id) on delete cascade,
  effective_at timestamptz not null,
  timezone text not null default 'Asia/Ho_Chi_Minh',
  day_starts_at time not null default '04:00',
  created_at timestamptz not null default now(),
  primary key (user_id, effective_at),
  -- decision 5: 00:00–12:00 in 30-minute steps
  constraint day_starts_at_step check (
    day_starts_at between time '00:00' and time '12:00'
    and extract(second from day_starts_at) = 0
    and extract(minute from day_starts_at) in (0, 30)
  )
);

create table public.user_tracks (
  user_id uuid not null references public.profiles (id) on delete cascade,
  track_id text not null check (track_id ~ '^[a-z][a-z0-9-]{0,31}$'),
  roadmap_variant text not null check (roadmap_variant ~ '^[a-z0-9][a-z0-9-]{0,31}$'),
  status text not null default 'active' check (status in ('active', 'paused', 'removed')),
  start_date date not null,
  budget_minutes integer not null check (budget_minutes between 10 and 240 and budget_minutes % 5 = 0),
  new_per_day integer check (new_per_day >= 0),                                   -- null = track default
  throttle jsonb check (throttle is null or jsonb_typeof(throttle) = 'array'),    -- null = track default
  weekly_template jsonb check (weekly_template is null or jsonb_typeof(weekly_template) = 'object'),
  include_bonus boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, track_id)
);
```

Plus, in the same migration:

- `updated_at` triggers on `profiles` and `user_tracks` (`set_updated_at`).
- **`public.handle_new_user()`** — `security definer`, `set search_path = ''`, `after insert on
  auth.users for each row`: inserts the profile with `display_name` =
  `left(coalesce(nullif(btrim(meta->>'full_name'), ''), nullif(btrim(meta->>'name'), ''),
  nullif(btrim(meta->>'user_name'), ''), split_part(new.email, '@', 1)), 80)` (an all-space name
  must never block sign-up); `avatar_url` = `raw_user_meta_data->>'avatar_url'` only when
  it starts with `https://`, else null. Status `pending` (§4.5).
- **`public.is_active()`**, **`public.is_admin()`** — `language sql stable security definer set
  search_path = ''`: whether the caller's (`(select auth.uid())`) profile has `status = 'active'`
  (and `role = 'admin'` for `is_admin`). `revoke execute … from public, anon`; `grant execute …
  to authenticated, service_role`.
- **`public.profiles_guard_share_notes()`** — `before update on profiles`: turning
  `share_notes_with_ai` **on** while `ai_personalization` is off raises
  `ai_personalization_off` (§4.5); turning it off is always allowed.
- **`public.schedule_versions_check_timezone()`** — `before insert or update on
  schedule_versions`: raises `invalid_timezone` unless `new.timezone` is in `pg_timezone_names`
  (decision 6).
- **`public.schedule_versions_guard_history()`** (owner review MF3; `apply_event` is callable
  directly with any `effectiveAt`, and `authenticated` may update versions) — `before insert or
  update or delete on schedule_versions`, for every role:
  - insert (also the insert half of an upsert): allowed when `new.effective_at >= now() -
    interval '5 minutes'` **or** the user has no version yet (their first); otherwise raises
    `schedule_backdated`;
  - update: raises `schedule_in_force` when `old.effective_at <= now()` (past days are never
    rewritten, §5.9); a pending future version may be updated;
  - delete: raises `schedule_in_force` when `old.effective_at <= now()` — **except** when the
    user's profile no longer exists (the account-deletion cascade, §4.6, must still work).
- **Grants** (Supabase grants everything to `anon`/`authenticated` by default — revoke first):

  ```sql
  revoke all on public.profiles, public.schedule_versions, public.user_tracks from anon, authenticated;
  grant select on public.profiles to authenticated;
  grant update (display_name, avatar_url, code_language, share_notes_with_ai) on public.profiles to authenticated;
  grant select, insert on public.schedule_versions to authenticated;
  grant update (timezone, day_starts_at) on public.schedule_versions to authenticated;  -- 2.5b upsert
  grant select, insert, update on public.user_tracks to authenticated;
  ```

- **RLS policies** (`to authenticated`; `(select auth.uid())` form for the planner):
  `profiles` — select own (`id = uid`); update own **and** `is_active()`, check `id = uid`.
  `schedule_versions` — select own; insert check own **and** `is_active()`; update own **and**
  `is_active()`. `user_tracks` — select own; insert check own **and** `is_active()`; update own
  **and** `is_active()`. No delete policies (removal is a status; rows go with the account).

**`_helpers.psql` additions** (used by every later pgTAP file):

```sql
-- Creates an auth user (the profile trigger fires), then sets status/role directly.
create or replace function tests.create_user(
  p_email text, p_status text default 'active', p_role text default 'learner',
  p_meta jsonb default '{}'::jsonb
) returns uuid language plpgsql as $$ … $$;
-- Switches the transaction to `authenticated` with the user's JWT claims.
create or replace function tests.authenticate_as(p_user uuid) returns void language plpgsql as $$ … $$;
create or replace function tests.authenticate_as_service_role() returns void language plpgsql as $$ … $$;
create or replace function tests.clear_authentication() returns void language plpgsql as $$ … $$;  -- back to postgres
```

`create_user` inserts into `auth.users` with the column set proven in the spike (`id`,
`instance_id` `00000000-0000-0000-0000-000000000000`, `aud`/`role` `authenticated`, `email`,
`encrypted_password` (`extensions.crypt('test-password-123', extensions.gen_salt('bf'))`),
`email_confirmed_at`, `created_at`, `updated_at`, `raw_app_meta_data`
`{"provider":"email","providers":["email"]}`, `raw_user_meta_data` = `p_meta`, and
`confirmation_token`, `recovery_token`, `email_change`, `email_change_token_new`,
`email_change_token_current` all `''`). `authenticate_as` sets `request.jwt.claims` to
`{"sub": <uuid>, "role": "authenticated", "email": <email>}` and switches role (`set local role`
via `execute`); grant `execute` on the helpers to `anon, authenticated, service_role`.

**pgTAP tests (write first; each file `begin; create extension …; \ir _helpers.psql; select
plan(n); … select * from finish(); rollback;`):**

`010-profiles.test.sql`:
1. a new auth user with `{"full_name": "Nguyễn Văn A", "avatar_url": "https://x.test/a.png"}` gets
   a profile: `pending`, `learner`, `ai_personalization` false, `share_notes_with_ai` false,
   `display_name` `Nguyễn Văn A`, the avatar, a 16-hex `bot_ref`; an `http://` avatar is stored as
   null; no metadata, or a `full_name` of spaces only → `display_name` = the e-mail's local part;
2. as `authenticated`, a user sees only their own profile (`count(*) = 1`);
3. `anon` cannot select profiles (`42501`);
4. an active user cannot update `status`, `role`, `ai_personalization`, `onboarded_at`,
   `approved_by`, `bot_ref` (each `throws_ok(…, '42501')`);
5. an active user can update `display_name` and `code_language`; a **pending** user's update of
   `display_name` changes nothing (RLS: 0 rows);
6. `code_language = 'rust'` fails (`23514`);
7. `share_notes_with_ai = true` raises `ai_personalization_off` while the flag is off; after
   `postgres` turns `ai_personalization` on, the same update succeeds;
8. `is_active()` / `is_admin()`: active learner (t, f); pending learner (f, f); active admin
   (t, t); suspended admin (f, f).

`011-schedules-tracks.test.sql`:
1. an active user inserts a schedule version for themselves; a pending user's insert fails
   (`42501`); another user's rows are invisible;
2. `day_starts_at` `04:15` and `13:00` fail (`23514`); `12:00` and `00:30` succeed;
3. `timezone = 'Mars/Base'` raises `invalid_timezone`; `Asia/Saigon` and `Asia/Ho_Chi_Minh`
   succeed;
4. an active user inserts and updates their own `user_tracks` row; `budget_minutes` 7, 245 and 62
   fail; `status = 'deleted'` fails; `track_id = 'DSA'` fails; another user's row is invisible and
   an update of it changes nothing; `delete` fails (`42501`);
5. deleting the `auth.users` row removes the profile, schedule versions and tracks (cascade) —
   including an in-force version;
6. **history (MF3):** a user's first version may be backdated; a second version with
   `effective_at = now() - interval '1 hour'` raises `schedule_backdated` (as `authenticated` and
   as `postgres`); a pending version at `now() + interval '1 day'` inserts and then updates; an
   update of the in-force version raises `schedule_in_force`; a direct delete of the in-force
   version (as `postgres`) raises `schedule_in_force`.

- [ ] **Step 1:** Commit 1 (rule tests RED → GREEN, `pnpm lint && pnpm test`).
- [ ] **Step 2:** Write the two pgTAP files and the helpers; `pnpm test:db` → RED (tables missing).
- [ ] **Step 3:** Write the migration; `pnpm db:reset && pnpm test:db` → GREEN.
- [ ] **Step 4:** `pnpm db:types`; `pnpm verify`.
- [ ] **Step 5:** ADR-0017 (written in 2.3) gains one paragraph: the database enforces the
  history rule too (`schedule_versions_guard_history`, MF3), because `apply_event` is callable
  directly.
- [ ] **Step 6: Commit** — `feat(db): profiles, schedule versions and user tracks with RLS`.

### Task 2.5: Events core — log, quota, `local_day`, payload schemas

**Files:**

- Create: `supabase/migrations/20260925000200_events.sql`,
  `supabase/tests/database/020-local-day-parity.test.sql` (generated),
  `supabase/tests/database/030-events.test.sql`, `lib/domain/rules.ts`,
  `lib/domain/events.ts`, `lib/domain/events.test.ts`, `tools/db/local-day-parity.ts`,
  `tools/db/local-day-parity-cli.ts`, `tools/db/local-day-parity.test.ts`,
  `tools/db/sql-sync.test.ts`,
  `docs/adr/0030-learner-write-quota.md`
- Modify: `package.json` (`db:fixtures`), `lib/supabase/database.types.ts`, `docs/adr/README.md`

**Interfaces:**

- Consumes: `LOCAL_DAY_FIXTURES`, `isLocalDay`, `isDayStart` (2.3); `is_active()`,
  `schedule_versions`, `tests.*` helpers (2.4).
- Produces `lib/domain/rules.ts`: `export const RULES_VERSION = 1`.
- Produces `lib/domain/events.ts` (§4.4 is the source of truth; every schema `.strict()`):

  ```ts
  export const LEARNER_EVENT_TYPES = ['block.checked_in', 'item.result', 'lesson.completed',
    'exercise.submitted', 'prompt.completed', 'item.skipped', 'item.readded', 'track.enrolled',
    'track.updated', 'track.paused', 'track.resumed', 'track.removed', 'track.reset',
    'schedule.changed', 'settings.changed'] as const
  export const SYSTEM_EVENT_TYPES = ['plan.generated', 'plan.extra_added', 'onboarding.completed',
    'plan.ai_proposed', 'plan.ai_applied', 'plan.ai_skipped', 'block.checked_in',
    'user_item.created', 'user_item.retired', 'user_item.hidden', 'roadmap.override_set',
    'roadmap.override_revoked', 'roadmap.override_suspended', 'roadmap.override_resumed',
    'admin.bot_token_rotated', 'admin.bootstrapped', 'admin.user_approved', 'admin.user_rejected',
    'admin.user_suspended', 'admin.role_changed', 'admin.ai_flag_changed', 'item.snapshot'] as const
  export type LearnerEventType = (typeof LEARNER_EVENT_TYPES)[number]
  export type SystemEventType = (typeof SYSTEM_EVENT_TYPES)[number]
  export type EventType = LearnerEventType | SystemEventType
  export const EVENT_PAYLOADS = { /* table below */ } satisfies Record<EventType, z.ZodType>
  // `satisfies`, not a type annotation: EventPayload<T> must keep each schema's inferred type
  export type EventPayload<T extends EventType> = z.infer<(typeof EVENT_PAYLOADS)[T]>
  export const MAX_PAYLOAD_BYTES = 1900
  export function parseEventPayload<T extends EventType>(type: T, payload: unknown): EventPayload<T>
  // throws ZodError; also throws when the UTF-8 size of JSON.stringify(payload) exceeds
  // MAX_PAYLOAD_BYTES — below the database's 2048-byte check on `payload::text`, which adds a space
  // after every `:` and `,`, so nothing TypeScript accepts is rejected by the database
  ```

  | Type | Payload schema |
  | --- | --- |
  | `block.checked_in` | `{ status: 'done'\|'partial'\|'skipped', minutes: int 0–600, note?: string ≤ 1000 chars (the 280-grapheme rule is 5.2), auto?: boolean }` |
  | `item.result` | `{ result: 'solved'\|'hint'\|'failed'\|'know'\|'unsure'\|'dont_know', mode?: 'recall'\|'redo' }` |
  | `lesson.completed` | `{ quizScore?: int 0–100 }` |
  | `exercise.submitted` | `{ kind: non-empty string, grade: 'pass'\|'close'\|'miss' }` |
  | `prompt.completed` | `{ selfRating?: 1\|2\|3 }` |
  | `item.skipped`, `item.readded`, `track.paused`, `track.removed`, `track.reset`, `onboarding.completed` | `{}` |
  | `track.enrolled` | `{ roadmapVariant: id, budgetMinutes: int 10–240 step 5, startDate: LocalDay }` |
  | `track.updated` | `{ budgetMinutes?, roadmapVariant?, newPerDay?: int ≥ 0 \| null, throttle?: { dueAbove: int ≥ 0, newPerDay: int ≥ 0 }[] \| null, weeklyTemplate?: object \| null, includeBonus?: boolean }` — at least one key |
  | `track.resumed` | `{ pausedDays: int ≥ 0 }` |
  | `schedule.changed` | `{ timezone: non-empty string, dayStartsAt: DayStart, effectiveAt: ISO-8601 instant with offset }` |
  | `settings.changed` | `{ codeLanguage?: 'python'\|'java'\|'go', shareNotesWithAi?: boolean, theme?: 'light'\|'dark'\|'system' }` — at least one key |
  | `plan.generated` | `{ mode: 'baseline'\|'resume'\|'rebuild', planVersion: int ≥ 1 }` |
  | `plan.extra_added` | `{ itemIds: non-empty string[] }` |
  | `plan.ai_proposed` / `ai_applied` / `ai_skipped` | `{ runId: string, outcome: string, planVersion?: int ≥ 1 }` |
  | `user_item.created` / `retired` / `hidden` | `{ itemType: 'flashcard'\|'exercise'\|'prompt', slug?: string }` |
  | `roadmap.override_set` / `revoked` | `{ key: string, kind: 'insert_block'\|'extra_week'\|'reorder_topics', params?: object }` |
  | `roadmap.override_suspended` / `resumed` | `{ keys: string[] }` |
  | `admin.*` (6 types) | `{ targetUserId?: uuid, from?: string, to?: string }` |
  | `item.snapshot` | `{ level: int, weak: boolean, topSuccesses: int, dueOn: LocalDay \| null, lapses: int, reps: int, rulesVersion: int ≥ 1 }` |

- Produces SQL (migration):

  ```sql
  create table public.events (
    id uuid primary key,                                   -- generated by the client (idempotent retries)
    user_id uuid not null references public.profiles (id) on delete cascade,
    actor_id uuid not null,                                -- no FK: audit rows outlive the actor
    source text not null check (source in ('learner', 'system', 'bot', 'admin')),
    type text not null check (type ~ '^[a-z_]+\.[a-z_]+$'),
    occurred_at timestamptz not null default now(),
    local_day date not null,                               -- computed by the insert trigger, never input
    track_id text,
    item_id text,
    plan_id uuid,                                          -- FK to day_plans arrives in 4.9
    block_id text,
    payload jsonb not null default '{}'::jsonb
      check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 2048),
    rules_version integer not null default public.rules_version() check (rules_version >= 1)
  );
  create index events_user_occurred_idx on public.events (user_id, occurred_at);
  create index events_plan_idx on public.events (plan_id) where plan_id is not null;

  create table public.event_quota (                        -- internal (§4.5): no learner access
    user_id uuid not null references public.profiles (id) on delete cascade,
    local_day date not null,
    count integer not null default 0,
    primary key (user_id, local_day)
  );
  ```

  Functions (define `rules_version()` before the table):
  - `public.rules_version() returns integer language sql immutable` → `1` (kept equal to
    `RULES_VERSION` by `tools/db/sql-sync.test.ts`; M4 bumps both together).
  - `public.learner_event_types() returns text[] language sql immutable` → the 15 learner types.
  - `public.local_day(p_at timestamptz, p_timezone text, p_day_starts_at time) returns date
    language sql stable` → `((p_at at time zone p_timezone) - (p_day_starts_at - time
    '00:00'))::date` (§5.1).
  - `public.user_local_day(p_user_id uuid, p_at timestamptz) returns date language sql stable`
    (security invoker) — the latest `schedule_versions` row with `effective_at <= p_at`, else
    `Asia/Ho_Chi_Minh` / `04:00`. `revoke execute … from public, anon`.
  - Trigger **`events_10_prepare`** (`before insert`, security **invoker**): when `current_user =
    'authenticated'` (a direct or `apply_event` insert — definer functions run as their owner):
    reject any type not in `learner_event_types()` with `forbidden_event_type` (errcode
    `42501`), and force `actor_id := auth.uid()`, `source := 'learner'`,
    `occurred_at := now()`. For every insert: `actor_id` defaults to `user_id` when null, and
    `local_day := public.user_local_day(new.user_id, new.occurred_at)` (§4.5).
  - Trigger **`events_20_quota`** (`before insert`, `security definer set search_path = ''`;
    triggers fire in name order, so it sees the forced `source`): for `source = 'learner'`,
    `insert into public.event_quota … values (new.user_id, new.local_day, 1) on conflict (user_id,
    local_day) do update set count = event_quota.count + 1 returning count` and raise
    `quota_exceeded` (errcode `P0001`) when the count exceeds **500** (§4.5). No `count(*)`.
  - Trigger **`events_append_only`** (`before update`): raises `events_are_append_only`.
  - Function grants: `local_day`, `user_local_day`, `learner_event_types`, `rules_version` →
    `grant execute … to authenticated, service_role` (the events trigger and the column default run
    as the invoker); trigger functions get no grants. Add the four names to the schema-invariants
    allowlist (2.1).
  - Grants: `revoke all on public.events, public.event_quota from anon, authenticated`;
    `grant select, insert on public.events to authenticated`. RLS on both; `events` policies:
    select own; insert check `user_id = (select auth.uid()) and (select public.is_active())`.
    `event_quota`: **no policies**.

- Produces `tools/db/local-day-parity.ts`: `renderLocalDayParitySql(fixtures): string` (the whole
  pgTAP file: one `select is(public.local_day('<at>'::timestamptz, '<tz>', '<start>'::time),
  '<expected>'::date, '<note>');` per fixture, quotes escaped), and a separate CLI
  `tools/db/local-day-parity-cli.ts` that writes
  `supabase/tests/database/020-local-day-parity.test.sql` (so importing the module in a test
  writes nothing); script `"db:fixtures": "tsx tools/db/local-day-parity-cli.ts"`.

- [ ] **Step 1: Failing TypeScript tests.** `lib/domain/events.test.ts`: every type in both
  lists has a schema and the lists are disjoint except `block.checked_in` (learner check-in and
  the system's auto check-in); a valid and an invalid sample per table row; an unknown key is
  rejected (`.strict()`); `track.updated {}` and `settings.changed {}` are rejected; a
  `block.checked_in` note of 950 three-byte characters (Vietnamese) passes the Zod length rule but
  is rejected by the byte limit. `tools/db/local-day-parity.test.ts`:
  the committed SQL file equals `renderLocalDayParitySql(LOCAL_DAY_FIXTURES)` (message: "run
  `pnpm db:fixtures`"); a note with `'` is escaped. `tools/db/sql-sync.test.ts`: the **last**
  `create or replace function public.learner_event_types` in `supabase/migrations/*.sql` (sorted)
  returns exactly `LEARNER_EVENT_TYPES`; the last `public.rules_version()` returns
  `RULES_VERSION`.
- [ ] **Step 2: Failing pgTAP** — `030-events.test.sql`:
  1. an active user's direct insert with `source 'admin'`, a foreign `actor_id` and
     `occurred_at '2000-01-01'` is stored as `learner`, `actor_id` = the user, `occurred_at =
     now()`, `local_day = public.local_day(now(), <their tz>, <their start>)`;
  2. **[RF-1]** with a version `America/St_Johns 04:00` effective in the past the trigger uses it;
     with no version it uses `Asia/Ho_Chi_Minh 04:00`; `user_local_day` picks the latest version
     `≤ p_at` among two — the first backdated, the second at `now() + interval '1 day'` (the
     history trigger forbids a backdated second version), queried at `now()` and at
     `now() + interval '2 days'`;
  3. an `authenticated` insert of `admin.user_approved` fails with `forbidden_event_type`;
     inserting for another `user_id` fails (`42501`); a pending user's insert fails (`42501`);
  4. as `authenticated`, updating or deleting an event fails with `42501` (no privilege — the
     check happens before any trigger); as `postgres`, an update raises
     `events_are_append_only`;
  5. **quota:** 500 learner inserts on one local day succeed, the 501st raises `quota_exceeded`;
     a `system` event inserted as `postgres` for the same user and day still succeeds and the
     counter stays 500;
  6. `authenticated` cannot select or insert `event_quota` (`42501`);
  7. a payload over 2 KB fails (`23514`);
  8. deleting the auth user removes their events and quota rows; an `admin.*` event whose
     `actor_id` is the deleted user but whose `user_id` is someone else survives.
  Generate `020-local-day-parity.test.sql` with `pnpm db:fixtures` → **[RF-1]** SQL `local_day`
  equals TypeScript `localDay` on the shared fixtures.
- [ ] **Step 3: RED** — `pnpm test lib/domain tools/db` and `pnpm test:db`.
- [ ] **Step 4: Implement** the migration, `rules.ts`, `events.ts`, the generator.
- [ ] **Step 5: GREEN** — `pnpm db:reset && pnpm test:db`, `pnpm db:types`, `pnpm verify`.
- [ ] **Step 6: ADR-0030** (learner write quota: definer `BEFORE INSERT` trigger + internal
  `event_quota`, 500/day, system events uncounted, Upstash only from v1.1).
- [ ] **Step 7: Commit** — `feat(db): event log with write quota and local_day parity`.

### Task 2.5b: RPCs — `apply_event`, `apply_system_event`, admin functions, apply helpers

**Files:**

- Create: `supabase/migrations/20260925000300_rpc.sql`,
  `supabase/tests/database/040-apply-event.test.sql`,
  `supabase/tests/database/041-system-and-admin.test.sql`, `lib/events/ids.ts`,
  `lib/events/ids.test.ts`, `lib/events/apply.ts`, `lib/events/apply.test.ts`,
  `docs/adr/0007-event-log-and-apply-event.md`
- Modify: `lib/i18n/vi.ts` (+ `vi.test.ts` keys), `lib/supabase/database.types.ts`,
  `docs/adr/README.md`

**Interfaces:**

- Consumes: everything from 2.4 and 2.5.
- Produces SQL (every function `set search_path = ''`; errors are `raise exception '<code>'`
  with the errcode shown, so PostgREST returns the code as `message`). The schema-invariants
  allowlist (2.1) gains `apply_event`, `admin_set_status`, `admin_set_role`:

  **`public.apply_event(p_event jsonb, p_changes jsonb default '[]'::jsonb, p_expected jsonb
  default '{}'::jsonb) returns jsonb`** — `security invoker`; `grant execute` to
  `authenticated` only (revoke from `public`, `anon`). In order:
  1. `auth.uid()` null → `not_authenticated` (`42501`); `p_event ? 'user_id'` and it differs from
     `auth.uid()` → `forbidden` (`42501`) (§4.5);
  2. non-empty `p_changes` or `p_expected` → `not_implemented` (decision 8);
  3. `type` not in `learner_event_types()` → `invalid_event`; a learner type other than the seven
     M2 types (`track.enrolled`, `track.updated`, `track.paused`, `track.resumed`,
     `track.removed`, `schedule.changed`, `settings.changed`) → `not_implemented`;
  4. `not is_active()` → `inactive` (`42501`);
  5. an event with this `id` already exists (visible to the caller: their own) → return
     `{"outcome": "duplicate", "versions": {}}` without any change (RF-2 groundwork); a concurrent
     duplicate that loses the race raises `unique_violation` on `events_pkey` at step 6 — catch
     it, and return `duplicate` only if the existing event is now visible as the caller's own;
     otherwise (another user's id) raise `id_conflict` — the same rule as `apply_system_event`
     (owner review SF4);
  6. insert the event (`id`, `user_id = auth.uid()`, `type`, `track_id`, `item_id`, `plan_id`,
     `block_id`, `payload`, `rules_version` from `p_event`; the trigger forces the rest);
  7. apply the state change — all in the same transaction, so a failure removes the event too:
     - `track.enrolled` (needs `track_id`): upsert `user_tracks` (`roadmap_variant`,
       `budget_minutes`, `start_date` from the payload, `status = 'active'`);
     - `track.updated`: update only the payload keys present (`budgetMinutes` →
       `budget_minutes`, `roadmapVariant`, `newPerDay`, `throttle`, `weeklyTemplate`,
       `includeBonus`); no row → `track_not_enrolled`;
     - `track.paused` (`active → paused`), `track.resumed` (`paused → active`), `track.removed`
       (`active | paused → removed`); any other current status → `invalid_transition`;
     - `schedule.changed`: upsert `schedule_versions (user_id, effective_at, timezone,
       day_starts_at)` from the payload, on conflict update `timezone`, `day_starts_at` (the
       whole desired schedule is always sent, so a second change before the day start replaces
       the first);
     - `settings.changed`: update `profiles.code_language` / `share_notes_with_ai` for the keys
       present (`theme` is ignored — decision 7);
  8. return `{"outcome": "applied", "versions": {}}`.

  **`public.apply_system_event(p_user_id uuid, p_event jsonb, p_changes jsonb default
  '[]'::jsonb, p_expected jsonb default '{}'::jsonb) returns jsonb`** — `security definer`;
  `execute` for `service_role` only (revoke from `public`, `anon`, `authenticated`). Non-empty
  changes → `not_implemented`; `type` must be a system type; in M2 only
  `onboarding.completed` is implemented (others → `not_implemented`); the target profile must be
  `active` (`inactive`); an existing event with this `id` **and** `user_id = p_user_id` →
  `duplicate` (a definer function sees every row, so an `id` owned by another user raises
  `id_conflict`); insert with `source` =
  `p_event->>'source'` if in (`system`, `bot`, `admin`) else `system`, `actor_id` =
  `p_event->>'actor_id'` else `p_user_id`; `onboarding.completed` sets
  `onboarded_at = coalesce(onboarded_at, now())`; returns `{"outcome", "versions": {}}`.

  **`public.admin_set_status(p_user_id uuid, p_status text) returns jsonb`** and
  **`public.admin_set_role(p_user_id uuid, p_role text) returns jsonb`** — `security definer`;
  `execute` for `authenticated` (the function itself checks the caller); `revoke execute … from
  public, anon` (Supabase's default privileges grant EXECUTE on new functions to `anon`,
  `authenticated` and `service_role` — every function in this task states its grants
  explicitly). Not `is_admin()` →
  `forbidden` (`42501`); `p_user_id = auth.uid()` → `cannot_change_self` (decision 17); unknown
  user → `not_found`. Status transitions (decision 17): `pending → active | rejected`,
  `active → suspended`, `suspended | rejected → active`; anything else →
  `invalid_transition`. `→ active` sets `approved_by = auth.uid()`, `approved_at = now()`. Role:
  `learner | admin`, same role → `no_change`. Each writes one audit event: `user_id` = target,
  `actor_id` = the admin, `source = 'admin'`, type `admin.user_approved` / `admin.user_rejected`
  / `admin.user_suspended` / `admin.role_changed`, payload `{ targetUserId, from, to }`. Returns
  `{ "from": …, "to": … }`.

  **`public.admin_bootstrap(p_user_id uuid) returns boolean`** — `security definer`, `execute`
  for `service_role` only (`revoke … from public, anon, authenticated`). Unless the profile is
  **never processed** — `role = 'learner' AND status = 'pending' AND approved_at IS NULL` — it
  returns `false` and writes nothing (decision 23). Otherwise role `admin`,
  status `active`, `approved_at = now()`, event `admin.bootstrapped`
  (`source 'system'`, `actor_id` = the user, payload `{ targetUserId, from: <old status>, to:
  'active' }`) → `true` (§2.5).

- Produces TypeScript:

  ```ts
  // lib/events/ids.ts — decision 9
  /** UUIDv5 of `key` in the namespace `requestId` (node:crypto sha1). Deterministic. */
  export function deriveEventId(requestId: string, key: string): string

  // lib/events/apply.ts — import 'server-only'
  export type ApplyOutcome = 'applied' | 'duplicate'
  export type EventErrorCode = 'quota_exceeded' | 'forbidden' | 'inactive' | 'invalid_event'
    | 'not_implemented' | 'invalid_transition' | 'track_not_enrolled' | 'invalid_timezone'
    | 'ai_personalization_off' | 'id_conflict' | 'schedule_backdated' | 'schedule_in_force'
    | 'unknown'
  export class EventError extends Error {
    readonly code: EventErrorCode
    readonly userMessage: string       // Vietnamese, from vi.errors
  }
  export type EventInput<T extends EventType> = {
    id: string; type: T; payload: EventPayload<T>
    trackId?: string; itemId?: string; planId?: string; blockId?: string
  }
  export async function applyLearnerEvent<T extends LearnerEventType>(
    supabase: SupabaseClient<Database>, event: EventInput<T>,
  ): Promise<ApplyOutcome>
  export async function applySystemEvent<T extends SystemEventType>(
    admin: SupabaseClient<Database>, userId: string,
    event: EventInput<T> & { source?: 'system' | 'bot' | 'admin'; actorId?: string },
  ): Promise<ApplyOutcome>
  ```

  Both validate the payload with `parseEventPayload` before the RPC (an invalid payload throws
  `EventError('invalid_event')` without calling the database), send snake_case keys plus
  `rules_version: RULES_VERSION`, and map the RPC error `message` to the code (unknown messages
  → `unknown`). `vi.errors`: `quotaExceeded` = "Bạn đã ghi nhận quá nhiều hoạt động hôm nay. Hãy
  thử lại vào ngày mai." (§4.5), `saveFailed` = "Không lưu được thay đổi. Bạn thử lại nhé.",
  `notAllowed` = "Bạn không có quyền thực hiện thao tác này.", `invalidTransition` = "Lộ trình
  đang ở trạng thái khác. Bạn tải lại trang nhé.", `invalidTimezone` = "Múi giờ không hợp lệ.".
  Mapping: `quota_exceeded` → `quotaExceeded`; `forbidden`, `inactive` → `notAllowed`;
  `invalid_transition`, `track_not_enrolled` → `invalidTransition`; `invalid_timezone` →
  `invalidTimezone`; everything else → `saveFailed`.

- [ ] **Step 1: Failing pgTAP.** `040-apply-event.test.sql`:
  1. `track.enrolled` for an active user creates the `user_tracks` row and exactly one event
     (`source learner`, `actor_id` = user);
  2. **the same event id again** → `outcome duplicate`, still one event, and a changed
     `budgetMinutes` in the retry does **not** change the row; an id already used by **another
     user's** event → `id_conflict`, no row changed;
  3. `p_event.user_id` of another user → `forbidden`; `anon` cannot execute (`42501`);
  4. `admin.user_approved` → `invalid_event`; `item.result` → `not_implemented`; a non-empty
     `p_changes` → `not_implemented`; a pending user → `inactive`;
  5. `track.updated {budgetMinutes: 90}` changes only `budget_minutes`; on a track not enrolled →
     `track_not_enrolled` **and no event row remains**;
  6. `track.paused` → `paused`; paused again → `invalid_transition`; `track.resumed` → `active`;
     `track.removed` → `removed`;
  7. `schedule.changed` inserts a version; a second change with the same `effectiveAt` replaces
     it (one row); `timezone 'Mars/Base'` → `invalid_timezone` and no event row remains;
  8. `settings.changed {codeLanguage: 'go'}` updates the profile; `{shareNotesWithAi: true}` →
     `ai_personalization_off`;
  9. learner events increment `event_quota` for the user's local day.
  `041-system-and-admin.test.sql`:
  1. `authenticated` and `anon` have no execute privilege on `apply_system_event` and
     `admin_bootstrap` (`has_function_privilege` false); `service_role` has;
  2. as `service_role`: `onboarding.completed` sets `onboarded_at` and writes a `system` event;
     repeating the id → `duplicate` and `onboarded_at` unchanged; a learner type →
     `invalid_event`; a pending user → `inactive`;
  3. a learner calling `admin_set_status` → `forbidden`; an admin approving a pending user →
     `active`, `approved_by` = admin, one `admin.user_approved` event with `actor_id` = admin,
     `source admin`, payload `{targetUserId, from: pending, to: active}`; `pending → suspended` →
     `invalid_transition`; the admin targeting themselves → `cannot_change_self`; a **suspended**
     admin → `forbidden`;
  4. `admin_set_role` → role changed + `admin.role_changed`; same role → `no_change`;
  5. `admin_bootstrap` on a never-processed pending user → `true`, active admin, one
     `admin.bootstrapped` event; again → `false`, still one event; `false` with no change and no
     event for: a **suspended admin** (stays suspended), a **demoted admin** (learner, active,
     `approved_at` set — stays learner), a **rejected** learner (stays rejected);
     `anon` has no execute privilege on any function of this task, `authenticated` none on
     `apply_system_event` / `admin_bootstrap`;
  6. admin and system events do not touch `event_quota`.
- [ ] **Step 2: Failing TypeScript tests.** `lib/events/ids.test.ts`: same inputs → same id;
  the version nibble is `5` and the variant `8|9|a|b`; different keys → different ids; an invalid
  `requestId` throws. `lib/events/apply.test.ts` (a fake client whose `rpc` records calls and
  returns `{ data, error }`): snake_case body with `rules_version: RULES_VERSION`;
  `applied` / `duplicate` pass through; an error message `quota_exceeded` → `EventError` with
  `code 'quota_exceeded'` and the §4.5 Vietnamese message; an unknown message → `unknown` +
  `saveFailed`; an invalid payload throws **before** `rpc` is called; `applySystemEvent` sends
  `p_user_id` and `source` / `actor_id` when given.
- [ ] **Step 3: RED → implement → GREEN** (`pnpm db:reset && pnpm test:db`, `pnpm test`).
- [ ] **Step 4:** `pnpm db:types`; `pnpm verify`.
- [ ] **Step 5: ADR-0007** (event log + derived state; pure TypeScript domain; `apply_event`
  security invoker; idempotent client ids; M2 applies state tables, derived tables in 4.9).
- [ ] **Step 6: Commit** — `feat(db): apply_event, apply_system_event and admin functions`.

### Task 2.6: Supabase clients, proxy, DAL, guards

**Files:**

- Create: `lib/supabase/server.ts`, `lib/supabase/admin.ts`, `lib/supabase/proxy.ts`,
  `lib/supabase/proxy.test.ts`, `proxy.ts`, `lib/auth/dal.ts`, `lib/auth/dal.test.ts`,
  `lib/auth/paths.ts`, `lib/auth/paths.test.ts`, `lib/auth/guards.ts`,
  `tools/guards/server-guards.ts`, `tools/guards/server-guards.test.ts`,
  `docs/adr/0002-supabase-keys-and-getclaims.md`, `docs/adr/0006-proxy-and-dal.md`,
  `docs/adr/0019-cache-components-off.md`
- Modify: `CLAUDE.md` (guard list + `requireOnboarded`), `docs/adr/README.md`,
  `tools/eslint/layer-imports.mjs`, `tools/guards/eslint-rules.test.ts`

**Interfaces:**

- Consumes: `serverEnv()` (2.1), `Database` types (2.4–2.5b).
- Produces:

  ```ts
  // lib/supabase/server.ts — import 'server-only'
  /** Per-request client with the user's session cookies (RLS applies). */
  export async function createClient(): Promise<SupabaseClient<Database>>
  // cookies(): getAll → cookieStore.getAll(); setAll → set each cookie inside try/catch
  // (Server Components cannot set cookies; proxy.ts refreshes the session).

  // lib/supabase/admin.ts — import 'server-only'
  /** Secret-key client: bypasses RLS. Only for system, bot and admin writes (§2.1). */
  export function createAdminClient(): SupabaseClient<Database>
  // { auth: { persistSession: false, autoRefreshToken: false } }

  // lib/supabase/proxy.ts
  export function isPublicPath(pathname: string, vercelEnv: string | undefined): boolean
  export async function updateSession(request: NextRequest): Promise<NextResponse>

  // lib/auth/paths.ts
  export type HomePath = '/pending' | '/onboarding' | '/today'
  export function homePathFor(user: Pick<SessionUser, 'status' | 'onboardedAt'>): HomePath
  export function safeNextPath(next: string | null | undefined): string | null

  // lib/auth/dal.ts — import 'server-only'
  export type Role = 'learner' | 'admin'
  export type AccountStatus = 'pending' | 'active' | 'rejected' | 'suspended'
  export type CodeLanguage = 'python' | 'java' | 'go'
  export type SessionUser = {
    id: string; email: string | null; role: Role; status: AccountStatus
    displayName: string | null; avatarUrl: string | null; codeLanguage: CodeLanguage | null
    onboardedAt: string | null; aiPersonalization: boolean
    isAdmin: boolean                 // role === 'admin' && status === 'active'
  }
  export const getSessionUser: () => Promise<SessionUser | null>  // React cache(); getClaims() + own profile
  export async function requireUser(): Promise<SessionUser>        // none → redirect('/sign-in')
  export async function requireActive(): Promise<SessionUser>      // status ≠ active → redirect('/pending')
  export async function requireOnboarded(): Promise<SessionUser>   // + !onboardedAt → redirect('/onboarding')
  export async function requireAdmin(): Promise<SessionUser>       // requireActive + !isAdmin → notFound()
  export async function requireDevAccess(): Promise<void>          // process.env.VERCEL_ENV === 'production' → requireAdmin()

  // lib/auth/guards.ts
  /** Explicit marker for handlers that are public on purpose (§2.2). */
  export function publicRoute(): void
  export const GUARD_NAMES: readonly string[]
  // ['requireUser', 'requireActive', 'requireOnboarded', 'requireAdmin', 'requireDevAccess',
  //  'requireBotToken', 'requireCronSecret', 'publicRoute']
  ```

**Behaviour:**

- `getSessionUser`: `supabase.auth.getClaims()` (never `getSession()`, §2.1); no claims → `null`;
  reads the caller's own `profiles` row (RLS); a missing row reads as `status 'pending'`,
  `role 'learner'` (safe default). Wrapped in React `cache()` so one request reads the profile
  once (§2.2).
- `homePathFor`: not active → `/pending`; active without `onboardedAt` → `/onboarding`; else
  `/today`. `safeNextPath`: only same-origin paths — starts with `/`, not `//`, no `\`, **no
  character ≤ U+0020 or U+007F** (browsers strip tabs and newlines, turning `/\t/evil.test` into
  `//evil.test`), `new URL(next, 'http://x').host === 'x'`, not `/sign-in` or `/auth/…` — else
  `null` (open-redirect guard).
- `isPublicPath`: exactly `/`, `/sign-in`, `/auth/callback`; plus `/dev` and `/dev/**` when
  `vercelEnv !== 'production'` (the catalog stays reachable for e2e and previews; 2.8 makes it
  admin-only in production). The proxy passes `process.env.VERCEL_ENV` and reads the Supabase
  values through `publicSupabaseEnv()` (2.1), never `serverEnv()`.
- `updateSession`: `createServerClient` with `getAll` from the request and `setAll(cookies,
  headers)` writing cookies to the request and a fresh `NextResponse.next({ request })`, and the
  cache headers onto the response (spike finding); then `await supabase.auth.getClaims()`; no
  claims and not public → redirect to `/sign-in?next=<pathname + search>`. **No database
  queries** (§2.2).
- Root `proxy.ts` (Next 16 — read `node_modules/next/dist/docs` for the `proxy` export and
  `config.matcher` shape before writing it): calls `updateSession`; matcher covers pages only —
  excludes `api/`, `_next/static`, `_next/image`, `favicon.ico` and files with an extension.

**Architecture test** — `tools/guards/server-guards.ts` exports
`guardViolations(file: string, source: string): string[]` (TypeScript compiler API): for a module
whose first statement is the `'use server'` directive, every exported function (declaration or
`const` arrow/function) must have as its **first statement** a call — optionally `await`ed — to
a name in `GUARD_NAMES`; for an `app/**/route.ts` file, the same for exported `GET`, `POST`,
`PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`. The test covers: a guarded action (0), an unguarded
action (1), a guard called second (1), an exported arrow function (checked), a non-exported
helper (ignored), a route handler without a guard (1), `publicRoute()` accepted. It also checks
every exported async function in `features/*/queries.ts` (§2.2: "every `features/*/queries.ts`
loader calls the DAL") — a loader without a guard as its first statement is a violation (test
case). Then it scans every `*.ts`/`*.tsx` under `app`, `features`, `lib`, `components` and
expects zero violations (§2.2, §7.2).

**Client-module rule (owner review SF7):** `layers/imports` also reports any import that
resolves to `lib/env` or `lib/supabase/admin` from a module whose first statement is the
`'use client'` directive (message: "Client modules must not import server configuration or the
secret-key client."). Rule tests: a `'use client'` file under `features/x/components/` importing
`@/lib/env` (error) and `../../../lib/supabase/admin` (error); the same imports without the
directive (allowed by this rule); a `'use client'` file importing `@/lib/utils` (allowed).

- [ ] **Step 1: Failing tests** — `paths.test.ts` (`homePathFor` matrix for the four statuses ×
  onboarded; `safeNextPath('/today')` → `/today`; `'/settings?tab=x'` and the percent-encoded
  `'/%09/x'` are kept (same origin); `'//evil.test'`, `'https://evil.test'`, `'/\\evil'`,
  `'/\t/evil.test'`, `'/\n/evil.test'`, `''`, `null`, `'/sign-in'` → `null`); `proxy.test.ts`
  (`isPublicPath` for `/`, `/sign-in`, `/auth/callback`, `/today`, `/dev/components` in preview vs production,
  `/sign-in-x`); `dal.test.ts` — mock `@/lib/supabase/server` (fake `auth.getClaims` and a
  `from('profiles')` chain), `next/navigation` (`redirect`/`notFound` throw tagged errors) and
  React `cache` (a memoising stand-in): no claims → `null` and `requireUser` redirects
  `/sign-in`; pending → `requireActive` redirects `/pending`; active, not onboarded →
  `requireOnboarded` redirects `/onboarding`; active learner → `requireAdmin` → `notFound`;
  active admin passes and `isAdmin` is true; suspended admin → `requireAdmin` redirects
  `/pending`; missing profile row → `pending`; `requireUser` + `requireActive` in one request
  read the profile once; `requireDevAccess` passes outside production and requires an admin in
  production; `server-guards.test.ts` as above.
- [ ] **Step 2: RED** — `pnpm test lib/auth lib/supabase tools/guards`.
- [ ] **Step 3: Implement** the clients, `proxy.ts`, DAL, paths, guards, guard checker.
- [ ] **Step 4: GREEN** + `pnpm verify`; `pnpm test:e2e` still green (the catalog and `/` stay
  public). `not-found.spec.ts`: a signed-out visit to an unknown path now redirects to
  `/sign-in?next=…` — assert that; task 2.7a adds the signed-in 404 case.
- [ ] **Step 5: ADRs** — 0002 (publishable/secret keys, `getClaims()` on the server, the secret
  client only in `lib/supabase/admin.ts`), 0006 (`proxy.ts` only refreshes the session and
  redirects signed-out users; layouts + DAL decide access; every action and handler calls a
  guard, enforced by the architecture test), 0019 (Cache Components stay off in v1: every screen
  is per-user and dynamic). `CLAUDE.md` guard list gains `requireOnboarded` and
  `requireDevAccess` (decision 10).
- [ ] **Step 6: Commit** — `feat(auth): Supabase clients, session proxy, DAL and guard checks`.

### Task 2.6a: Form and focus-page primitives

**Files:** Create `components/ui/{checkbox,radio-group,native-select}.tsx`,
`components/patterns/{focus-layout,form-field,form-error-summary,step-indicator,choice-card}.tsx`
and colocated `*.test.tsx`; Modify `docs/design/COMPONENTS.md`, `app/dev/components/registry.tsx`,
`lib/i18n/vi.ts` (+ key test).

**Interfaces** (token utilities only; the global focus ring; labels from `vi.ts`):

- `Checkbox` (ui) — Radix `Checkbox.Root` + `Indicator` (`Check` icon, `aria-hidden`); 20 px
  box, `border-border-strong`, checked `bg-primary text-primary-foreground`; a transparent
  pseudo-element gives a **≥ 44 px hit area** (DESIGN_SYSTEM §5); props = Radix Root props.
- `RadioGroup`, `RadioGroupItem` (ui) — Radix RadioGroup; same sizing and hit area; the group is
  a vertical stack with `gap-3`.
- `NativeSelect` (ui) — a styled native `<select>` (44 px, `border-border-strong`,
  `rounded-md`, `bg-surface`, `text-base`, `ChevronDown` icon `aria-hidden`, `aria-invalid`
  styling like Input); props = `ComponentProps<'select'>`. Native, so long lists (≈ 420 time
  zones) keep the platform picker on phones.
- `FocusLayout` (pattern) — the frame for pages outside the AppShell (`/`, `/sign-in`,
  `/pending`, `/onboarding`): skip link, a header with the "Học Đều" wordmark linking to `/` and
  an optional `headerActions` slot, `main#main` centred with `width: 'narrow' | 'wide'`
  (`max-w-md` / `max-w-2xl`), page gutters per DESIGN_SYSTEM §5. Props `{ children; width?;
  headerActions? }`.
- `FormField` (pattern) — `{ id: string; label: string; description?: string; error?: string;
  required?: boolean; children: (control: { id: string; 'aria-describedby'?: string;
  'aria-invalid'?: true; required?: boolean }) => React.ReactNode }`; renders Label, the control,
  the description (`text-muted-foreground`) and the error (`text-danger`, `CircleAlert` icon +
  text, `id={`${id}-error`}`); `aria-describedby` joins the description and error ids.
- `FormErrorSummary` (pattern, client) — `{ title: string; errors: { fieldId: string; message:
  string }[] }`; nothing when empty; otherwise `role="alert"`, `tabIndex={-1}`, focused when the
  errors change, each message a link to `#fieldId` (DESIGN_SYSTEM §5 forms).
- `StepIndicator` (pattern) — `{ steps: readonly string[]; current: number /* 0-based */ }`;
  visible text "Bước {n}/{total}: {label}" and an `<ol>` of step dots with
  `aria-current="step"` on the current one (never colour alone: the current dot is larger and
  the label is text).
- `ChoiceCard` (pattern) — `{ htmlFor: string; control: React.ReactNode; title: React.ReactNode;
  description?: React.ReactNode }`; a `<label>` card (≥ 44 px, `border`, `rounded-lg`,
  `bg-surface`), selected state from the control (`has-data-[state=checked]:border-primary` +
  `bg-primary-soft`) so it is not colour-only (the control shows the check).
- `vi.forms`: `required` ("Bắt buộc"), `errorSummaryTitle` ("Vui lòng kiểm tra lại các mục
  sau"), `step` ("Bước").

- [ ] **Step 1: Failing tests** — each component renders its role/label wiring
  (`getByRole('checkbox', { name })` via `Label htmlFor`, `radiogroup`/`radio`, `combobox` for
  the select), keyboard toggling (Space on the checkbox, arrows in the radio group via
  `userEvent`), FormField's `aria-describedby`/`aria-invalid` and error text, the summary's
  `role="alert"` + focus + `href="#field"`, StepIndicator's text and `aria-current`, ChoiceCard
  toggles its checkbox when the card text is clicked, FocusLayout renders `main#main` and the
  wordmark link.
- [ ] **Step 2: RED → implement → GREEN** (`pnpm test components`), `pnpm lint`.
- [ ] **Step 3: Catalog** — a `COMPONENTS.md` entry (entry format) and a `/dev/components`
  registry entry per component showing every state (checked, invalid, disabled, error summary
  with two errors, step 2 of 4, …); `pnpm test:e2e` (catalog axe light/dark) green.
- [ ] **Step 4: Verify** `pnpm verify && pnpm test:e2e`. **Commit** — `feat(ui): checkbox,
  radio group and native select; form and focus-page patterns`.

### Task 2.7a: Sign-in, OAuth callback, test login, guarded route groups

**Files:**

- Create: `app/(public)/sign-in/page.tsx`, `app/(public)/auth/callback/route.ts`,
  `app/(account)/{layout.tsx,loading.tsx,error.tsx}`, `app/(account)/pending/page.tsx`
  (placeholder), `app/(onboarding)/{layout.tsx,loading.tsx,error.tsx}`,
  `app/(onboarding)/onboarding/page.tsx` (placeholder), `app/(app)/{layout.tsx,loading.tsx,error.tsx}`,
  `app/(app)/today/page.tsx` (placeholder), `features/auth/{actions.ts,index.ts}`,
  `features/auth/components/sign-in-panel.tsx` (+ test), `lib/auth/bootstrap.ts` (+ test),
  `supabase/seed.sql`, `e2e/support/users.ts`, `e2e/support/auth.ts`, `e2e/auth.spec.ts`,
  `docs/adr/0003-oauth-and-test-login.md`
- Modify: `app/dev/components/registry.tsx`, `docs/design/COMPONENTS.md`, `lib/i18n/vi.ts`,
  `e2e/not-found.spec.ts`, `docs/adr/README.md`

**Interfaces:**

- Consumes: DAL, paths, guards, clients (2.6); `admin_bootstrap` (2.5b); FocusLayout, FormField
  (2.6a); `serverEnv()` (2.1).
- Produces:

  ```ts
  // features/auth/actions.ts — 'use server'; every export starts with its guard
  export async function signInWithProvider(formData: FormData): Promise<never>
  //   publicRoute(); provider ∈ {'google','github'}; signInWithOAuth({ provider,
  //   options: { redirectTo: `${siteUrl}/auth/callback?next=<safe next>` } }) → redirect(data.url)
  export type TestLoginState = { error: string | null }
  export async function signInWithTestLogin(prev: TestLoginState, formData: FormData): Promise<TestLoginState>
  //   publicRoute(); refuses unless serverEnv().authTestLogin (§2.3 — the form is not the only lock);
  //   signInWithPassword → bootstrapAdminIfListed → redirect(safeNextPath(next) ?? homePathFor(profile))
  //   where `profile` is read fresh after bootstrapping (not through the cached DAL)
  export async function signOut(): Promise<never>          // requireUser(); auth.signOut() → redirect('/sign-in')

  // lib/auth/bootstrap.ts — import 'server-only'
  /** §2.5: a provider-verified e-mail in ADMIN_EMAILS becomes an active admin (decision 23). */
  export async function bootstrapAdminIfListed(
    user: { id: string; email: string | null | undefined; emailConfirmedAt: string | null | undefined },
    deps?: { adminEmails?: readonly string[]; admin?: SupabaseClient<Database> },
  ): Promise<boolean>
  ```

- **Route groups** (§2.2): `(public)` no guard — `/sign-in` (signed-in users → `homePathFor`),
  `/auth/callback`; `(account)` layout `requireUser()`; `(onboarding)` layout `requireActive()`
  and onboarded users → `/today`; `(app)` layout `requireOnboarded()` → the AppShell (as M1 has
  it; 2.7b wires sign-out and the title). Each group has `loading.tsx` (LoadingState) and
  `error.tsx` (ErrorState with retry) (§7.5). Placeholders (decision 13): `/pending`,
  `/onboarding` and `/today` compose the PageHeader and EmptyState patterns with `vi` copy (2.7b
  replaces `/pending`, 2.10 `/onboarding`, 5.1 `/today`).
- **Callback** `GET /auth/callback`: `publicRoute()`; `code` → `exchangeCodeForSession(code)`;
  failure or no code → `/sign-in?error=oauth`; success → `bootstrapAdminIfListed` with the
  returned user (`email`, `email_confirmed_at`) → redirect to `safeNextPath(next) ??
  homePathFor(profile)` (profile read fresh).
- **Sign-in page** (`FocusLayout`): "Tiếp tục với Google", "Tiếp tục với GitHub" (each a `<form
  action={signInWithProvider}>` with a hidden `provider` and `next`), an error Banner for
  `?error=oauth` ("Đăng nhập không thành công. Bạn thử lại nhé."), and — only when
  `serverEnv().authTestLogin` — a "Đăng nhập thử nghiệm" form (email, password, FormField,
  `useActionState`; a wrong password shows "Email hoặc mật khẩu không đúng.").
- **`supabase/seed.sql`** (synthetic users only, password `test-password-123`, the spike's
  `auth.users` + `auth.identities` inserts): `admin@example.test`
  (`11111111-1111-4111-8111-111111111111`) set to active admin, `learner@example.test`
  (`22222222-2222-4222-8222-222222222222`) active, `pending@example.test`
  (`33333333-3333-4333-8333-333333333333`) pending — after the inserts, `update public.profiles`
  sets their role/status. Manual local use only (decision 14).
- **`e2e/support/users.ts`** (secret key from `process.env`, decision 14; `import type` only from
  `lib/`): `createTestUser(options?: { status?: AccountStatus; role?: Role; onboarded?: boolean;
  email?: string; name?: string }): Promise<{ id: string; email: string; password: string; name:
  string }>` (admin `createUser` with `email_confirm: true`, `user_metadata.full_name`, then a
  profile update; default e-mail `e2e-<uuid>@example.test`, default name "Học viên <4 chars>"),
  `getProfile(id)`, `setStatus(id, status)`, `deleteTestUser(id)`, `deleteUserByEmail(email)`.
  **`e2e/support/auth.ts`:** `signIn(page, user, next?)` through the test-login form.

- [ ] **Step 1: Failing unit tests** — `bootstrap.test.ts` (listed + confirmed → calls
  `admin_bootstrap`, returns its boolean; listed but unconfirmed → `false`, no call; not listed →
  `false`; case-insensitive match); `sign-in-panel.test.tsx` (both provider buttons; the
  test-login form only when `testLogin`; the error banner).
- [ ] **Step 2: Failing e2e** — `e2e/auth.spec.ts` (axe in light and dark on every page it
  renders):
  1. signed out, `/today` → `/sign-in?next=%2Ftoday`; the page shows both providers and the
     test-login form;
  2. a pending user signs in → `/pending`; an active, not-onboarded user → `/onboarding`; an
     active onboarded user with `next=/today` → `/today` inside the AppShell;
  3. a wrong password shows the error and stays on `/sign-in`;
  4. **bootstrap** (desktop project only; each scenario first `deleteUserByEmail(<its address>)`):
     a never-processed pending `bootstrap-admin@example.test` signs in → lands on `/onboarding`
     as an active admin; a **rejected** `bootstrap-rejected@example.test` signs in → stays on
     `/pending` with the rejected copy, still `learner`/`rejected`; a **demoted**
     `bootstrap-demoted@example.test` (learner, active, `approved_at` set, onboarded) signs in →
     `/today`, still `learner` (decision 23);
  5. a signed-in user visiting `/sign-in` goes to their home path; a `next` of
     `//evil.test` is ignored.
  `not-found.spec.ts` gains the signed-in case (an active onboarded user gets the Vietnamese 404
  with a link home, axe clean).
- [ ] **Step 3: RED → implement → GREEN** (`pnpm test`, `pnpm db:reset && pnpm test:e2e`);
  catalog entry for `SignInPanel`.
- [ ] **Step 4: ADR-0003** (Google + GitHub only; env-gated test login locked by `lib/env.ts` and
  the hosted projects' disabled email provider; approval in-app only).
- [ ] **Step 5: Verify** `pnpm verify:full`. The real Google/GitHub sign-in on a staging preview
  is an **[owner]** check at the PR stop (decision 4).
- [ ] **Step 6: Commit** — `feat(auth): sign-in, OAuth callback, test login and guarded route
  groups`.

### Task 2.7b: Pending screen, landing page, AppShell sign-out

**Files:**

- Create: `app/(public)/page.tsx` (moved from `app/page.tsx`; its test moves alongside),
  `features/auth/components/{landing.tsx,pending-status.tsx,status-watcher.tsx}` (+ tests),
  `e2e/account.spec.ts`
- Modify: `app/(account)/pending/page.tsx` (placeholder → status screen), `app/(app)/layout.tsx`
  (sign-out), `components/patterns/app-shell/{index.tsx,top-bar.tsx,account-menu.tsx,sidebar.tsx}`
  (+ tests), `app/dev/app-shell/demo.tsx`, `app/dev/components/registry.tsx`,
  `docs/design/COMPONENTS.md`, `lib/i18n/vi.ts`, `features/auth/index.ts`, `e2e/smoke.spec.ts`

**Behaviour:**

- **Landing `/`** (`FocusLayout`): h1 "Học Đều", the positioning line ("Nền tảng học tập dẫn dắt
  bởi AI — mỗi ngày một chút, AI giúp bạn tiến đều."), a "Đăng nhập" link-button to `/sign-in`;
  signed-in users → `homePathFor` (§2.4).
- **Pending page:** copy per status — pending "Tài khoản của bạn đang chờ duyệt" + "Quản trị viên
  sẽ duyệt sớm. Trang này tự chuyển khi tài khoản được duyệt."; rejected "Tài khoản chưa được
  duyệt"; suspended "Tài khoản đang tạm khoá"; a sign-out button in `headerActions`; active users
  → `homePathFor`. `StatusWatcher` (client leaf) calls `router.refresh()` every 30 s, on `focus`
  and on `visibilitychange` to visible, and renders nothing; the server page redirects once the
  status is `active` ("moves on automatically when approved", §2.4).
- **AppShell (M1 deferred #5):** drop the `title` prop — `TopBar` derives the title from
  `usePathname()` via `NAV_ITEMS` + `ADMIN_ITEMS` (fallback "Học Đều"); `onSignOut?: () =>
  Promise<void>` invoked as `() => void onSignOut()` from `DropdownMenuItem onSelect` (Radix
  passes a non-serializable Event). The `(app)` layout passes `onSignOut={signOut}`. Update the
  AppShell tests, the `/dev/app-shell` demo, the catalog entry and `COMPONENTS.md`.

- [ ] **Step 1: Failing unit tests** — `landing.test.tsx`; `pending-status.test.tsx` (copy per
  status); `status-watcher.test.tsx` (fake timers: refresh after 30 s and on `focus`); AppShell:
  title from the pathname, sign-out invoked without arguments.
- [ ] **Step 2: Failing e2e** — `e2e/account.spec.ts` (axe light/dark):
  1. a pending user on `/pending` sees the pending copy; the admin API sets them `active`; after
     a `focus` event the page moves to `/onboarding` by itself;
  2. rejected and suspended users see their copy and can sign out;
  3. an active onboarded user: the top bar reads "Hôm nay" on `/today` (mobile project);
     "Đăng xuất" from the account menu → `/sign-in`; `/today` then redirects to sign-in again;
  4. a signed-in user visiting `/` goes to their home path; `smoke.spec.ts` keeps `/` signed out.
- [ ] **Step 3: RED → implement → GREEN**; catalog entries for the new components.
- [ ] **Step 4: Verify** `pnpm verify:full`. **Commit** — `feat(auth): pending screen, landing
  page and sign-out from the app shell`.

### Task 2.8: Admin approval queue

**Files:**

- Create: `supabase/migrations/20260925000400_admin_list_users.sql`,
  `supabase/tests/database/050-admin-list-users.test.sql`,
  `features/admin/{queries.ts,actions.ts,index.ts}`,
  `features/admin/components/{user-queue.tsx,user-row-actions.tsx}` (+ tests),
  `app/(admin)/{layout.tsx,loading.tsx,error.tsx}` (§7.5), `app/(admin)/admin/page.tsx` (redirect),
  `app/(admin)/admin/users/page.tsx`, `e2e/admin.spec.ts`, `docs/adr/0004-sign-up-with-approval.md`
- Modify: `app/dev/components/page.tsx`, `app/dev/app-shell/page.tsx` (`await
  requireDevAccess()`), `app/dev/components/registry.tsx`, `docs/design/COMPONENTS.md`,
  `lib/i18n/vi.ts`, `lib/supabase/database.types.ts`, `docs/adr/README.md`

**Interfaces:**

- SQL: `public.admin_list_users() returns table (id uuid, email text, display_name text,
  avatar_url text, role text, status text, created_at timestamptz, approved_at timestamptz,
  onboarded_at timestamptz)` — `security definer`, `set search_path = ''`, `execute` for
  `authenticated` (`revoke … from public, anon`; added to the schema-invariants allowlist); not
  `is_admin()` → `forbidden`; joins `auth.users` for the e-mail; ordered
  pending first (oldest first), then everyone else newest first. No notes, no events (§4.5).
- TypeScript:

  ```ts
  // features/admin/queries.ts — import 'server-only'
  export type AdminUserRow = { id: string; email: string | null; displayName: string | null;
    role: Role; status: AccountStatus; createdAt: string; approvedAt: string | null;
    onboardedAt: string | null; isSelf: boolean }
  export async function listUsers(): Promise<AdminUserRow[]>          // requireAdmin() first

  // features/admin/actions.ts — 'use server'
  export type AdminActionResult = { ok: true; message: string } | { ok: false; message: string }
  export async function setUserStatus(userId: string, status: 'active' | 'rejected' | 'suspended'): Promise<AdminActionResult>
  export async function setUserRole(userId: string, role: Role): Promise<AdminActionResult>
  // requireAdmin(); Zod (uuid, enum); rpc with the admin's own session client (the function
  // checks is_admin); revalidatePath('/admin/users'); errors → Vietnamese messages
  ```

- UI (`/admin/users`, AppShell): PageHeader "Người dùng"; Sections "Chờ duyệt (n)", "Đang
  hoạt động", "Tạm khoá", "Bị từ chối" (EmptyState "Không có tài khoản nào chờ duyệt." for an
  empty queue); each row: name, e-mail, joined date (`formatDay`), a Badge for admins, and
  actions — pending: "Duyệt" and "Từ chối"; active: "Tạm khoá", "Đặt làm quản trị" / "Bỏ quyền
  quản trị"; suspended or rejected: "Kích hoạt lại"; the acting admin's own row shows "Bạn" and
  no actions (decision 17). "Từ chối", "Tạm khoá" and role changes confirm through
  `ConfirmDialog`; results are toasts (polite) and the list re-renders. `UserRowActions` takes
  the two actions as props so the catalog can render it with no-op actions.
- `/admin` redirects to `/admin/users` (decision 13). `/dev/*` pages call `await
  requireDevAccess()` (admin-only in production, §2.4).

- [ ] **Step 1: Failing pgTAP** — `050-admin-list-users.test.sql`: a learner → `forbidden`;
  `anon` has no execute privilege; an admin sees every user with the e-mail from `auth.users`;
  pending rows first.
- [ ] **Step 2: Failing unit tests** — `user-queue.test.tsx` (sections, counts, empty state,
  own row without actions); `user-row-actions.test.tsx` (the buttons per status; confirm dialogs
  for destructive actions; the action receives the right arguments).
- [ ] **Step 3: Failing e2e** — `e2e/admin.spec.ts` (an admin created per test):
  approve a pending user (unique name) → the row moves to "Đang hoạt động" and the DB status is
  `active`; reject through the confirm dialog → `rejected`; suspend an active user →
  `suspended`; reactivate; promote to admin → Badge + DB role; a learner visiting `/admin/users`
  gets the Vietnamese 404; `/admin` redirects to `/admin/users`; axe clean in light and dark,
  including with the confirm dialog open.
- [ ] **Step 4: RED → implement → GREEN** (`pnpm db:reset && pnpm test:db`, `pnpm test`,
  `pnpm test:e2e`); `pnpm db:types`.
- [ ] **Step 5: ADR-0004** (open sign-up with admin approval; statuses and transitions; no
  self-actions; in-app status only; bootstrap only for never-processed profiles — decision 23 —
  so the env list never overrides an admin decision; the break-glass SQL in `docs/ops/staging.md`
  for the case where no active admin remains).
- [ ] **Step 6: Verify** `pnpm verify:full`. **Commit** — `feat(admin): user approval queue`.

### Task 2.9: Track manifests, loader, projection table

**Files:**

- Create: `content/tracks/dsa/track.yaml`, `content/tracks/english/track.yaml`,
  `lib/content/schemas/manifest.ts`, `lib/content/tracks.ts`, `lib/content/tracks.test.ts`,
  `lib/content/__fixtures__/tracks/**` (invalid and draft manifests for tests),
  `lib/content/weekly-template.ts`, `lib/content/weekly-template.test.ts`,
  `lib/domain/plan/projections.ts`, `lib/domain/plan/projections.test.ts`,
  `lib/domain/plan/variant.ts`, `lib/domain/plan/variant.test.ts`
- Modify: `package.json` (`yaml` 2.9.1 in `dependencies`, decision 12), `next.config.ts`
  (`outputFileTracingIncludes: { '/**': ['content/tracks/*/track.yaml'] }` — check the key and
  glob format against the Next 16 docs in `node_modules/next/dist/docs` first; `next start` reads
  the repo folder, so only a Vercel deployment proves it — owner check in 2.2),
  `lib/i18n/format.ts` (+ tests), `lib/i18n/vi.ts`

**Manifests** — the §3.4 values; M3 (3.1) adds the full schema (signals, lesson formats, decks
validation) and tightens the loose parts. `content/tracks/dsa/track.yaml`:

```yaml
id: dsa
status: active
title: { vi: "Cấu trúc dữ liệu & Giải thuật", en: "Data Structures & Algorithms" }
accent: track-1
itemTypes: [lesson, problem, prompt, flashcard]
codeLanguages: [python, java, go]
srs:
  intervals: [7, 21, 60]
  relearnDays: 3
  masteredAfter: 2
  byType: { flashcard: { intervals: [1, 3, 7, 14], relearnDays: 1 } }
review: { recallMinutes: 5, redoFactor: 0.6 }
topics:   # technical terms stay English (DESIGN_SYSTEM §11); signals arrive in M3
  - { id: arrays-hashing, title: { vi: "Arrays & Hashing", en: "Arrays & Hashing" }, requires: [] }
  - { id: two-pointers, title: { vi: "Two Pointers", en: "Two Pointers" }, requires: [arrays-hashing] }
  - { id: sliding-window, title: { vi: "Sliding Window", en: "Sliding Window" }, requires: [arrays-hashing] }
  - { id: stack, title: { vi: "Stack", en: "Stack" }, requires: [arrays-hashing] }
  - { id: binary-search, title: { vi: "Binary Search", en: "Binary Search" }, requires: [arrays-hashing] }
  - { id: linked-list, title: { vi: "Linked List", en: "Linked List" }, requires: [two-pointers] }
  - { id: trees, title: { vi: "Trees", en: "Trees" }, requires: [linked-list, binary-search] }
  - { id: heap, title: { vi: "Heap / Priority Queue", en: "Heap / Priority Queue" }, requires: [trees] }
  - { id: tries, title: { vi: "Tries", en: "Tries" }, requires: [trees] }
  - { id: backtracking, title: { vi: "Backtracking", en: "Backtracking" }, requires: [trees] }
  - { id: graphs, title: { vi: "Graphs", en: "Graphs" }, requires: [trees, backtracking] }
  - { id: dp-1d, title: { vi: "1-D Dynamic Programming", en: "1-D Dynamic Programming" }, requires: [backtracking] }
  - { id: dp-2d, title: { vi: "2-D Dynamic Programming", en: "2-D Dynamic Programming" }, requires: [dp-1d] }
  - { id: intervals, title: { vi: "Intervals", en: "Intervals" }, requires: [heap] }
  - { id: greedy, title: { vi: "Greedy", en: "Greedy" }, requires: [heap] }
defaults: { budgetMinutes: 60, newPerDay: null, throttle: [] }
estimates:
  lesson: 25
  problem: { new: { E: 20, M: 35, H: 50 } }
  prompt: 10
roadmaps: [{ id: 8w, recommendedBelowMinutes: 75 }, { id: 10w }]
weeklyTemplate:
  mon-fri: [{ kind: review, maxMinutes: 15 }, { kind: new }]
  sat: [{ kind: review }]
  sun: [{ kind: practice, tag: mock-interview, minutes: 45, fromWeek: 3 }, { kind: recap, count: 3 }]
```

`content/tracks/english/track.yaml`:

```yaml
id: english
status: active
title: { vi: "Tiếng Anh cho môi trường IT", en: "English for IT workplaces" }
accent: track-2
itemTypes: [flashcard, exercise, prompt]
srs: { intervals: [1, 3, 7, 14], relearnDays: 1, masteredAfter: 2 }
defaults:
  budgetMinutes: 25
  newPerDay: 8
  throttle: [{ dueAbove: 40, newPerDay: 4 }, { dueAbove: 60, newPerDay: 0 }]
estimates: { flashcard: { new: 1.5, review: 0.5 }, exercise: 5, prompt: 10 }
decks:
  - id: explaining-code
    kind: derived
    from: { track: dsa, itemType: problem }
    unlock: attempted
    map:
      front: { template: "Explain the optimal approach for {problem.title} in English." }
      back: note.bilingual.en
      hint: note.bilingual.vi
roadmaps: [{ id: 10w }]
weeklyTemplate:
  mon-fri:
    - { kind: practice, itemType: exercise, minutes: 5 }
    - { kind: practice, tag: shadowing, minutes: 3 }
    - { kind: review }
    - { kind: new }
  sat: [{ kind: review }]
  sun: [{ kind: practice, tag: weekend-task, minutes: 15 }, { kind: review }]
```

**Interfaces:**

```ts
// lib/content/schemas/manifest.ts — Zod 4; z.looseObject at the top level (M3 validates the rest)
export const TRACK_ACCENTS = ['track-1', …, 'track-8'] as const
export const templateBlockSchema // strict: { kind: 'review'|'new'|'practice'|'recap', maxMinutes?, minutes?, tag?, itemType?, fromWeek?, count? } (positive ints)
export const weeklyTemplateSchema // z.partialRecord over 'mon-fri'|'mon'|'tue'|'wed'|'thu'|'fri'|'sat'|'sun' → block[]
  // (Zod 4's z.record with an enum key requires every key; manifests list only some days)
export const trackManifestSchema  // id (^[a-z][a-z0-9-]{0,31}$), status, title {vi,en}, accent,
  // itemTypes (non-empty), codeLanguages?, defaults { budgetMinutes 10–240 step 5, newPerDay int|null,
  // throttle {dueAbove,newPerDay}[] }, roadmaps (non-empty, unique ids, recommendedBelowMinutes?),
  // weeklyTemplate
export type TrackManifest = z.infer<typeof trackManifestSchema>
export type WeeklyTemplate = TrackManifest['weeklyTemplate']
export type RoadmapRef = TrackManifest['roadmaps'][number]

// lib/content/tracks.ts — import 'server-only'; fs + yaml; parsed once per process
export function loadTracks(root?: string): readonly TrackManifest[]  // root defaults to <cwd>/content/tracks
export function activeTracks(root?: string): readonly TrackManifest[] // status === 'active'
export function getTrack(id: string, root?: string): TrackManifest | null
// errors name the file: `content/tracks/x/track.yaml: accent: …`

// lib/content/weekly-template.ts (pure text from manifest data; imports lib/i18n)
export type TemplateDay = { label: string; blocks: string[] }
export function describeWeeklyTemplate(template: WeeklyTemplate): TemplateDay[]
export function describeThrottle(defaults: TrackManifest['defaults']): string[]

// lib/domain/plan/projections.ts (§5.11 prototype table — M4 regenerates it)
export type Projection = { medianWeeks: number; p90Weeks: number }
export const PROJECTION_TABLE: Readonly<Record<string, Readonly<Record<string,
  readonly (readonly [budget: number, median: number, p90: number])[]>>>>
  // dsa: 8w [[45,16.7,18.1],[60,11.6,12.4],[75,9.3,9.7],[90,7.3,7.7],[120,5.6,6.1]]
  //      10w [[45,22.6,24.1],[60,16.5,17.4],[75,12.7,13.6],[90,10.3,11.1],[120,7.7,8.4]]
export function projectFinish(trackId: string, variant: string, budgetMinutes: number): Projection | null
// linear interpolation between rows, clamped at the ends; null when the track/variant has no table

// lib/domain/plan/variant.ts
export function defaultVariant(roadmaps: readonly { id: string; recommendedBelowMinutes?: number }[],
  budgetMinutes: number): string
// the first roadmap whose recommendedBelowMinutes > budget, else the last roadmap (§5.11: 8w < 75 ≤ 10w)

// lib/i18n/format.ts
export function formatWeeks(weeks: number, fractionDigits?: 0 | 1): string  // '12,4 tuần'
export function formatFinishEstimate(input: { budgetMinutes: number; variantLabel: string;
  medianWeeks: number; p90Weeks: number }): string
// 'Với 60 phút/ngày, lộ trình 8 tuần thường hoàn thành sau ~12 tuần (90 %: ~12,4 tuần)'
export function variantLabel(variantId: string): string  // '8w' → '8 tuần'; other ids unchanged
```

`describeWeeklyTemplate` output (vi), always in the order `mon-fri`, `mon` … `fri`, `sat`, `sun`
whatever the YAML order: day labels `mon-fri` "Thứ 2 – Thứ 6", `mon`…`fri` "Thứ 2"…"Thứ 6", `sat`
"Thứ 7", `sun` "Chủ nhật"; blocks: review "Ôn tập" (+ " (tối đa {n} phút)"),
new "Bài mới", recap "Ôn lại {count} bài", practice "{label} · {formatMinutes(minutes)}" (+ "
(từ tuần {w})") where the label comes from `vi.template` — `exercise` "Bài tập", `shadowing`
"Shadowing", `mock-interview` "Phỏng vấn thử", `weekend-task` "Nhiệm vụ cuối tuần", otherwise the
raw tag. `describeThrottle`: `newPerDay` n → "Tối đa {n} thẻ mới mỗi ngày"; each rule → "Trên
{dueAbove} thẻ cần ôn: {n} thẻ mới mỗi ngày", or "…: tạm dừng thẻ mới" when n = 0; DSA → `[]`.

- [ ] **Step 1: Failing tests** —
  - `tracks.test.ts`: both real manifests load; `dsa` roadmaps `['8w', '10w']` with
    `recommendedBelowMinutes 75`; `english` default budget 25; fixtures: a manifest with
    `accent: purple` fails naming the file and field; an unknown weekday key fails; a template
    with only `sat` and `sun` passes (partial record); a `draft`
    track is excluded by `activeTracks` and returned by `getTrack`; `getTrack('nope')` → `null`.
  - `weekly-template.test.ts`: DSA → `[{ 'Thứ 2 – Thứ 6', ['Ôn tập (tối đa 15 phút)', 'Bài
    mới'] }, { 'Thứ 7', ['Ôn tập'] }, { 'Chủ nhật', ['Phỏng vấn thử · 45 phút (từ tuần 3)', 'Ôn
    lại 3 bài'] }]` (and the same order when the YAML lists `sun` first); English mon-fri → `['Bài tập · 5 phút', 'Shadowing · 3 phút', 'Ôn tập',
    'Bài mới']`, sun → `['Nhiệm vụ cuối tuần · 15 phút', 'Ôn tập']`; English throttle → three
    lines ending "tạm dừng thẻ mới"; DSA throttle → `[]`.
  - `projections.test.ts`: every table row exactly; 67.5 min 8w → median 10.45, p90 11.05
    (± 1e-9); 30 → the 45 row; 200 → the 120 row; `projectFinish('english', '10w', 25)` → `null`.
  - `variant.test.ts`: 60 → `8w`, 74 → `8w`, **75 → `10w`**, 120 → `10w`; a single roadmap → its
    id.
  - `format.test.ts`: `formatWeeks(12.4)` → `'12,4 tuần'`; `formatWeeks(11.6, 0)` → `'12 tuần'`;
    `formatFinishEstimate({ budgetMinutes: 60, variantLabel: '8 tuần', medianWeeks: 11.6,
    p90Weeks: 12.4 })` → `'Với 60 phút/ngày, lộ trình 8 tuần thường hoàn thành sau ~12 tuần
    (90 %: ~12,4 tuần)'` (vi-VN decimal comma, §5.11).
- [ ] **Step 2: RED → implement → GREEN.** The first page that reads the manifests is 2.10; its
  e2e run (`pnpm build && pnpm start`) proves the files ship with the server build.
- [ ] **Step 3: Verify** `pnpm verify`. **Commit** — `feat(content): track manifests, loader and
  simulated-finish table`.

### Task 2.10: Onboarding

**Files:**

- Create: `features/onboarding/{schema.ts,schema.test.ts,queries.ts,actions.ts,actions.test.ts,index.ts}`,
  `features/onboarding/components/onboarding-wizard.tsx` (+ `.test.tsx`),
  `lib/content/track-options.ts` (+ test), `features/tracks/index.ts`,
  `features/tracks/components/{weekly-template-preview.tsx,variant-picker.tsx}` (+ tests),
  `e2e/onboarding.spec.ts`, `docs/adr/0015-dsa-variant-follows-budget.md`
- Modify: `app/(onboarding)/onboarding/page.tsx` (placeholder → wizard),
  `app/dev/components/registry.tsx`, `docs/design/COMPONENTS.md`, `lib/i18n/vi.ts`,
  `CLAUDE.md` (index rule below), `docs/adr/README.md`

**Interfaces:**

- Consumes: `activeTracks`, `describeWeeklyTemplate`, `describeThrottle`, `TrackManifest` (2.9);
  `projectFinish`, `defaultVariant`, `formatFinishEstimate`, `variantLabel` (2.9); `localDay`,
  `addDays`, `canonicalTimeZone`, `timeZoneOptions`, `DAY_STARTS`, `DEFAULT_SCHEDULE` (2.3);
  `applyLearnerEvent`, `applySystemEvent`, `deriveEventId` (2.5b); `requireActive`,
  `createClient`, `createAdminClient` (2.6); ChoiceCard, Checkbox, RadioGroup, NativeSelect,
  FormField, FormErrorSummary, StepIndicator, FocusLayout (2.6a).
- Produces:

  ```ts
  // features/onboarding/schema.ts
  export const onboardingInputSchema = z.object({
    requestId: z.uuid(),
    tracks: z.array(z.object({ trackId, budgetMinutes /* 10–240 step 5 */, roadmapVariant }))
      .min(1).refine(unique trackIds),
    startDate: LocalDay, timezone: z.string().min(1), dayStartsAt: DayStart,
    codeLanguage: z.enum(['python', 'java', 'go']).optional(),
  }).strict()
  export type OnboardingInput = z.infer<typeof onboardingInputSchema>
  export type OnboardingState =
    | { status: 'idle' }
    | { status: 'error'; formError: string | null; fieldErrors: Record<string, string> }

  // lib/content/track-options.ts — shared by onboarding (2.10) and settings (2.11)
  export type TrackOption = { id: string; title: string; accent: string;
    defaultBudgetMinutes: number; roadmaps: { id: string; recommendedBelowMinutes?: number }[];
    codeLanguages: CodeLanguage[]; template: TemplateDay[]; throttle: string[] }
  /** Active tracks as plain, serialisable options (vi titles, template text). No guard: callers
   *  are guarded loaders. The type is importable by client components (`import type`). */
  export function loadTrackOptions(): TrackOption[]

  // features/onboarding/queries.ts — import 'server-only'
  export async function getOnboardingData(): Promise<{ tracks: TrackOption[];
    timeZones: readonly string[]; now: string; requestId: string }>
  // requireActive() first; timeZones = timeZoneOptions() computed on the server (the browser's ICU
  // list may differ, so the client never builds it during render); requestId = crypto.randomUUID()
  // per render (decision 9)

  // features/onboarding/actions.ts — 'use server'
  export async function completeOnboarding(prev: OnboardingState, formData: FormData): Promise<OnboardingState>

  // features/tracks/components/weekly-template-preview.tsx (server-compatible, no 'use client')
  export function WeeklyTemplatePreview(props: { title: string; accent: string;
    days: TemplateDay[]; throttle: string[] }): React.JSX.Element

  // features/tracks/components/variant-picker.tsx ('use client'; shared with settings)
  /** RadioGroup of the track's roadmaps (variantLabel) with the simulated finish per choice. */
  export function VariantPicker(props: { trackId: string; name: string;
    roadmaps: TrackOption['roadmaps']; budgetMinutes: number; value: string;
    onValueChange: (id: string) => void }): React.JSX.Element
  ```

  `features/tracks/index.ts` exports **only client-safe items** — `WeeklyTemplatePreview`,
  `VariantPicker` and their prop types — because client components in `features/onboarding` and
  `features/settings` import it; re-exporting a `server-only` module there breaks the client build.
  `CLAUDE.md` (React / Next.js) gains: "A feature `index.ts` imported by client components must not
  re-export `server-only` modules; server loaders live in `lib/` or the feature's `queries.ts`."

- **Wizard** (`OnboardingWizard`, client leaf; props `{ tracks: TrackOption[]; timeZones:
  readonly string[]; now: string; requestId: string; action }` — all from `getOnboardingData()`;
  the action is passed from the page so the catalog can render it with a no-op) inside
  `FocusLayout width="wide"`; state kept in the component; a hidden `payload` input carries the
  JSON of `OnboardingInput` with the `requestId` prop (decision 9).
  Steps (StepIndicator; "Quay lại" / "Tiếp tục"; per-step validation before moving on; focus
  moves to the step heading on every step change):
  1. **Chọn lộ trình** — a ChoiceCard + Checkbox per active track (title, accent chip); at least
     one ("Chọn ít nhất một lộ trình.").
  2. **Thời gian mỗi ngày** — a number input per selected track (FormField, `min 10 max 240
     step 5`, default `defaults.budgetMinutes`), helper "phút mỗi ngày".
  3. **Phiên bản lộ trình** — only for tracks with more than one roadmap (skipped when none):
     a `VariantPicker` per such track; the default is `defaultVariant(roadmaps, budget)`
     and **follows the budget until the learner picks one** (then it sticks); each choice shows
     `formatFinishEstimate` from `projectFinish` when a projection exists (§5.11, ADR-0015).
  4. **Lịch học** — start date (`type="date"`, default `localDay(now, schedule)`, min today, max
     today + 60 days), time zone (NativeSelect over the `timeZones` prop; the first render uses
     `Asia/Ho_Chi_Minh`, then an effect after mount switches to `canonicalTimeZone(browser zone)`
     when that is in the list — no hydration mismatch), day start (NativeSelect over
     `DAY_STARTS`, default `04:00`) with the helper "Học lúc 01:30 vẫn tính cho ngày hôm trước
     khi ngày mới bắt đầu lúc 04:00." (RF-1 made visible).
  5. **Ngôn ngữ lập trình** — only when a selected track has `codeLanguages`: RadioGroup Python /
     Java / Go, default Python.
  6. **Xem trước tuần học** — `WeeklyTemplatePreview` per selected track (and its throttle lines)
     + "Bắt đầu học" (submit; pending state keeps focus and blocks a second submit).
  Server errors render in `FormErrorSummary` at the top (DESIGN_SYSTEM §5) and jump to the step
  holding the first field in error.
- **Action** `completeOnboarding`: `requireActive()`; already onboarded → `redirect('/today')`;
  parse `payload` (bad JSON or schema → `status 'error'` with field errors); check every
  `trackId` is an active track, each `roadmapVariant` one of its roadmaps, `codeLanguage` allowed
  by a selected track and required when one has `codeLanguages`; `timezone =
  canonicalTimeZone(input.timezone)` and `isValidTimeZone`; `today = localDay(now, schedule)`;
  a past `startDate` becomes `today`, one more than 60 days ahead is an error (decision 22). Then,
  in this order, with `deriveEventId(requestId, key)`: `schedule.changed` (`effectiveAt` = `now`,
  decision 5) → `settings.changed {codeLanguage}` when present → `track.enrolled` per track
  (`trackId`, payload `{ roadmapVariant, budgetMinutes, startDate }`) → `applySystemEvent(admin,
  user.id, onboarding.completed)` → `redirect('/today')`. An `EventError` returns its
  `userMessage` as `formError`; a retry after a partial failure re-sends the same ids, so
  finished steps come back `duplicate` (RF-2 groundwork).

- [ ] **Step 1: Failing unit tests** — `schema.test.ts` (valid input; `dayStartsAt '04:15'`,
  `'13:00'`; minutes 7, 245, 62; empty tracks; duplicate track ids; an unknown key; a bad
  `requestId` → errors); `actions.test.ts` (mocks for the DAL, clients and apply helpers: the
  event order and ids; a past start date sent as today; a start date 61 days ahead → field
  error; an unknown variant → field error; `Asia/Saigon` stored as `Asia/Ho_Chi_Minh`; an
  onboarded user is redirected without events; an `EventError('quota_exceeded')` → the §4.5
  message); `onboarding-wizard.test.tsx` (cannot continue with no track; minutes validation
  message; **60 → `8 tuần` default, 75 → `10 tuần`**, and a manual pick sticks when the minutes
  change; the finish text uses the decimal comma; the language step is skipped for English only;
  a server error state shows the summary and returns to its step; focus lands on the step
  heading); `weekly-template-preview.test.tsx`; `variant-picker.test.tsx` (labels, finish text
  per choice, no finish line for a track without a projection); `lib/content/track-options.test.ts`
  (both active tracks as options with vi titles, DSA code languages, English throttle lines);
  onboarding e2e step 1 is the proof that the manifests reach the server build locally.
- [ ] **Step 2: Failing e2e** — `e2e/onboarding.spec.ts` with `test.use({ timezoneId:
  'Asia/Saigon' })` (decision 6): an active, not-onboarded user signs in → `/onboarding`; picks
  DSA + English; DSA 60 min → step 3 preselects "8 tuần" and shows "~12 tuần" and "12,4"; back to
  step 2, DSA 75 → step 3 now preselects "10 tuần"; step 4 preselects `Asia/Ho_Chi_Minh` and
  `04:00`; Python; the preview lists "Thứ 2 – Thứ 6"; "Bắt đầu học" → `/today`; in the DB:
  `user_tracks` dsa `10w`/75 and english `10w`/25, one schedule version `Asia/Ho_Chi_Minh 04:00`,
  `code_language python`, `onboarded_at` set, **exactly five events**; axe clean on steps 1 and 6
  in light and dark.
- [ ] **Step 3: RED → implement → GREEN** (`pnpm test`, `pnpm test:e2e`); catalog entries for
  `OnboardingWizard` (step 1 and an error state), `WeeklyTemplatePreview` and `VariantPicker`.
- [ ] **Step 4: ADR-0015** (DSA variant follows the budget; simulated finish from the §5.11 table,
  regenerated in M4).
- [ ] **Step 5: Verify** `pnpm verify:full`. **Commit** — `feat(onboarding): tracks, minutes,
  variant, schedule and language in one wizard`.

### Task 2.11: Settings

**Files:**

- Create: `features/settings/{queries.ts,actions.ts,actions.test.ts,index.ts}`,
  `features/settings/components/{schedule-form.tsx,code-language-form.tsx,track-settings.tsx,add-track-form.tsx,admin-link.tsx}`
  (+ tests), `app/(app)/settings/page.tsx`, `e2e/settings.spec.ts`
- Modify: `app/dev/components/registry.tsx`, `docs/design/COMPONENTS.md`, `lib/i18n/vi.ts`

**Interfaces:**

- Consumes: as 2.10 (`loadTrackOptions`, `TrackOption` from `lib/content/track-options.ts`;
  `VariantPicker`, `WeeklyTemplatePreview` via `features/tracks` `index.ts`), plus `scheduleAt`,
  `nextDayStart`, `daysBetween` (2.3) and `ThemeToggle` (M1).
- Produces:

  ```ts
  // features/settings/queries.ts — import 'server-only'
  export type SettingsData = {
    user: SessionUser
    schedule: Schedule                       // in force now
    pendingSchedule: (Schedule & { effectiveAt: string }) | null  // the next version, if any
    tracks: { option: TrackOption; enrollment: { status: 'active' | 'paused' | 'removed';
      budgetMinutes: number; roadmapVariant: string; startDate: string } | null }[]
    now: string
    requestId: string                        // crypto.randomUUID() per render (decision 9)
  }
  export async function getSettingsData(): Promise<SettingsData>        // requireOnboarded() first

  // features/settings/actions.ts — 'use server'; each returns { ok: boolean; message: string;
  // fieldErrors?: Record<string, string> } and revalidates /settings
  export async function updateSchedule(prev, formData)     // requestId, timezone, dayStartsAt
  export async function updateCodeLanguage(prev, formData) // requestId, codeLanguage
  export async function updateTrack(prev, formData)        // requestId, trackId, budgetMinutes, roadmapVariant
  export async function enrollTrack(prev, formData)        // requestId, trackId, budgetMinutes, roadmapVariant, startDate
  export async function setTrackStatus(prev, formData)     // requestId, trackId, to: 'paused'|'active'|'removed'
  ```

- **Behaviour:**
  - Schedule: `effectiveAt = nextDayStart(now, scheduleAt(versions, now))` (§5.9); the form shows
    the pending version when one exists, and after saving "Thay đổi áp dụng từ {ngày} lúc {giờ}
    (giờ {múi giờ cũ}) — ngày đang học không bị ảnh hưởng." The form's values are compared with
    `pendingSchedule ?? schedule`: unchanged → no event; switching back to the schedule in force
    while a change is pending sends `schedule.changed` with the in-force values at the pending
    version's `effectiveAt`, which replaces the pending row (the upsert in 2.5b).
  - Tracks: each enrolled track shows its status (Badge), minutes, variant with the simulated
    finish (`VariantPicker`), the weekly template and throttle **read-only** (release table:
    editing UI later), and actions — active: "Tạm dừng", "Gỡ lộ trình" (ConfirmDialog); paused:
    "Tiếp tục", "Gỡ lộ trình"; removed tracks and never-enrolled active tracks appear under "Thêm
    lộ trình" (minutes, variant, start date = today; re-adding keeps history, §5.9). Resume sends
    `pausedDays = daysBetween(<local_day of the latest track.paused event for that track>,
    today)` (read from the user's own events).
  - Code language: RadioGroup + "Lưu".
  - Theme: the M1 `ThemeToggle` (client-side, decision 7).
  - Admins: an "Quản trị" row at the top linking to `/admin` (DESIGN_SYSTEM §5: admin pages
    reachable on mobile).
  - Every form: the page's `requestId` prop (decision 9 — never generated in the client),
    FormField errors, a polite toast on success, the `EventError` message on failure; every
    successful action calls `revalidatePath('/settings')`, which renders a fresh `requestId`.
  - Code language: a `null` profile value reads as Python (the default).

- [ ] **Step 1: Failing unit tests** — `actions.test.ts` (mocks: `updateSchedule` computes
  `effectiveAt` = the next 04:00 in the current zone for a fixed `now`; unchanged values emit
  nothing; **reverting to the in-force schedule while a change is pending** sends the in-force
  values at the pending `effectiveAt`; `setTrackStatus` resume computes `pausedDays`; an invalid transition surfaces the
  Vietnamese message; `enrollTrack` for a removed track re-enrolls); component tests for each
  form (labels, errors, the pending-schedule notice, the admin row only for admins).
- [ ] **Step 2: Failing e2e** — `e2e/settings.spec.ts`. Add to `e2e/support/users.ts`
  `seedLearnerSetup(userId, { schedule?: { timezone; dayStartsAt; effectiveAt }; tracks?: {
  trackId; roadmapVariant; budgetMinutes; startDate }[] })` (secret-key inserts into
  `schedule_versions` / `user_tracks`). A user created `onboarded` with a VN 04:00 schedule, DSA
  8w/60 and English 10w/25:
  **[RF-1]** change the time zone to `America/Los_Angeles` → the notice appears and the DB holds a
  version whose `effective_at` equals `nextDayStart(now, VN 04:00)` (± 1 minute of the test's
  clock); DSA minutes 60 → 90 saved, **then 90 → 45 saved too** (two saves in a row both apply —
  decision 9); pause English → "Tiếp tục" appears; resume; pause again (a second pause is a new
  event); code language → Java; an admin sees the "Quản trị" row, a learner does not; axe clean in
  light and dark.
- [ ] **Step 3: RED → implement → GREEN**; catalog entries for every settings component.
- [ ] **Step 4: Verify** `pnpm verify:full`. **Commit** — `feat(settings): schedule, tracks, code
  language and theme`.

### Task 2.11b: Account deletion and privacy text

**Files:**

- Create: `features/settings/components/delete-account.tsx` (+ test),
  `supabase/tests/database/060-account-deletion.test.sql`, `e2e/account-deletion.spec.ts`
- Modify: `features/settings/{actions.ts,index.ts}`, `app/(app)/settings/page.tsx`,
  `features/auth/components/landing.tsx` (deleted notice), `app/(public)/page.tsx`,
  `app/dev/components/registry.tsx`, `docs/design/COMPONENTS.md`, `lib/i18n/vi.ts`

**Behaviour:**

- Settings section "Xoá tài khoản": what is deleted, and the privacy sentence **"Dữ liệu đã xoá
  vẫn có thể tồn tại trong bản sao lưu đã mã hoá tối đa 90 ngày."** (§4.6); a destructive button
  opening `ConfirmDialog` ("Xoá vĩnh viễn").
- `deleteAccount()` (`'use server'`): `requireUser()` (pending users can delete too, via a later
  entry point); `createAdminClient().auth.admin.deleteUser(user.id)` — the cascade removes every
  row (§4.6); then `auth.signOut({ scope: 'local' })` on the session client (clears cookies; the
  user no longer exists) and `redirect('/?account=deleted')`; the landing page shows a Banner
  "Tài khoản của bạn đã được xoá." for that parameter.

- [ ] **Step 1: Failing pgTAP** — `060-account-deletion.test.sql`: deleting an `auth.users` row
  removes the profile, schedule versions, user tracks, events and quota rows; another user's
  `admin.*` audit event whose `actor_id` is the deleted admin survives.
- [ ] **Step 2: Failing tests** — `delete-account.test.tsx` (privacy sentence; confirm dialog;
  the action runs only after confirming); `actions.test.ts` addition (calls `deleteUser` with the
  DAL user's id, signs out locally, redirects).
- [ ] **Step 3: Failing e2e** — delete from `/settings` → `/` with the notice; the admin API no
  longer finds the user; signing in again fails with the sign-in error; axe clean with the dialog
  open.
- [ ] **Step 4: RED → implement → GREEN**. **Verify** `pnpm verify:full`. **Commit** —
  `feat(settings): account deletion with the backup-retention notice`.

### Task 2.2: Staging runbook **[owner steps at the PR stop]**

**Files:** Create `docs/ops/staging.md`; Modify `README.md` (link), `.prettierignore` only if
needed.

The runbook (no secrets, no project refs) — numbered, checkable steps:

1. **Environments** table: local (Docker, `pnpm db:start`, test login on) · staging = Vercel
   **Preview** deployments + Supabase project `hoc-deu-staging` · production = task 5.8.
2. **Supabase staging project:** create `hoc-deu-staging` (region `ap-southeast-1`, Singapore);
   note the URL, the **publishable** and **secret** keys (never the legacy anon/service_role);
   Auth → Providers: **email disabled** (second lock on the test login, §2.3); `pnpm exec
   supabase link --project-ref <ref>` then `pnpm exec supabase db push`;
   `pnpm exec supabase migration list` shows local = remote. **Never** `db push --include-seed`:
   `seed.sql` is for the local stack only.
3. **Auth URLs:** Site URL = the stable preview alias (e.g. the `main` branch URL); redirect
   allow-list: `https://hoc-deu-*-<vercel-scope>.vercel.app/**` and
   `http://localhost:3000/**`.
4. **Google OAuth client** (Google Cloud console, OAuth consent screen "External", testing
   users = the owner): authorised redirect URI `https://<ref>.supabase.co/auth/v1/callback`;
   paste the client id/secret into Supabase → Providers → Google. **GitHub OAuth app:** callback
   URL the same Supabase URL; paste into Providers → GitHub.
5. **Vercel project** `hoc-deu` from the GitHub repo (claims `hoc-deu.vercel.app`, §9.3), Node
   22; "Automatically expose System Environment Variables" on (for `VERCEL_BRANCH_URL`,
   decision 20); Deployment Protection as default. **Preview** environment variables:
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`
   (sensitive), `ADMIN_EMAILS` (the owner's e-mail). **Never** `AUTH_TEST_LOGIN`.
   `NEXT_PUBLIC_SITE_URL` is a Production variable (5.8).
6. **Checks** — run them on the preview's **branch URL** (`hoc-deu-git-<branch>-…`): the login
   cookie that holds the PKCE verifier belongs to one host, and `redirectTo` uses
   `VERCEL_BRANCH_URL` (decision 20). The branch URL returns 200; "Tiếp tục với Google" and "Tiếp
   tục với GitHub" both sign in; the owner's account becomes an active admin (bootstrap) and lands
   on onboarding, whose first step **lists both tracks** (proves `outputFileTracingIncludes`
   ships the manifests, 2.9); `/admin/users` lists the account; a second Google account lands on
   `/pending` until approved.
7. **Migrations (owner review SF6):** after merging any PR that adds a migration, run
   `pnpm exec supabase db push` against staging (linked project) and check `migration list` —
   until task 5.8 automates it.
8. **Break glass — no active admin left** (decision 23, ADR-0004): in the Supabase SQL editor
   (runs as `postgres`), with the owner's e-mail:

   ```sql
   -- Restore one admin when no active admin remains. Leaves an audit event.
   with target as (select id from auth.users where email = '<owner e-mail>')
   update public.profiles p
      set role = 'admin', status = 'active', approved_at = coalesce(p.approved_at, now())
     from target where p.id = target.id;
   insert into public.events (id, user_id, actor_id, source, type, payload)
   select gen_random_uuid(), id, id, 'system', 'admin.bootstrapped',
          jsonb_build_object('targetUserId', id, 'to', 'active')
     from auth.users where email = '<owner e-mail>';
   ```

   Check first that no active admin exists (`select count(*) from public.profiles where role =
   'admin' and status = 'active'`), and afterwards that the account can open `/admin/users`.
9. **Rotation / leaks:** rotate a key in Supabase, update Vercel, redeploy; the repo never holds
   a key.

- [ ] **Step 1:** Write the runbook (`docs/` is outside Prettier: wrap lines at 100 characters by
  hand, like the other docs); `pnpm verify`. **Commit** —
  `docs(ops): staging runbook for Supabase, Vercel and OAuth`.
- [ ] **Step 2 [owner]:** the steps above, at the PR stop; results recorded in the PR.

### M2 finish

1. `pnpm verify:full` green; `git status` clean.
2. Fresh end-of-milestone review (most capable model) over `main..feat/m2-auth` with the ledger's
   deferred minors; one fix pass (each fix RED → GREEN); residuals ledgered.
3. Push, open the PR "M2: auth, onboarding, settings" with the owner checklist (2.2 steps; the
   real Google and GitHub sign-in on the preview, 2.7a) and the rulings list; CI green (`verify`,
   `db`, `e2e`, CodeQL). Once the `db` job has reported on the PR, add `db` to the `main`
   ruleset's required status checks (owner review SF5; `verify` and `e2e` stay) and confirm it in
   the PR. **Stop for the owner's review** — do not merge, do not start M3.
