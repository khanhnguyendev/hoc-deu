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
  owner together with the M1 pull request. M2 done (PR #4, merged 2026-09-25): step-level detail
  in [Part B-M2](#part-b-m2--auth-onboarding-settings-step-by-step), written at the start of M2
  and reviewed by the owner before execution. M3 done (PRs #5–#8, merged 2026-09-25): step-level
  detail in
  [Part B-M3](#part-b-m3--track-manifests-content-loading-and-validation-step-by-step), written at
  the start of M3 and gate-reviewed; its owner decisions OD1–OD5 (2026-09-25) are binding. M4:
  step-level detail in [Part B-M4](#part-b-m4--plan-engine--spaced-repetition-step-by-step),
  written at the start of M4 and gate-reviewed; the owner approved Q1 (`fast-check`) and asked
  for its SQL parts (4.9a–c, decision 33) to wait for a separate approval (2026-09-25).
- **ADR ownership:** every ADR in platform design §9.2 is written by the task that implements it
  (marked **Writes ADR-NNNN** below); `docs/adr/README.md` lists the same mapping.

## Execution methods (approved by the owner, 2026-09-24; M3 and M4 rows changed 2026-09-25)

| Milestone | Method |
| --- | --- |
| M0 | **Native** (superpowers:executing-plans), then one fresh reviewer on the whole branch |
| M1, M5 | Native, with an end-of-milestone review |
| M2, M6 | **Subagent-driven** (superpowers:subagent-driven-development) — fresh implementer and reviewer per task |
| M4 | **Subagent-driven, parallel waves in git worktrees** (owner request 2026-09-25, Part B-M4 decision 1) |
| M3 | **Subagent-driven, parallel waves in git worktrees** — one worktree per task, one integration worktree per target branch (owner decision 2026-09-25, Part B-M3 OD5) |
| M7 | Decided at the start of M7 |

Content tasks 3.6–3.11 have no plan-engine dependency and may run in parallel with M4–M5. M3 ships
as three pull requests (Part B-M3, OD4): M4 may start once PR A (the content pipeline) is merged;
the content PRs B (DSA) and C (English) are reviewed in parallel with M4.

## Global Constraints

Every task implicitly includes these (values copied from the spec).

- **Versions:** Node ≥ 22.12 (`.nvmrc` `22`); pnpm `11.1.1` (`packageManager`); Next `16.3.6`;
  React `19.3.0`; **TypeScript `6.0.x` — not 7** (typescript-eslint supports < 6.1); **ESLint
  `9.39.x` — not 10**; Tailwind `4.3.x`. Install with exact versions (`--save-exact`).
- **Dependencies:** only those in platform design §7.10, plus `sonner` (shadcn's toast, approved
  2026-09-24) and `@mdx-js/mdx` (dev: the MDX safety check's syntax tree, approved 2026-09-25 —
  Part B-M3 OD1). Anything else → ask the owner first.
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
  (`feat/m<n>-<slug>`; M3 has three, Part B-M3), open a PR, CI must be green. The owner merged
  M0–M1; from M2 on the controller merges a milestone PR once CI and its final review are green —
  except M3's content PRs B and C, which stop for the owner's review and the owner merges (OD4).
- **Done means verified:** a task is complete only when its verification command has been run and
  its output checked (superpowers:verification-before-completion).
- **Gates grow with the milestones:**
  - `pnpm verify` = typecheck → lint → unit tests → build; **from task 3.2b on it starts with
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
| 2.2 Staging infra **[owner]** | Supabase **staging** project; Vercel project `hoc-deu` (claims `hoc-deu.vercel.app`) with preview deployments wired to staging env vars; Google and GitHub OAuth apps with staging-preview and local redirect URLs; runbook `docs/ops/staging.md` (no secrets) | Vercel's Production Branch is a placeholder (`production`) until 5.8, so `main` builds as a Preview with the staging variables; the `main` branch preview alias loads; Supabase migrations apply to staging (Postgres ≥ 16) | `main` preview alias returns 200 |
| 2.3 Local day (moved from M4) | `lib/domain/time/localDay.ts`, `lib/domain/time/fixtures.ts` (shared with the SQL parity test) **Writes ADR-0017, ADR-0020.** | **[RF-1]** 01:30 with day start 04:00 → previous date; schedule-version lookup by `effective_at`; change applies from the next day start; east/west moves; `lib/domain` purity architecture test (§7.2, deferred minor #5): imports only `lib/domain` + `zod`, no `node:*`, no date library, no `Date()` / argument-less `new Date()`, no local-time getters, `performance.now()` or `Math.random()`, no `.tsx`; Vitest runs with a fixed non-UTC `TZ` (e.g. `America/St_Johns`) | `pnpm verify` |
| 2.4 Migration: profiles, schedule_versions, user_tracks | `supabase/migrations/*`, `supabase/tests/database/*.sql` M1 deferred #21: doc drift — plan Part A 1.1 ("merge `shadcn eject` CSS", superseded by Part B-M1 decision 3) and spec §7.2's className exceptions (`app/global-error.tsx`, `app/dev/**`). | pgTAP: profile created `pending` on sign-up; column grants; `is_admin`/`is_active`; `admin_*` functions check admin and write audit events; `admin_bootstrap`; layer rule gaps (deferred minor #6): `app/api/**` follows its §7.2 row (no components), `.js`/`.jsx`/`.mjs` files are checked, the `'use client'` rule also covers `app/dev/**` — each with a rule test | `pnpm test:db && pnpm verify` |
| 2.5 Events core | migration: `events`, `event_quota` + `SECURITY DEFINER` quota trigger, `local_day` SQL function, `apply_event` / `apply_system_event` (state-table events only; derived tables in M4); `lib/domain/events.ts` — Zod payload schemas for every event type (§4.4 table) **Writes ADR-0007, ADR-0030.** | pgTAP: **[RF-1]** SQL `local_day` equals TypeScript `localDay` on the shared fixtures; forced `actor_id`/`source`; `local_day` computed in DB; 501st learner event → `quota_exceeded`; learners cannot read/write `event_quota` | `pnpm test:db` |
| 2.6 Supabase clients, proxy, DAL, guards | `lib/supabase/{client,server,proxy,admin}.ts`, `proxy.ts` (matcher: pages only), `lib/auth/dal.ts`, `lib/auth/guards.ts` **Writes ADR-0002, ADR-0006, ADR-0019.** | DAL returns cached profile; `requireActive` redirects pending; architecture test: every `'use server'` module and route handler calls a guard | `pnpm verify` |
| 2.7 Sign-in, callback, pending | `app/(public)/sign-in`, `app/(public)/auth/callback/route.ts` (admin bootstrap), `app/(account)/pending`, `supabase/seed.sql` (synthetic test users only) **Writes ADR-0003.** M1 deferred #5: AppShell sign-out — `onSignOut` is a server action invoked as `() => void onSignOut()` (Radix passes a non-serializable Event); the top-bar title comes from the pathname, not a prop. | e2e with test login: pending user sees `/pending`; admin email becomes active admin (superseded by decision 23 / R13: only while no active admin exists); **real Google and GitHub sign-in checked on a staging preview [owner]** | `pnpm verify:full` |
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

**Part B-M3 changes to this table** (decisions there): 3.2 splits into **3.2a** / **3.2b** /
**3.2c**, 3.3 into **3.3a** / **3.3b**, 3.4 into **3.4a** / **3.4b**, 3.5 into **3.5a** /
**3.5b**, and each of 3.7–3.9 into **(a)** tests + solutions and **(b)** notes + lessons (3); a
missing roadmap, lesson, note or deck is coverage, not an error, so the pipeline PR merges before
any content (4); the track loader reads the manifests from the generated catalog and `yaml` moves
back to `devDependencies` (6); `content-build` and `content-verify` become required checks at the
PR A stop, not in 7.3 (22); item pages get `state: null` until M4/M5, and track-page progress and
weak items move to 5.4 (25); MDX images live in one Supabase Storage bucket, `content-images`,
never in git (OD3, ADR-0011).

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

**Part B-M4 changes to this table** (decisions there): 4.4 splits into **4.4a** (roadmap position,
new-item queue, recap source) and **4.4b** (due queue, weak topics, practice pickers); 4.9 into
**4.9a** (tables, RLS, `mark_plan_seen`, `RULES_VERSION` 2), **4.9b** (`apply_event` with derived
changes) and **4.9c** (`apply_system_event` for plans and the auto check-in); stale-plan resume
moves from 4.3 to 4.6 and `stats/weakTopics.ts` from 4.7 to 4.4b (2); new rows **4.10** (content →
domain adapter), **4.11** (the settings `pausedDays` e2e) and **4.12** (schedule-history floor)
(27); no `due_items()` SQL function or `v_weak_topics` view — computed in TypeScript (5); the M3
follow-ups go to the separate PR **F1**, the HTTP 404 to 5.1 (28); §5.12's override simulation
scenario moves with overrides to 6.6 (31).

### M5 — Dashboard, check-in, review (v1.0) → v1.0 launch

| Task | Files | Tests that must exist | Verify |
| --- | --- | --- | --- |
| 5.1 `/today` | `features/today/*` (queries, `ensurePlan` action, `<MarkPlanSeen>`), `app/(app)/today` **Writes ADR-0039.** M1 deferred #15: StatCard applies `tracking-tight` to numbers only (§4.3). Part B-M4: the real HTTP 404 for unknown tracks and items (M3 follow-up, decision 28); no second plan on a resume day (`gateStatus().resumedToday`, decision 32); settings and track add / pause / remove / reset rebuild today's plan while it is untouched (`storePlan` mode `rebuild`, §5.4, §5.9). | **[RF-4]** new learner / future start / missing notes states; **[RF-5]** paused banner + "Học tiếp hôm nay" after 3 days, one plan only; prefetch never sets `seen_at` | `pnpm verify && pnpm test:e2e` |
| 5.2 Check-in + results | `features/checkin/*` (sheet, one-tap, auto check-in), result actions per item type (recall/redo, flashcard grades, exercise, prompt, quiz), solution-reveal nudge **Writes ADR-0036.** Part B-M4: one-tap and auto check-in minutes = `checkInMinutes(block)` (decision 34). | **[RF-2]** double tap → one event; retry after version conflict; **[RF-3]** NFD note stored NFC, 280-char limit counts graphemes | `pnpm verify && pnpm test:e2e && pnpm test:db` |
| 5.3 `/review` | `features/review/*` | Weak first; **[RF-4]** empty queue state | `pnpm verify && pnpm test:e2e` |
| 5.4 "Học thêm" + off-plan study; "Bắt đầu lại"; track-page progress and weak items | `features/today/*`; the "Bắt đầu lại" button (`track.reset`, ConfirmDialog) on the track page (Part B-M2 decision 18); track-page progress and weak items on `/t/[trackId]` (Part B-M3 decision 25) | extra block auto-checked-in; reopens a closed gate | `pnpm verify` |
| 5.5 `/progress` | `features/progress/*` M1 deferred #8 (month-view selected day gets a visual state), #9 (year-view month labels never overlap), #22 (catalog: empty CalendarHeatmap demo, `/dev/components` title from `vi.dev`). | heatmap year/month views; weekly summary bars with values | `pnpm verify && pnpm test:e2e` |
| 5.6 Admin overview + content | `features/admin/*` (`/admin`, `/admin/content`); Modify: `next.config.ts` — remove the `/admin` → `/admin/users` redirect added in 2.8 (it would shadow the new `/admin` page) **Writes ADR-0031.** | red warning for weeks reached within 14 days without notes/lessons; DB-size warnings from `ops_metrics` | `pnpm verify` |
| 5.7 Ops | migration `ops_metrics`; `.github/workflows/{backup,restore-test}.yml` (v1.0 simple daily full dump, `age`, weekly restore test), `app/api/cron/maintenance/route.ts`, `vercel.json` cron, `app/api/health/route.ts` **Writes ADR-0005, ADR-0029, ADR-0034.** | cron idempotent + `CRON_SECRET`; health ok/fail only; **backup and restore-test workflows run against staging** | `pnpm verify` + workflow runs on staging |
| 5.8 Launch **[owner]** | Supabase **prod** project, prod env vars (Vercel production), Vercel Production Branch back to `main` (a placeholder since 2.2, `docs/ops/staging.md` §5), prod OAuth redirect URLs, first production deploy; dogfooding checklist **Writes ADR-0038.** M1 deferred #17: `global-error.tsx` follows the saved theme. | full e2e against staging; smoke on prod | `pnpm verify:full` + checklist |

**Before any learner reaches week 4 (§0 constraint):** `content-verify` M3b (linked lists, trees,
graph nodes, random-pointer lists) and M3c (design classes) — tasks written just-in-time — and
either W4–W5 notes/lessons written or v1.1 shipped. The **M3b** harness task's first step (M3
follow-up, Part B-M4 decision 28): the Java harness bridges `List<String>` parameters and Go
design classes are created via `Constructor()` (problems 139, 127, 271).

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
| 7.3 | Bot PR workflows: `path-guard`, `bot-content-policy`, `bot-automerge`, stale-PR closer + fixture PR tests; adds `path-guard` and `bot-content-policy` to the existing `main` ruleset (0.10; `content-build` and `content-verify` are required from M3's PR A, Part B-M3 decision 22); pins every GitHub Action by commit SHA (deferred minor #11) **Writes ADR-0023, ADR-0035.** |
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
23. **Bootstrap touches only a never-processed profile, and only while no active admin exists**
    (owner review MF1; final review I-1, ruling R13): `admin_bootstrap` promotes only when
    `role = 'learner' AND status = 'pending' AND approved_at IS NULL` **and** no profile has
    `role = 'admin' AND status = 'active'` (checked under a transaction-scoped advisory lock, so two
    concurrent bootstraps cannot both pass); otherwise it is a no-op with no event. So a suspended
    admin stays suspended, a demoted listed admin stays a learner, and a rejected listed e-mail stays
    rejected — an admin decision is never overridden by the env list, not even after the listed
    account deletes itself and signs up again with a fresh, never-processed profile. If no active
    admin remains, the next sign-in of a listed e-mail is the automatic break-glass (so
    `ADMIN_EMAILS` holds only the owner's e-mail); the runbook's break-glass SQL remains for an
    owner account that is not listed (2.2, ADR-0004).
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
  'active' }`) → `true` (§2.5). (superseded by decision 23 / R13: only while no active admin
  exists)

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
     `admin.bootstrapped` event (superseded by decision 23 / R13: only while no active admin
     exists); again → `false`, still one event; `false` with no change and no
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
     as an active admin (superseded by decision 23 / R13: only while no active admin exists);
     a **rejected** `bootstrap-rejected@example.test` signs in → stays on
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

## Part B-M3 — Track manifests, content loading and validation, step by step

Written at the start of M3 (2026-09-25) from the code merged in M2 (PR #4, `3055225`) and a
throwaway spike of the MDX, highlighting and runner tooling — versions, commands and numbers are in
the tasks below and in the controller's spike notes (`.superpowers/sdd/m3-draft/spike-findings.md`,
not committed). Revised the same day after an independent gate review ("approve with fixes"; its
24 fixes are applied and cited below as "fix n") and the owner's answers. Executed
**subagent-driven with parallel worktrees** (OD5): a fresh implementer and a fresh reviewer per
task, the tasks of one wave in separate git worktrees, then one whole-branch review per pull
request on the most capable model.

**Owner decisions (binding, 2026-09-25):**

- **OD1 — `@mdx-js/mdx` 3.1.1 is approved** as a direct devDependency (exact). It is already
  installed by the approved `@mdx-js/loader` (lockfile +3 lines, no new download) and gives the MDX
  safety check its syntax tree (3.2a). Task 3.0 adds it to spec §7.10's approved list and to the
  Global Constraints.
- **OD2 — the content-verify sandbox** is a dedicated no-network Linux user on the GitHub runner
  (`sudo` + an iptables owner match), hardened per fix 6 (3.5b): compile and run commands both run
  as that user, `CGO_ENABLED=0`, `javac -proc:none`, stray processes killed after every case, a
  fail-closed self-test, and the CLI refuses to run unsandboxed on GitHub Actions. ADR-0012 records
  the deviation from §3.7's container.
- **OD3 — MDX images live in a Supabase Storage public bucket** `content-images` in the production
  project, referenced by every environment, so content URLs never change. The owner created the
  bucket in the dashboard on 2026-09-25 (public read, owner-only writes, 1 MB per file, MIME types
  `image/svg+xml`, `image/png`, `image/webp`, `image/jpeg`); no migration creates it; the v1.1 bot
  never uploads images. `tools/content/allowlist.ts` (3.2a) holds
  `CONTENT_IMAGE_BASE_URL = 'https://oelgwbxukbgaqqvociwi.supabase.co/storage/v1/object/public/content-images/'`
  as committed data (a public URL, no key); an empty base URL rejects every MDX image (a tested
  branch). The safety check requires `![alt](url "WIDTHxHEIGHT")` with non-empty alt text, an
  `https:` URL starting exactly with the base, path characters `[a-z0-9-_/.]`, no `..`, the
  `<track>/<item-local-id>/` prefix, extension `svg` / `png` / `webp` / `jpg`; no image files in
  `content/`; no other hosts; no network check. `next.config.ts` `images.remotePatterns` comes from
  the same constant; rendering is `next/image` with the size from the title (`svg` unoptimized).
  ADR-0011 records it.
- **OD4 — merging:** the controller merges PR A (pipeline) once CI and its final review are green
  (as M2); PR B (DSA content) and PR C (English content) stop for the owner's review, and the owner
  merges them.
- **OD5 — M3 runs subagent-driven with parallel agents** (like M2): the Execution methods table row
  for M3 becomes "Subagent-driven, parallel waves in git worktrees"; M5 stays native.

**Open questions for the owner** (non-blocking; everything else below is a ruling the owner can
overturn):

- **Q2 (confirm in PR B) — the 25 selected bonus problems** that bring DSA to ~110 problems (Q5,
  decision 29, task 3.6 table, with the selection rule and the 17 omitted NeetCode 150 problems).
- **Q3 (confirm in PR C) — English weekly topics W2–W10** (decision 30, task 3.10 table).

**Branches, pull requests and who merges** (OD4):

| PR | Branch (created from) | Tasks | Merged by |
| --- | --- | --- | --- |
| A "M3: content pipeline" | `feat/m3-content-pipeline` (`main` after M2) | 3.0, 3.1, 3.2a, 3.2b, 3.2c, 3.3a, 3.3b, 3.4a, 3.4b, 3.5a, 3.5b | controller, once CI and the final review are green |
| B "M3: DSA content" | `feat/m3-dsa-content` (pipeline branch at the end of wave 3; rebased onto `main` after A) | 3.6, 3.7a, 3.8a, 3.9a, 3.7b, 3.8b, 3.9b | **owner**, after review — including every `tests.yaml` example against LeetCode |
| C "M3: English content" | `feat/m3-english-content` (pipeline branch at the end of wave 3; rebased after A) | 3.10, 3.11 | **owner**, after review |

PR A carries no learning content: a missing roadmap, lesson, note or deck is coverage, not an
error (decision 4), so A is green and mergeable alone. B and C change only `content/**` plus one
content-pinning test each (`tools/content/dsa-content.test.ts`, `english-content.test.ts`) and, for
B, ADR-0013 — no app code, which is what success criterion 2 asks of a content PR. M4 may start as
soon as A is merged; B and C are reviewed in parallel with M4 (Execution methods note). M4 task 4.8
needs B merged (its projection hash reads the DSA roadmaps and difficulties).

**Execution schedule.** A task starts when every task it depends on has been cherry-picked onto its
target branch; the waves below are that rule applied in lockstep.

| Task | Depends on | Target branch | Runs e2e | Shared files it owns in its wave |
| --- | --- | --- | --- | --- |
| 3.0 plan, deps, housekeeping (controller) | M2 merged | pipeline | — | plan, spec §7.10, `docs/adr/README.md`, `package.json`, `pnpm-lock.yaml`, `.prettierignore`, `.env.example`, `CLAUDE.md`; Steps 6–7 (M2 rulings R17, R18): a new migration and its pgTAP tests, `lib/domain/time/localDay.ts`, the onboarding and settings actions, `docs/ops/staging.md`, spec §2.5 |
| 3.1 content schemas | 3.0 | pipeline | no | `lib/auth/dal.ts`, `content/tracks/dsa/track.yaml` |
| 3.2a MDX parser + safety check | 3.0 | pipeline | no | — |
| 3.3a highlighting + CodeBlock | 3.0 | pipeline | **yes** | `COMPONENTS.md`, catalog `registry.tsx`, `DESIGN_SYSTEM.md` |
| 3.5a content-verify, pure part | 3.0 | pipeline | no | — |
| 3.2b `content:build` core | 3.1, 3.2a, 3.3a, 3.5a | pipeline | no | `package.json`, `eslint.config.mjs`, `.prettierignore`, `ci.yml`, `content/ids.lock`, `lib/content/code-tokens.ts` |
| 3.3b MDX pipeline + components | 3.1, 3.2a, 3.3a | pipeline | **yes** | `next.config.ts`, `vi.ts`, `COMPONENTS.md`, catalog `registry.tsx`, `docs/ops/content-images.md`, `offline-build.test.ts` |
| 3.5b content-verify, runtime part | 3.1, 3.5a | pipeline | no | `CLAUDE.md`, `README.md`, `content-verify.yml` |
| 3.2c `content:build` cross-checks | 3.2b | pipeline | no | `CLAUDE.md`, `README.md` |
| 3.4a item registry + renderers | 3.2b, 3.3b | pipeline | **yes** | `next.config.ts`, `vi.ts`, `COMPONENTS.md`, catalog `registry.tsx`, `component-catalog.test.ts`, `lib/content/tracks.ts` |
| 3.4b track routes | 3.4a, 3.2c | pipeline | **yes** | `vi.ts`, `COMPONENTS.md`, catalog `registry.tsx`, `e2e/support/test.ts` |
| 3.6 DSA metadata + roadmaps | 3.2c, 3.3b | dsa-content | no | `content/tracks/dsa/track.yaml` |
| 3.10 English roadmap + core decks | 3.2c | english-content | no | `content/tracks/english/track.yaml` |
| 3.7a / 3.8a / 3.9a DSA W1 / W2 / W3 tests + solutions | 3.6, 3.5b | dsa-content | no | — (own problem folders) |
| 3.11 English W1–W3 extended | 3.10 | english-content | no | — (decks W1–W3, own new files) |
| 3.7b / 3.8b / 3.9b DSA W1 / W2 / W3 notes + lessons | its (a) task | dsa-content | no | 3.7b: `docs/adr/README.md` |

| Wave | Parallel tasks (one worktree each) | e2e lock holder | Controller at the end of the wave |
| --- | --- | --- | --- |
| 0 | 3.0 (controller, in `int-pipeline`) | — | — |
| 1 | 3.1 ‖ 3.2a ‖ 3.3a ‖ 3.5a | 3.3a | verify + e2e |
| 2 | 3.2b ‖ 3.3b ‖ 3.5b | 3.3b | verify + e2e; push the pipeline branch as a **draft PR A** (fix 6) |
| 3 | 3.2c ‖ 3.4a | 3.4a | verify + e2e; create `feat/m3-dsa-content` and `feat/m3-english-content` with `int-dsa` / `int-english` |
| 4 | 3.4b ‖ 3.6 ‖ 3.10 | 3.4b | verify + e2e on pipeline; commit `ids.lock` on both content branches |
| 5 | 3.7a ‖ 3.8a ‖ 3.9a ‖ 3.11 | controller (PR A finish) | PR A: final review, fix pass, `verify:full`, merge; `ids.lock` on english |
| 6 | 3.7b ‖ 3.8b ‖ 3.9b | — | `ids.lock` on dsa |
| 7 | — | controller | content finish: rebase B and C onto `main`, content e2e, open B and C |

- **Same-wave tasks share no file.** The last column of the task table names each shared file's
  single owner in its wave; no shared file appears twice within a wave. Dependencies — including
  moving `yaml` to devDependencies (fix 10) — are installed once in 3.0, so no worktree touches
  `package.json` dependencies or `pnpm-lock.yaml`; the `content:verify` script is added in 3.0 too,
  so only 3.2b edits `package.json` scripts. ADR index rows 0009–0012 are linked in 3.0 and 0013 in
  3.7b (fix 18). `content/ids.lock` is written only by 3.2b (the empty file) on the pipeline branch
  and **only by the controller** on the content branches (decision 8).
- **Integration worktrees** (fix 16): the controller never switches the main checkout; it keeps one
  worktree per target branch — `<scratchpad>/int-pipeline`, `int-dsa`, `int-english` — and
  cherry-picks, verifies and commits there.
- **e2e lock:** Playwright uses port 3100 and the single local Supabase stack, so at most one
  process runs `pnpm test:e2e` at a time — the wave's e2e task, or the controller's post-wave check,
  never both (the controller runs its check after the wave's e2e task has finished). Nobody runs
  `db:stop` or `db:reset` (M3's one migration, 3.0 Step 6, is applied in wave 0, before any
  task worktree exists).
- **Task worktrees** (as M2 ruling R10): `git worktree add <scratchpad>/wt-3.x -b feat/m3-task-3.x
  <target-branch head>` then `pnpm install --frozen-lockfile`; the implementer commits there; after
  a clean review the controller cherry-picks the commit(s) in its integration worktree, runs `pnpm
  verify` (plus `pnpm test:e2e` under the lock for the pipeline), and removes the task worktree and
  its branch.

**Decisions taken while writing (each is a ledger ruling; the owner can overturn any; OD1–OD5
above are binding):**

1. **Execution** — OD5.
2. **Three pull requests** — OD4 and the table above.
3. **Task splits:** Part A 3.2 → **3.2a** (MDX parser, safety check, allowlist) + **3.2b**
   (`content:build` core) + **3.2c** (cross-checks, derived decks, coverage, report); 3.3 → **3.3a**
   (build-time highlighting, CodeBlock) + **3.3b** (`@next/mdx`, content components, images); 3.4 →
   **3.4a** (registry, a page and a row per item type) + **3.4b** (`/tracks`, `/t/…` routes); 3.5 →
   **3.5a** (pure: schema, comparators, validators, literals) + **3.5b** (runtime: runners,
   orchestrator, sandbox, workflow); each of 3.7–3.9 → **(a)** tests + solutions and **(b)** notes +
   lessons (fixes 11, 13).
4. **Missing structure is coverage, not an error.** Every file that exists is validated strictly;
   a manifest roadmap without `roadmaps/<id>.yaml`, a topic without its pattern lesson, a problem
   without a note, a week without decks are reported (report, `catalog.coverage`,
   `catalog.missingRoadmaps`) and render as empty states (RF-4). A roadmap file the manifest does
   not list is an error. So PR A merges before any content (§3.6 already treats a missing lesson
   as coverage).
5. **Generated outputs** (`.generated/`, already git-ignored): `catalog.json` (the §3.6 artifact,
   for people and tools), `catalog.ts` (`export const CATALOG: Catalog = JSON.parse(<string
   literal>)` — bundled into the server build: no JSON type inference, no file tracing), `mdx.ts`
   (the static MDX import map, starting with `/// <reference types="mdx" />` — TypeScript 6 no
   longer includes `@types/*` automatically, spike), `code.ts` + `code/<trackId>/<localId>.ts`
   (highlighted code bundles, imported dynamically per item page).
6. **`lib/content/tracks.ts` reads the manifests from the catalog** (3.4a; §3.8 "the track list
   comes from the catalog"); `yaml` moves to `devDependencies` in 3.0 (the server bundle includes
   it until 3.4a — Next bundles imported packages whatever their dependency group) and 3.4a removes
   the `outputFileTracingIncludes` entry for `track.yaml` (M2 decision 12 follow-up). Owner check
   after PR A: onboarding on a preview still lists both tracks.
7. **Scripts:** `content:build` = `tsx tools/content/cli.ts`; `build` = `pnpm content:build && next
   build` (Vercel and Playwright's web server); `dev` = `pnpm content:build && next dev`; `verify` =
   `pnpm content:build && pnpm typecheck && pnpm lint && pnpm test && next build` (content:build
   runs once); `test:e2e` = `pnpm content:build && playwright test` (specs read
   `.generated/catalog.json` while they are collected); `content:verify` = `tsx
   tools/content-verify/cli.ts` (added in 3.0). **Check mode** (`--check`, or `CI` set and not `''`,
   `'0'`, `'false'` — fix 19; Vercel builds set `CI=1`) never writes `content/ids.lock` and fails
   when it is stale; locally the lock is updated.
8. **`content/ids.lock`**: a comment header, a `[published]` and a `[retired]` section, one ID per
   line, sorted, unique. New IDs are added (locally) or fail (check mode); an ID in `[published]`
   that disappeared from `content/**` fails unless moved to `[retired]` by hand; a `[retired]` ID
   found in content fails ("reused"); derived IDs are included. A derived card whose source stops
   qualifying stays in the catalog with `status: retired`, so moving a note back to draft never
   breaks the build. Only item IDs are locked (decks, roadmaps and `#note` publish targets are not
   items). **On the content branches only the controller commits it**: content tasks run
   `pnpm content:build` and restore the file before committing; after cherry-picking a wave the
   controller runs `pnpm content:build` in the integration worktree and commits `chore(content):
   record new IDs in ids.lock` — so parallel content tasks never share the file.
9. **ID and file-name rules** — the table in task 3.1 (problem folders `lc-<4+ digits>-<leetcode
   slug>`, lessons `lesson-<file>`, decks `deck-<file>`, exercises `ex-…`, prompts `prompt-…`,
   cards any other local ID, derived `<track>:<deck>:<source id>`; ASCII `[a-z0-9-]` only; `user:`
   and the track ID `user` reserved).
10. **Flashcards have one canonical shape** `front` / `back` / `hint` (the keys of the §3.4 derived
    mapping) plus the vocabulary fields of §3.5: `usage { pos, register, note? }`, `example`,
    `pronunciation`, `tags`, `tier`. Deck files declare `kind: vocabulary | recall` (vocabulary
    requires usage, example and pronunciation on every card) and `lang` (default `front: en`,
    `back: vi`). Derived cards get `tier: derived` (not allowed in deck files).
11. **Lesson frontmatter has a required `title`** (§3.3 lists id, format, topic, anchor?,
    practice, about?, status?; rows and pages need a title).
12. **`explain-aloud` costs `review.recallMinutes`** (§5.4 gives no estimate; M4 calibrates).
13. **Syntax colours reuse verified text tokens:** keyword `text-primary`, string `text-success`,
    constant/number `text-warning`, comment `text-muted-foreground italic`, everything else the
    inherited foreground. No new design tokens: each pair already passes 4.5:1 on
    `surface-muted` in both themes (DESIGN_SYSTEM Appendix A). `code-*` alias tokens can come later.
14. **Code tokens, not HTML:** shiki `codeToTokens` with the CSS-variables theme → token kinds →
    compact JSON → React spans with token utility classes. No `dangerouslySetInnerHTML`, no inline
    styles, zero client JS for highlighting.
15. **Images** — OD3 (the bucket). Links are `https:` only; internal references use `<Practice
    problem>` and frontmatter IDs.
16. **Prettier ignores `**/*.mdx`** (added in 3.0, fix 3 — its MDX parser targets MDX 1 and
    re-indents JSX children, spike); YAML content stays Prettier-formatted.
17. **MDX authoring rules** (spike; enforced by 3.2a): braces in prose or tables are expressions →
    write `` `{}` `` or `\{\}`; block components (`<Section>`, `<Choice>`, `<Solution />`, …) stand
    on their own lines — a paragraph holding only components counts as blocks (MDX's unravel, fix
    2), a paragraph mixing text and a block component is an error; `<Term>` is inline; headings are
    `###`/`####` in lessons (`<Section>` renders the `h2`) and `##`–`####` in notes; `<Question
    prompt="…" answer="…">` carries its text as an attribute, so the client quiz never inspects
    children across the server/client boundary.
18. **content-verify sandbox** — OD2. CI toolchains: `actions/setup-python@v7` 3.13,
    `actions/setup-java@v6` Temurin 25 compiling with `--release 21`, `actions/setup-go@v7` 1.26.
    Local minimums: Python 3.11, JDK 21, Go 1.22. The same orchestrator runs locally and in CI; CI
    wraps every toolchain command with the sandbox user, local runs on a developer's machine are
    unsandboxed (`sandbox: null`).
19. **Runner model** (spike): Python runs a static `runner.py` (JSON request on stdin); Java and Go
    harnesses are generated with literal arguments; each problem × language compiles once and runs
    once per case; arguments are positional in every language; the Node orchestrator enforces the
    per-case timeout (plus `timeout` inside the sandbox) and compares.
20. **The `design-class` tests format is defined and validated now** (`ops` / `args` / `expected`,
    `{ $result: n }` for codec round-trips, `{ $any: true }` to skip a value) and executed in M3c,
    so 271, 155 and 981 need no content change later.
21. **Verification status is derived:** `tested` iff the signature kind is in
    `SUPPORTED_SIGNATURE_KINDS` (`lib/content/verification.ts`; M3a = `function`), else
    `compile-only`; the required `content-verify` check backs it.
22. **CI checks:** a `content-build` job in `ci.yml` (3.2b) and the `content-verify` workflow
    (3.5b); both become required checks at the PR A stop (release table: v1.0), so Part A row 7.3
    adds only `path-guard` and `bot-content-policy`.
23. **`features/roadmap`** holds the `/tracks` and `/t/…` loaders and components, because
    `features/tracks/index.ts` must stay client-safe (M2 decision 24); its components take rows and
    pages as ReactNode props and never import the registry (fix 5).
24. **Item URLs use local IDs:** `/t/[trackId]/items/[itemId]`, `itemId` = the part after
    `<track>:`, `encodeURIComponent`-encoded (derived IDs contain colons).
25. **Item page props** gain `viewer: { codeLanguage, isAdmin }`, preloaded `data: { Body, code }`
    and `resolveItem`; `recordResult` is optional until 5.2; `state` is `null` until item state
    exists (4.9/M5). Track-page **progress and weak items** move to 5.4 (Part A row updated).
26. **Provenance fields** `origin: bot` and `createdByRun` are accepted by every item schema (data
    model only; the "tested (bot tests)" badge, ADR-0040, stays v1.1).
27. **ADR index rows 0009–0012 are linked in 3.0** with their final file names and **0013 in 3.7b**
    (fix 18); tasks only create the ADR files.
28. **Dependencies are installed once, in 3.0** (including `yaml` → devDependencies, fix 10);
    implementers never change dependencies and only run `pnpm install --frozen-lockfile`.
29. **Bonus problems** (Q2): the 25 **selected NeetCode 150 problems** in the 3.6 table (fix 14 —
    hand-picked toward ~110 problems: at most 4 per topic, Easy/Medium and free first, plus 76, 252
    and 743 from NeetCode's Advanced Graphs; the 17 omitted are listed there), each in the week of
    its topic; the 8w variant also lists, as bonus in their topic's week, the 10w problems it drops.
    DSA total: 114 problems (380 is not a NeetCode 150 problem; it comes from the brief's roadmap).
30. **English weekly topics** (Q3): the 3.10 table.
31. **M2 deferred minors absorbed** (files M3 touches anyway): 2.9 — the weekday fixture test
    asserts the field, `DAY_ORDER` reuses `WEEKDAY_KEYS`, a practice block without tag or item
    type cannot exist (schema rule); 2.10 — `CodeLanguage` moves to `lib/content` (no content →
    auth import); R13 — `.env.example`'s bootstrap note (3.0).
32. **The DSA manifest gains `estimates.flashcard: { new: 1.5, review: 0.5 }`** (§5.4 card
    estimates): its `itemTypes` lists `flashcard`, and every listed type needs an estimate.
33. **Section headings** come from `vi.content.sections[kind]`, falling back to the kind ID, so a
    new track's lesson format works without code (its Vietnamese labels are a one-line follow-up).
34. **Solutions are original, standalone and stdlib-only:** Python `class Solution` with explicit
    `typing` imports; Java `import java.util.*;` + `class Solution` — **no `public` on top-level
    classes** (fix 23: the file is `Solution.java`, design classes share it, and the generated
    `Main.java` sits beside it); Go `package main`, LeetCode's function names, no `func main`;
    design classes use LeetCode's class and method names. Never copied from LeetCode, NeetCode or
    any editorial (Q7); comments in English.

**Changes to the spec, Part A and the plan header** (applied in task 3.0): spec §7.10 lists
`@mdx-js/mdx` among the approved dev dependencies (OD1, fix 24); the Execution methods row (OD5);
the "Execution status" bullet ("M3: step-level detail in Part B-M3 …"); a "Part B-M3 changes to this
table" note under the M3 table (decisions 3, 4, 6, 22, 25, OD3); Part A row 5.4 gains "track-page
progress and weak items" (decision 25); row 7.3 adds only `path-guard` and `bot-content-policy` to
the ruleset (decision 22); Global Constraints — Dependencies adds `@mdx-js/mdx` (OD1); "from task
3.2 on" `verify` starts with `content:build` becomes "from task 3.2b on"; the Git bullet notes that
M2 and later PRs are merged by the controller once CI and the final review are green, except the
content PRs B and C (OD4).

**Subagent contract for every task** (M2's contract, plus): read `CLAUDE.md`, the platform-design
sections the task cites and this task's text; TDD (superpowers:test-driven-development) — the
listed tests fail first; `pnpm verify` green before the commit; never read `.env*` other than the
committed template `.env.example`, and never `docs/credentials/`.

- Work only in the worktree and branch named in your brief; commit there; never push; never touch
  the main checkout, an integration worktree or another task's worktree.
- Run `pnpm test:e2e` only if your task says so (e2e lock); never `db:stop` or `db:reset`.
- Change no dependency (`pnpm install --frozen-lockfile` only); if something is missing, stop and
  report `BLOCKED`.
- From 3.2b on, `.generated/` must exist before `typecheck` and `test`: `pnpm verify` creates it;
  when running a single command, run `pnpm content:build` first.
- Edit only the shared files your task owns (the schedule table); anything else shared → ask the
  controller. On a content branch never commit `content/ids.lock` (`git checkout content/ids.lock`
  before committing; decision 8).
- **Wave-1 tasks (3.1, 3.2a, 3.3a, 3.5a) do not import each other's new modules** — they are
  built side by side; where they need the same small type (`'python' | 'java' | 'go'`, an ID
  pattern) they declare it locally, and a later task switches to the shared export (noted per task).
- Call `redirect()` / `notFound()` outside `try`/`catch`. Nothing that runs during `next build`
  prerendering calls `serverEnv()`.
- **Content tasks:** never copy a LeetCode problem statement (Q7) — links, own notes, the example
  inputs/outputs in `tests.yaml` only (sourced as 3.7a–3.9a say); solutions are original (decision
  34); the report lists every file created and pastes the `content:build` (and `content:verify`)
  output.

### Task 3.0: Plan commit, dependencies and housekeeping (controller)

Steps 6–7 come from M2 rulings **R17** and **R18** (M2's final review), carried over into wave 0
when this section was committed.

- [ ] **Step 1: Integration worktree** (fix 16), once the M2 PR is merged: `git fetch origin && git
  worktree add <scratchpad>/int-pipeline -b feat/m3-content-pipeline origin/main`, `pnpm install
  --frozen-lockfile` there. All controller work for PR A happens in `int-pipeline`.
- [ ] **Step 2: Plan commit** — append this section to
  `docs/plans/2026-09-24-implementation-plan.md` and apply the spec / Part A / header changes above
  (including spec §7.10 + `@mdx-js/mdx`); in `docs/adr/README.md` link the rows
  `[0009](0009-tracks-are-data-item-types-are-code.md)`,
  `[0010](0010-namespaced-ids-and-ids-lock.md)`,
  `[0011](0011-mdx-safety-and-build-time-highlighting.md)`,
  `[0012](0012-sandboxed-solution-verification.md)` (task column: 3.4a, 3.2b, 3.3b, 3.5b; the 0013
  row stays unlinked until 3.7b). Commit `docs: Part B-M3 step-level plan`.
- [ ] **Step 3: Dependencies and scripts** (versions from the spike, exact):

  ```bash
  pnpm add --save-exact @next/mdx@16.3.6 @mdx-js/loader@3.1.1 @mdx-js/react@3.1.1 \
    remark-frontmatter@5.0.0 remark-gfm@4.0.1
  pnpm add --save-exact -D shiki@4.4.3 @types/mdx@2.0.14 @mdx-js/mdx@3.1.1   # OD1
  pnpm remove yaml && pnpm add --save-exact -D yaml@2.9.1                     # fix 10, decision 6
  pnpm verify
  ```

  plus the script `"content:verify": "tsx tools/content-verify/cli.ts"` in `package.json`, added
  by hand (`pnpm pkg` is not implemented in pnpm 11; the CLI arrives in 3.5b). Commit `build(deps): MDX, remark plugins and shiki for the content pipeline`.
- [ ] **Step 4: Housekeeping** — `.prettierignore` gains `**/*.mdx` (fix 3; 3.2b adds only
  `.generated/`); `.env.example`'s `ADMIN_EMAILS` comment says the bootstrap promotes a listed
  e-mail only while no active admin exists (M2 ruling R13); `CLAUDE.md` Safety says
  `.env.example` is the committed template and may be read and edited, every other `.env*` stays
  unread. `pnpm verify`. Commit `chore: MDX Prettier ignore and the .env.example bootstrap note`.
- [ ] **Step 5:** write the dispatch context file
  `.superpowers/sdd/2026-09-24-implementation-plan/m3-context.md` (Global Constraints + this
  section's header, owner decisions, rulings and contract) and start the progress ledger's M3 part.
- [ ] **Step 6: M2 ruling R17 — bound schedule history and avatar URLs; validate time zones**
  (TDD: the tests below fail first; merged migrations are never edited — CLAUDE.md):
  - `supabase/migrations/<next timestamp>_bound_schedule_history_and_avatar.sql`: `create or
    replace` the pending-schedule cap `schedule_versions_limit_pending()` from `…000100` so it also
    counts a user's versions with `effective_at > now() - interval '1 day'` (not only `> now()`)
    and raises `too_many_pending_schedules` above **10** — this bounds history growth through the
    `now() − 5 min` insert window to ≤ 10 rows per user per day; upserts of an existing row stay
    free; the per-user advisory lock and R14's cap of 2 pending versions stay. `alter table
    public.profiles add constraint avatar_url_length check (avatar_url is null or
    char_length(avatar_url) <= 2048)`, and `handle_new_user()` (`create or replace`) stores an
    over-long provider avatar as `null`, like an `http:` one, so a long avatar never blocks sign-up.
  - pgTAP: 11 inserts inside the window → the 11th fails; an upsert of an existing version still
    works; a 2049-character avatar fails; a sign-up with a 2049-character avatar gets a profile
    with `avatar_url` null; existing tests stay green; the schema-invariants allowlist is unchanged
    unless a new function is exposed to `authenticated`.
  - `lib/domain/time/localDay.ts`: the per-zone `Intl.DateTimeFormat` cache is bounded (the map is
    cleared when it would exceed 1000 entries); the onboarding and settings actions reject a time
    zone that is not in `timeZoneOptions()` (after `canonicalTimeZone`) with the existing
    `invalid_timezone` message — unit tests for both.
  - `features/settings/actions.ts`: `too_many_pending_schedules`, `schedule_in_force` and
    `schedule_backdated` join the `STALE` set (the page re-renders on those codes) — unit test.
  - `pnpm db:reset && pnpm test:db`, `pnpm verify`. Commit `fix(db): bound schedule history and
    avatar URLs; validate time zones against the picker list`. After PR A merges, the controller
    runs `supabase db push` to the `hoc-deu` project.
- [ ] **Step 7: M2 ruling R18 — docs only.** `docs/ops/staging.md`: the placeholder production
  branch must **exist** on GitHub (Vercel rejects a missing branch) — `production` was created on
  2026-09-25, pinned at M1 (`c2a9583`), and 5.8 switches Vercel's production branch back to
  `main`; Vercel promotes a project's **first** deployment to production whatever the production
  branch — after connecting the repo, redeploy the `production` branch to production (done
  2026-09-25; `hoc-deu.vercel.app` serves M1 until 5.8); current state: previews (`main`
  included) use the **production** Supabase project `hoc-deu` (owner decision 2026-09-25) until a
  separate staging project exists (the Free plan allows two active projects), and preview URLs sit
  behind Vercel's standard deployment protection (sign in to Vercel to open them); after setting
  the Preview variables, redeploy `main` as a Preview; the image bucket `content-images` exists
  (OD3). This plan: annotate Part A row 2.7 ("admin email becomes active admin"), the 2.5b
  `admin_bootstrap` spec and its test item 5, and 2.7a's bootstrap e2e scenario (Step 2, item 4)
  with "(superseded by decision 23 / R13: only while no active admin exists)"; the spec's §2.5
  "Admin bootstrap" the same way. Commit `docs: M2 follow-ups in the runbook, plan and spec`.

### Task 3.1: Content schemas — item types, roadmaps, the full manifest, IDs

**Files:**

- Create: `lib/content/schemas/common.ts`, `lib/content/schemas/ids.ts` (+ `ids.test.ts`),
  `lib/content/schemas/roadmap.ts` (+ `roadmap.test.ts`), `lib/content/schemas/manifest.test.ts`,
  `lib/content/item-types/{types,problem,lesson,flashcard,exercise,prompt,index}.ts` (+ a
  `*.test.ts` per type file and `index.test.ts`)
- Modify: `lib/content/schemas/manifest.ts`, `lib/content/weekly-template.ts` (+ test),
  `lib/content/track-options.ts`, `lib/content/tracks.test.ts`, `lib/content/__fixtures__/tracks/**`
  (fixtures gain the now-required fields), `lib/auth/dal.ts` (`CodeLanguage` comes from
  `lib/content/schemas/common.ts`), `content/tracks/dsa/track.yaml` (`lessonFormats` verbatim from
  §3.4; `estimates.flashcard`, decision 32)

**ID and file rules** (decision 9; `ids.ts` implements the patterns, 3.2b the file checks):

| What | Rule | Example |
| --- | --- | --- |
| Track ID | `^[a-z][a-z0-9-]{0,31}$`, not `user` | `dsa` |
| Item ID | `<trackId>:<localId>`, local `^[a-z0-9][a-z0-9-]{0,63}$`, the track prefix = the folder's track | `english:w01-blocker` |
| Problem | folder `lc-<leetcode, ≥ 4 digits zero-padded>-<leetcode slug>` (slug `^[a-z0-9]+(?:-[a-z0-9]+)*$`, ≤ 80 chars), ID `<track>:lc-<same digits>` | `problems/lc-0001-two-sum/` → `dsa:lc-0001` |
| Lesson | `lessons/<slug>.mdx`, ID `<track>:lesson-<slug>` | `dsa:lesson-arrays-hashing` |
| Deck | `decks/<slug>.yaml`, ID `<track>:deck-<slug>` | `english:deck-w01-standup` |
| Exercise / prompt | local ID starts `ex-` / `prompt-` | `english:ex-w01-fill-1`, `dsa:prompt-mock-interview` |
| Card | any local ID not starting `lc-`, `lesson-`, `deck-`, `ex-`, `prompt-` | `english:w01-blocker` |
| Derived card | `<track>:<derived deck id>:<source item ID>` | `english:explaining-code:dsa:lc-0001` |
| Topic / variant / format / tag | `^[a-z0-9][a-z0-9-]{0,31}$` | `two-pointers`, `8w`, `pattern`, `weekend-task` |
| Reserved | any ID starting `user:`; track ID `user` | — |

**Interfaces:**

```ts
// lib/content/schemas/common.ts
export const ITEM_TYPES = ['problem', 'flashcard', 'lesson', 'exercise', 'prompt'] as const
export type ItemType = (typeof ITEM_TYPES)[number]
export const ITEM_STATUSES = ['draft', 'active', 'retired'] as const
export type ItemStatus = (typeof ITEM_STATUSES)[number]
export const CODE_LANGUAGES = ['python', 'java', 'go'] as const
export type CodeLanguage = (typeof CODE_LANGUAGES)[number]
export const nonEmptyText            // z.string().trim().min(1)
export const localizedTextSchema     // z.strictObject({ vi: nonEmptyText, en: nonEmptyText })
export type LocalizedText = z.infer<typeof localizedTextSchema>
export const httpsUrlSchema          // z.url({ protocol: /^https$/ })
export const itemStatusSchema        // z.enum(ITEM_STATUSES).default('active')
export const provenanceShape         // { origin: z.literal('bot').optional(),
                                     //   createdByRun: z.string().regex(/^run_\d{4}-\d{2}-\d{2}(?:-\d+)?$/).optional() }
                                     // createdByRun without origin → issue (every item schema refines it)

// lib/content/schemas/ids.ts
export const RESERVED_TRACK_ID = 'user'
export const TRACK_ID_PATTERN = /^[a-z][a-z0-9-]{0,31}$/
export const LOCAL_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/
export const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,31}$/        // topics, variants, formats, tags
export const LOCAL_ID_PREFIX = { problem: 'lc-', lesson: 'lesson-', deck: 'deck-', exercise: 'ex-', prompt: 'prompt-' } as const
export type ParsedItemId = { trackId: string; localId: string }
export function parseItemId(id: string): ParsedItemId | null   // exactly one ':'; null when malformed or reserved
export type ParsedDerivedId = { trackId: string; deckId: string; sourceId: string }
export function parseDerivedId(id: string): ParsedDerivedId | null
export function isReservedId(id: string): boolean
export function derivedCardId(trackId: string, deckId: string, sourceId: string): string
export function problemLocalId(leetcode: number): string       // 1 → 'lc-0001', 1143 → 'lc-1143', 10000 → 'lc-10000'
export function parseProblemFolder(name: string): { leetcode: number; slug: string } | null
// `lc-<digits>-<slug>`, slug /^[a-z0-9]+(?:-[a-z0-9]+)*$/ and ≤ 80 characters
export const trackIdSchema, itemIdSchema, slugSchema            // Zod wrappers of the rules above
```

`lib/content/schemas/manifest.ts` becomes **strict** (M2's `looseObject` goes); existing exports
keep their names (`TRACK_ACCENTS`, `templateBlockSchema`, `weeklyTemplateSchema`,
`trackManifestSchema`, `TrackManifest`, `WeeklyTemplate`, `RoadmapRef`, `TemplateBlock`), plus:

```ts
export const WEEKDAY_KEYS = ['mon-fri', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
// templateBlockSchema → z.discriminatedUnion('kind', [ each strict, each may carry fromWeek?: posInt
//   { kind: 'review', maxMinutes?: posInt }, { kind: 'new' }, { kind: 'recap', count: posInt },
//   { kind: 'practice', minutes: posInt, tag?: slug, itemType?: ItemType } — exactly one of tag / itemType ])
export const srsParamsSchema     // strict { intervals: posInt[] ≥ 1, strictly increasing; relearnDays: posInt; masteredAfter: posInt }
export const srsSchema           // srsParams + byType?: z.partialRecord(z.enum(['problem', 'flashcard']), srsParamsSchema.partial())
export const reviewSchema        // strict { recallMinutes: number > 0; redoFactor: number > 0 and ≤ 1 }
export const estimatesSchema     // strict { lesson?: >0; problem?: { new: { E, M, H: >0 } }; prompt?: >0;
                                 //          flashcard?: { new: >0, review: >0 }; exercise?: >0 }
export const topicSchema         // strict { id: slug, title: localizedText, signals: nonEmptyText[] = [], requires: slug[] = [] }
export const LESSON_REFS = ['anchor', 'practice', 'about'] as const
export const LESSON_RULES = ['anchor!=practice', 'practice!=about', 'same-topic', 'one-per-topic', 'max-1-per-about'] as const
export const lessonFormatSchema  // strict { sections: /^[a-z][a-z0-9-]*$/[] ≥ 1 unique; requires: LESSON_REFS[] = []; rules: LESSON_RULES[] = [] }
export const DERIVED_FIELDS = ['note.bilingual.en', 'note.bilingual.vi', 'problem.title'] as const
export const TEMPLATE_PLACEHOLDERS = ['problem.title', 'problem.leetcode', 'problem.difficulty'] as const
export const derivedDeckSchema   // strict { id: LOCAL_ID; kind: 'derived'; title?: localizedText;
                                 //   from: strict { track: trackId; itemType: 'problem' }; unlock: 'attempted';
                                 //   map: strict { front: MapValue; back: MapValue; hint?: MapValue } }
                                 // MapValue = strict { template: text whose {…} are TEMPLATE_PLACEHOLDERS } | enum(DERIVED_FIELDS)
// trackManifestSchema — strict: id (trackId, not 'user'), status, title, accent, itemTypes (ItemType[] ≥ 1, unique),
//   codeLanguages? (CodeLanguage[] ≥ 1, unique), srs, review?, topics = [], lessonFormats? (record slug → format),
//   defaults (unchanged), estimates, decks = [] (derived decks), roadmaps (ids slug, unique), weeklyTemplate
//   superRefine, issue path in brackets:
//   - every listed item type has its estimate                                [estimates.<type>]
//   - problem listed ⇒ review and codeLanguages present                      [review] [codeLanguages]
//   - lesson listed ⇔ lessonFormats present and non-empty                     [lessonFormats]
//   - srs.byType keys are listed item types                                  [srs.byType.<type>]
//   - topic IDs unique, every `requires` names a topic, no cycle ('a → b → a') [topics]
//   - decks non-empty ⇒ flashcard listed; deck IDs unique                     [decks]
//   - a practice block's itemType is a listed item type                      [weeklyTemplate.<day>.<i>.itemType]
export function topicCycle(topics: readonly { id: string; requires: readonly string[] }[]): string[] | null
export type Topic = z.infer<typeof topicSchema>
export type LessonFormat = z.infer<typeof lessonFormatSchema>
export type LessonRule = (typeof LESSON_RULES)[number]
export type DerivedDeck = z.infer<typeof derivedDeckSchema>
export type TrackEstimates = Pick<TrackManifest, 'estimates' | 'review'>
```

```ts
// lib/content/schemas/roadmap.ts
export const RECAP_MODES = ['recall', 'redo', 'explain-aloud'] as const
export type RecapMode = (typeof RECAP_MODES)[number]
export const recapEntrySchema    // strict { item: itemId; mode?: RecapMode }   — no mode = introduce it (e.g. 271 in W1)
export const roadmapWeekSchema   // strict { week: posInt; topics: slug[] ≥ 1; core: itemId[] = []; bonus: itemId[] = [];
                                 //          recap: RecapEntry[] = []; decks: itemId[] = [] }
export const roadmapSchema       // strict { id: slug; weeks: RoadmapWeek[] ≥ 1 }
//   superRefine: weeks numbered 1..n in file order                  [weeks.<i>.week]
//                an item placed at most once (core ∪ bonus ∪ recap entries without mode) [weeks.<i>.<list>.<j>]
//                a deck listed at most once; a topic in at most one week
export type Roadmap, RoadmapWeek, RecapEntry
/** Items a week introduces in queue order (§5.3): core, then recap entries without a mode. */
export function placedItems(week: RoadmapWeek): string[]
/** §3.4 week sizes: core items plus `tier: core` cards of the week's decks. */
export function weekSizes(roadmap: Roadmap, coreCardsInDeck: (deckId: string) => number): number[]
```

```ts
// lib/content/item-types/types.ts
export type Mode = 'new' | 'recall' | 'redo' | 'review' | 'explain-aloud'
export type Outcome = 'success' | 'partial' | 'fail'
export type ItemTypeCore<T> = {
  type: ItemType
  schema: z.ZodType<T>                                  // the authored entry
  outcomes: Readonly<Record<string, Outcome>>
  srs: boolean
  estimateMinutes(item: T, estimates: TrackEstimates, mode: Mode): number
}

// lib/content/item-types/problem.ts
export const DIFFICULTIES = ['E', 'M', 'H'] as const
export type Difficulty = (typeof DIFFICULTIES)[number]
export const problemSchema         // strict { id: itemId; leetcode: int 1–99999; title: nonEmptyText (English, never translated);
                                   //   difficulty; topic: slug; premium: boolean = false;
                                   //   alternatives: { label: nonEmptyText; url: httpsUrl }[] = []; status; ...provenance }
                                   // refine: localId === problemLocalId(leetcode) [id]; premium ⇒ ≥ 1 alternative [alternatives]
export const noteFrontmatterSchema // strict { status; ...provenance } — a note may have no frontmatter (= active)
export type Problem = z.infer<typeof problemSchema>
export type NoteFrontmatter = z.infer<typeof noteFrontmatterSchema>
export const problemType: ItemTypeCore<Problem>
// outcomes { solved: 'success', hint: 'partial', failed: 'fail' }; srs true
// new → estimates.problem.new[difficulty]; recall | review | explain-aloud → review.recallMinutes (decision 12);
// redo → Math.round(new × review.redoFactor)

// lib/content/item-types/lesson.ts
export const lessonFrontmatterSchema // strict { id; format: slug; topic: slug; title: nonEmptyText; anchor?: itemId;
                                     //   practice?: itemId; about?: itemId; status; ...provenance }
export type LessonFrontmatter
export const lessonType: ItemTypeCore<LessonFrontmatter>  // outcomes {} (completion); srs false; estimates.lesson

// lib/content/item-types/flashcard.ts
export const PARTS_OF_SPEECH = ['noun', 'verb', 'adjective', 'adverb', 'phrase', 'phrasal-verb', 'idiom', 'abbreviation'] as const
export const REGISTERS = ['formal', 'neutral', 'informal'] as const
export const CARD_TIERS = ['core', 'extended', 'derived'] as const   // 'derived' only on generated cards
export const cardSchema            // strict { id; tier: CardTier; front; back; hint?;
                                   //   usage?: strict { pos; register; note?: nonEmptyText }; example?; pronunciation?;
                                   //   tags: slug[] = []; status; ...provenance }
export const deckFileSchema        // strict { id; kind: 'vocabulary' | 'recall'; week: posInt; topic: slug; title: localizedText;
                                   //   lang: strict { front: 'en' | 'vi'; back: 'en' | 'vi' } = { front: 'en', back: 'vi' };
                                   //   status; cards: Card[] ≥ 1 }
                                   // refine: vocabulary ⇒ every card has usage, example, pronunciation [cards.<i>.<field>];
                                   //         card IDs unique; `tier: derived` is not allowed in a deck file [cards.<i>.tier]
export type CardTier = (typeof CARD_TIERS)[number]
export type Card, DeckFile
export const flashcardType: ItemTypeCore<Card>  // outcomes { know: 'success', unsure: 'partial', dont_know: 'fail' }; srs true;
                                                // new → estimates.flashcard.new, any other mode → .review

// lib/content/item-types/exercise.ts
export const EXERCISE_KINDS = ['fill-blank', 'respond', 'rewrite'] as const
export const BLANK = '{{blank}}'
export const exerciseSchema        // z.discriminatedUnion('kind'); common strict { id; week: posInt; topic: slug;
                                   //   instruction: localizedText; text: nonEmptyText; status; ...provenance }
                                   // fill-blank + { answers: nonEmptyText[] ≥ 1; hint?: nonEmptyText } — text holds BLANK exactly once
                                   // respond | rewrite + { sampleAnswers: nonEmptyText[] ≥ 1; rubric: nonEmptyText[] ≥ 1 }
export const exercisesFileSchema   // Exercise[] ≥ 1
export type Exercise
export const exerciseType: ItemTypeCore<Exercise>  // outcomes { pass: 'success', close: 'partial', miss: 'fail' }; srs false; estimates.exercise
/** §3.5: case- and whitespace-insensitive (NFC, trim, collapse spaces, toLocaleLowerCase('en')). */
export function gradeFillBlank(input: string, answers: readonly string[], hintRevealed: boolean): 'pass' | 'close' | 'miss'

// lib/content/item-types/prompt.ts
export const promptSchema          // strict { id; tag: slug; week?: posInt; instruction: localizedText; rubric: nonEmptyText[] = [];
                                   //   minutes?: posInt; repeatable: boolean = false; status; ...provenance }
                                   // refine: repeatable ⇔ week absent [week]
export const promptsFileSchema     // Prompt[] ≥ 1
export type Prompt
export const promptType: ItemTypeCore<Prompt>  // outcomes {} (completion); srs false; item.minutes ?? estimates.prompt

// lib/content/item-types/index.ts
export type AuthoredByType = { problem: Problem; lesson: LessonFrontmatter; flashcard: Card; exercise: Exercise; prompt: Prompt }
export const ITEM_TYPE_CORES: { readonly [K in ItemType]: ItemTypeCore<AuthoredByType[K]> }
export function getItemTypeCore<K extends ItemType>(type: K): ItemTypeCore<AuthoredByType[K]>
```

`weekly-template.ts`: `DAY_ORDER` is `WEEKDAY_KEYS`; the `(từ tuần n)` suffix applies to any block
with `fromWeek`; the practice-label fallback for a block without tag/item type is removed (the
schema forbids it). `track-options.ts` imports `CodeLanguage`/`CODE_LANGUAGES` from `common.ts`.

- [ ] **Step 1: Failing tests.**
  - `ids.test.ts`: `parseItemId('dsa:lc-0001')` → `{ dsa, lc-0001 }`; `null` for `'DSA:lc-0001'`,
    `'dsa:lc-0001 '`, `'dsa:'`, `'dsa:Lc-1'`, `'dsa:bài-1'` (**[RF-3]** ASCII only),
    `'dsa:lc-0001:x'`, `'user:abc'`, `'user:x:y'`; `isReservedId('user:abc')` true;
    `parseDerivedId('english:explaining-code:dsa:lc-0001')` →
    `{ english, explaining-code, dsa:lc-0001 }`; `problemLocalId(1)` `'lc-0001'`, `(1143)`
    `'lc-1143'`, `(10000)` `'lc-10000'`; `parseProblemFolder('lc-0001-two-sum')` →
    `{ 1, 'two-sum' }`, `'lc-0015-3sum'` → `{ 15, '3sum' }`,
    `'lc-0105-construct-binary-tree-from-preorder-and-inorder-traversal'` →
    `{ 105, 'construct-…' }`; `null` for `'lc-1-two-sum'`, `'lc-0001'`, `'lc-0001-Two-Sum'`,
    `'lc-0001-two_sum'`, `'lc-0001-two--sum'`, `'lc-0001--two-sum'` and an 81-character slug.
  - `manifest.test.ts`: both real manifests parse (DSA with the §3.4 `lessonFormats`); every
    `TRACK_ACCENTS` value has a `--track-N:` definition in `docs/design/tokens.css` ("accent token
    exists in the token set", §3.6); issues at the bracketed paths above for: a track with `problem`
    but no `estimates.problem`; `problem` without `review`; `lesson` without `lessonFormats`;
    `requires: [nope]`; the cycle `a → b → a` (message names both); `srs.intervals: [7, 3]`;
    `srs.byType.lesson`; a derived deck template `{problem.slug}`; `{ kind: recap }` without
    `count`; `{ kind: practice, minutes: 5 }` without tag/item type; `{ kind: review, minutes: 5 }`;
    a practice block `itemType: exercise` on a track without exercises; an unknown top-level key
    `foo` (strict); `id: user`; `topicCycle` returns the cycle path or `null`.
  - `roadmap.test.ts`: the §3.4 10w W1 example parses; `weeks` numbered `[1, 3]` → issue;
    `dsa:lc-0001` in W1 core and W2 bonus → issue; a recap entry without mode for an item also in
    core → issue; a recap entry **with** mode for a core item → fine; a topic in two weeks → issue;
    `mode: explain` → issue; `placedItems` order; `weekSizes` → `[8, 8]` for two 8-item weeks and
    counts deck core cards through the callback.
  - Per item type: `problem.test.ts` — premium without alternatives → issue; alternative `http://` →
    issue; `id: dsa:lc-0002` with `leetcode: 1` → issue; `difficulty: X` → issue; estimates M new
    35, recall 5, redo 21, explain-aloud 5, H redo 30; outcomes and `srs: true`. `lesson.test.ts` —
    unknown key → issue; missing `title` → issue; estimate 25. `flashcard.test.ts` — a vocabulary
    card without `pronunciation` → issue at `cards.0.pronunciation`; a recall-deck card without
    `usage` → fine; duplicate card IDs → issue; `tier: derived` in a deck file → issue; `lang`
    default; estimates new 1.5, review 0.5. `exercise.test.ts` — **exercise kinds**: fill-blank with
    zero or two `{{blank}}` → issue; respond without `rubric` → issue; `kind: choose` → issue;
    `gradeFillBlank('  Blocked ', ['blocked'], false)` → `pass`, with the hint → `close`, `'block'`
    → `miss`; **[RF-3]** NFD input `'Café'` against `'Café'` → `pass`. `prompt.test.ts` —
    `repeatable: true` with `week` → issue; neither → issue; estimate 45 with `minutes: 45`, 10
    without. `index.test.ts` — every `ITEM_TYPES` entry has a core; `srs` is true exactly for
    problem and flashcard; `createdByRun` without `origin` → issue.
  - `weekly-template.test.ts` / `tracks.test.ts`: the weekday fixture's error names
    `weeklyTemplate` (M2 minor); a `fromWeek` on a review block prints the suffix; fixtures updated
    to the strict schema.
- [ ] **Step 2: RED** — `pnpm test lib/content lib/auth`.
- [ ] **Step 3: Implement** the schemas and cores; add `lessonFormats` (verbatim §3.4) and
  `estimates.flashcard` to `content/tracks/dsa/track.yaml`; `pnpm format`.
- [ ] **Step 4: GREEN** + `pnpm verify` (onboarding and settings keep working: the manifests still
  load through the M2 loader).
- [ ] **Step 5: Commit** — `feat(content): item-type schemas, roadmap schema and the full track
  manifest`.

**Carry-overs from M2** (M2 deferred minors owned by this task; covered by its steps — tests
first, same commit):

- one source of truth for: the code-language list (today in `lib/auth/dal.ts`,
  `lib/content/track-options.ts`, the onboarding and settings schemas, `lib/domain/events.ts` and
  the DB check), the budget-minutes rule (10–240 step 5; ~5 places), `MAX_START_DAYS_AHEAD` and
  `withTitle` (duplicated in onboarding/settings) — export from `lib/content` or `lib/domain` and
  import everywhere; move the `CodeLanguage` type out of `lib/auth/dal` (content must not depend
  on auth);
- manifest schema: roadmap ids use the DB `roadmap_variant` pattern; a manifest's `id` must equal
  its folder name;
- `lib/content/tracks.test.ts` weekday-key case asserts the field name, not only the file;
  `weekly-template.ts` `DAY_ORDER` reuses the schema's weekday keys; a practice block without
  `tag`/`itemType` gets no stray leading space.

### Task 3.2a: MDX parser, safety check and component allowlist

**Files:**

- Create: `lib/content/mdx-components.ts`, `tools/content/issues.ts` (+ test),
  `tools/content/allowlist.ts` (+ test), `tools/content/mdx/{parse,safety,facts}.ts` (+ a test
  each), `tools/content/__fixtures__/mdx/{lesson-ok.mdx,note-ok.mdx}`

**Interfaces:**

```ts
// lib/content/mdx-components.ts — the one list both the check (3.2a) and the renderers (3.3b) are typed against
export const MDX_COMPONENT_NAMES = ['Section', 'Callout', 'Steps', 'Step', 'VarTable', 'Complexity', 'Bilingual',
  'Solution', 'Practice', 'Quiz', 'Question', 'Choice', 'Reveal', 'Term'] as const
export type MdxComponentName = (typeof MDX_COMPONENT_NAMES)[number]

// tools/content/issues.ts
export type ContentIssue = { file: string; line?: number; column?: number; path?: string; message: string }
export function formatIssue(issue: ContentIssue): string
// 'content/tracks/dsa/lessons/x.mdx:12:3: message' | 'content/tracks/dsa/decks/w01.yaml: cards.3.front: message'
export function sortIssues(issues: readonly ContentIssue[]): ContentIssue[]   // by file, line, column, path

// tools/content/allowlist.ts (§3.5: the allowlist lives in code, outside content/**)
export type MdxContext = 'lesson' | 'note'
export type AttributeRule = { required?: boolean; values?: readonly string[]; pattern?: RegExp; maxLength?: number }
export type ComponentRule = {
  attributes: Readonly<Record<string, AttributeRule>>
  contexts: readonly MdxContext[]
  display: 'block' | 'inline'                // block ⇒ mdxJsxFlowElement, inline ⇒ mdxJsxTextElement
  parents?: readonly MdxComponentName[]       // allowed direct parents (component ancestors), when restricted
  topLevel?: true                             // a direct child of the document root only
  children?: 'none' | 'text' | 'any' | readonly MdxComponentName[] | 'table'
  perFile?: { min?: number; max?: number }    // per file, in the contexts listed
}
export const MDX_COMPONENTS: { readonly [K in MdxComponentName]: ComponentRule }
export const CODE_LANGS: readonly string[]   // ['python', 'java', 'go', 'text']
/** OD3: the one allow-listed image source, committed as data (a public URL — no key). If it is ever
 *  set to '', every MDX image is rejected (tested with an injected base). */
export const CONTENT_IMAGE_BASE_URL = 'https://oelgwbxukbgaqqvociwi.supabase.co/storage/v1/object/public/content-images/'
export const IMAGE_EXTENSIONS: readonly string[]   // ['svg', 'png', 'webp', 'jpg']
export const IMAGE_PATH_PATTERN: RegExp            // /^[a-z0-9\-_/.]+$/ — the part after the base URL
export const IMAGE_SIZE_TITLE: RegExp              // /^([1-9]\d{0,3})x([1-9]\d{0,3})$/ — `![alt](url "WIDTHxHEIGHT")`
/** next.config.ts `images.remotePatterns` from the same base URL (single source): [] when it is empty. */
export function contentImageRemotePatterns(baseUrl?: string):
  { protocol: 'https'; hostname: string; pathname: string }[]   // pathname = the base path + '**'

// tools/content/mdx/parse.ts
export type MdxNode = { type: string; name?: string | null; value?: string; url?: string; lang?: string | null;
  meta?: string | null; depth?: number; attributes?: MdxAttribute[]; children?: MdxNode[];
  position?: { start: { line: number; column: number } } }
export type MdxAttribute =
  | { type: 'mdxJsxAttribute'; name: string; value: string | null | { type: 'mdxJsxAttributeValueExpression'; value: string } }
  | { type: 'mdxJsxExpressionAttribute'; value: string }
export type MdxRoot = MdxNode & { type: 'root'; children: MdxNode[] }
export type ParseResult = { ok: true; tree: MdxRoot } | { ok: false; issue: ContentIssue }
export function parseMdx(file: string, source: string): Promise<ParseResult>

// tools/content/mdx/safety.ts
export type CheckOptions = {
  imageBaseUrl?: string       // default CONTENT_IMAGE_BASE_URL (tests inject a base)
  imagePathPrefix?: string     // `<trackId>/<localId>/` — content:build passes the item's; the upload convention
}
export function checkMdx(file: string, tree: MdxRoot, context: MdxContext, options?: CheckOptions): ContentIssue[]

// tools/content/mdx/facts.ts
export type MdxFacts = {
  frontmatter: string | null                           // raw YAML of the leading `yaml` node
  sections: { kind: string; line: number }[]           // top-level <Section kind>, in order
  bilingual: { vi: string; en: string }[]
  complexity: { time: string; space: string }[]
  solutionCount: number
  practice: string[]                                   // <Practice problem> values
  codeBlocks: { lang: string; value: string }[]        // fenced code, value without the trailing newline
  images: { url: string; alt: string; width: number; height: number; line: number }[]
  questions: number
}
export function mdxFacts(tree: MdxRoot): MdxFacts
```

`parseMdx` (OD1: `@mdx-js/mdx` is an approved dev dependency): one processor, built once —
`createProcessor({ remarkPlugins: [remarkFrontmatter, remarkGfm] })` from `@mdx-js/mdx`, then
`processor.parse({ path: file, value: source })`; a thrown `VFileMessage` becomes one issue with
`line`/`column` from `place` (`place.start` when it is a range) and the message `reason`.

**Block and inline placement** (gate review fix 2, mirrors MDX's own "unravel" step, which runs
after parsing): a `paragraph` whose non-whitespace children are all JSX elements counts as flow —
its elements are checked as block elements. "Put `<X>` on its own line" is reported only when
text and a block component share a paragraph (e.g. prompt text followed by `<Choice>` lines).

**Allowlist** (§3.5; `display` per decision 17):

| Component | Attributes | Contexts | Placement and children |
| --- | --- | --- | --- |
| `Section` | `kind` required, `^[a-z][a-z0-9-]*$` | lesson | block, top level only; any children |
| `Callout` | `tone` required (`info` \| `tip` \| `warning`), `title` | lesson, note | block; any |
| `Steps` | — | lesson, note | block; children `Step` only |
| `Step` | `title` | lesson, note | block; parent `Steps`; inline or paragraph children (one line is fine) |
| `VarTable` | `caption` | lesson, note | block; one GFM table |
| `Complexity` | `time`, `space` required, ≤ 40 chars | lesson, note | block, no children; note: exactly 1 |
| `Bilingual` | `vi`, `en` required, ≤ 300 chars | lesson, note | block, no children; note: exactly 1 |
| `Solution` | — | note | block, no children, exactly 1 |
| `Practice` | `problem` required, `^[a-z][a-z0-9-]{0,31}:lc-\d{4,5}$` | lesson | block, no children |
| `Quiz` | — | lesson | block; children `Question` only |
| `Question` | `prompt` required ≤ 300 chars, `answer` required | lesson | block; parent `Quiz`; children `Choice` only (≥ 2, unique `id`, `answer` among them) |
| `Choice` | `id` required, `^[a-z0-9]{1,8}$` | lesson | block; parent `Question`; inline or paragraph children (one line is fine) |
| `Reveal` | `label` | lesson, note | block; any |
| `Term` | `vi` | lesson, note | inline; text children only |

**Safety rules** (`checkMdx`, one issue each, with line and column):

1. `mdxjsEsm` → "import/export is not allowed in content MDX".
2. `mdxFlowExpression` / `mdxTextExpression` → "`{…}` expressions are not allowed — write
   `` `{}` `` or escape braces as `\{` `\}`" (spike: a `{}` table cell is an expression).
3. A JSX element that is a fragment or not in `MDX_COMPONENTS` (including lowercase HTML such as
   `<script>`, `<img>`, `<div>`) → "`<X>` is not an allowed component"; wrong context → "`<Solution
   />` is only allowed in notes"; wrong display (after the unravel rule above) → "put `<Choice>` on
   its own line — it shares a paragraph with text" / "`<Term>` must stay inside a sentence".
4. Attributes: spread (`mdxJsxExpressionAttribute`) → not allowed; expression value → "attribute
   values must be literal strings"; unknown name, missing required, a bare boolean attribute,
   `values` / `pattern` / `maxLength` mismatch → one issue each.
5. Placement: `parents`, `topLevel`, `children`, `perFile`; `Question.answer` must name one of its
   `Choice` IDs.
6. `link` and `definition`: the URL must start with `https://` — `http:`, relative, `mailto:`,
   `javascript:`, `data:` and GFM autolink literals like `www.x.test` (which become `http://`) are
   rejected.
7. **Images** (OD3 — the `content-images` bucket): only inline `![alt](url "WIDTHxHEIGHT")`.
   `CONTENT_IMAGE_BASE_URL` empty → "images need CONTENT_IMAGE_BASE_URL in
   tools/content/allowlist.ts — see docs/ops/content-images.md"; otherwise one issue each for: empty
   alt text (≤ 200 chars); a URL that does not start exactly with the base (other host, `http:`,
   relative or local paths); a remainder outside `IMAGE_PATH_PATTERN`, containing a `..` segment or
   `//`, or not starting with `imagePathPrefix` when given; an extension outside `IMAGE_EXTENSIONS`;
   a missing or malformed size title (`IMAGE_SIZE_TITLE`, 1–9999 px). `imageReference`
   (`![alt][ref]`) → "use an inline image". No network check (offline build).
8. Fenced `code`: a language is required and must be in `CODE_LANGS`; `meta` must be empty.
9. Headings: lesson `###`–`####` only, note `##`–`####` only.
10. Frontmatter: a lesson must start with a `yaml` node; a `yaml` node anywhere else → issue.
11. Any node type outside the known mdast/GFM/MDX set (root, yaml, paragraph, text, heading,
    thematicBreak, blockquote, list, listItem, table, tableRow, tableCell, emphasis, strong,
    delete, inlineCode, code, break, link, linkReference, definition, image, imageReference,
    mdxJsxFlowElement, mdxJsxTextElement) → "unsupported syntax" (fail closed; footnotes are out).

- [ ] **Step 1: Failing tests.** `safety.test.ts` (inline sources through `parseMdx` then
  `checkMdx`): `lesson-ok.mdx` and `note-ok.mdx` (every allowed component, nested correctly) → `[]`;
  then exactly one issue, with its line, for each of: `import x from 'y'`; `export const a = 1`;
  `{1 + 1}`; `{/* c */}`; a GFM table cell `{}`; `<Callout tone={"tip"}>`;
  `<Section {...p} kind="a">`; `<script>`; `<Unknown />`; `<img src="https://x.test/a.png" />`;
  `[a](javascript:alert(1))`; `[b](http://x.test)`; `[c](data:text/html,x)`; `[d](/t/dsa)`;
  `www.x.test`; `[r]: javascript:x` + `[go][r]`; a fence without language; ```` ```rust ````;
  `# Title` in a note; `## Title` in a lesson; `<Solution />` in a lesson; two `<Solution />` in a
  note; a note without `<Bilingual>`; `<Choice>` outside `<Question>`; `<Question answer="c">` with
  choices `a`, `b`; a paragraph holding text and a `<Choice>`; `<Section>` inside `<Callout>`;
  `<Term><Callout /></Term>`; `<Complexity time="O(n)" />` (missing `space`). **Unravel (fix 2):**
  `<Steps>` whose `<Step title="a">x</Step>` sits on one line after a blank line, and a `<Question>`
  whose one-line `<Choice id="a">x</Choice>` entries follow blank lines (or each other) → `[]`.
  **Images (OD3)**, with
  `imageBaseUrl: 'https://ref.supabase.co/storage/v1/object/public/content-images/'` and
  `imagePathPrefix: 'dsa/lesson-two-pointers/'`:
  `![Two pointers](<base>dsa/lesson-two-pointers/walk.svg "640x360")` → `[]` and `mdxFacts` reports
  width 640, height 360; one issue each for another host
  (`https://evil.test/dsa/lesson-two-pointers/a.png`), `http://` + the base host, empty alt
  (`![](…)`), `a.gif`, a `../` segment, a path outside the prefix, no size title, `"640"` as title,
  `![x][ref]`; and with `imageBaseUrl: ''` any image → the "images need CONTENT_IMAGE_BASE_URL"
  issue. `contentImageRemotePatterns('')` → `[]`; with the base above →
  `[{ protocol: 'https', hostname: 'ref.supabase.co', pathname: '/storage/v1/object/public/content-images/**' }]`;
  `contentImageRemotePatterns()` (the committed base) → hostname `oelgwbxukbgaqqvociwi.supabase.co`,
  the same pathname; `CONTENT_IMAGE_BASE_URL` starts with `https://` and ends with
  `/content-images/`. `parse.test.ts`: an unclosed `<Section>` → `ok: false` with line 5 and a
  message naming `Section`; an unbalanced `{` → line and column. `facts.test.ts`: sections with
  lines in order, bilingual, complexity, practice, code block value without the trailing newline,
  images with size, question count, raw frontmatter. `allowlist.test.ts`: the keys equal
  `MDX_COMPONENT_NAMES`; every `parents` / `children` entry is a known component. `issues.test.ts`:
  both output shapes and the sort order.
- [ ] **Step 2: RED** — `pnpm test tools/content`. **Step 3: Implement.** **Step 4: GREEN** +
  `pnpm verify`.
- [ ] **Step 5: Commit** — `feat(content): MDX parser, safety check and component allowlist`.

### Task 3.3a: Build-time code highlighting and the CodeBlock pattern

**Spike (2026-09-25):** shiki 4.4.3, `createHighlighterCore` from `shiki/core` with the JavaScript
regex engine (`shiki/engine/javascript`, no WASM) and `createCssVariablesTheme`: init 8 ms, 300
Python/Java/Go snippets in 245 ms; token colours come back as CSS variables
(`var(--shiki-token-keyword)`, `-string`, `-string-expression`, `-constant`, `-comment`,
`-function`, `-parameter`, `-punctuation`, `-link`, `var(--shiki-foreground)`).

**Files:**

- Create: `lib/content/code-tokens.ts` (+ test), `tools/content/highlight.ts` (+ test),
  `components/patterns/code-block.tsx` (+ test), `features/items/code-tokens.types.test.ts` (type
  level: the two declarations stay identical), `app/dev/components/code-samples.ts` (hand-written
  `HighlightedCode` fixtures — the catalog is a client module and must not import shiki)
- Modify: `app/dev/components/registry.tsx`, `docs/design/COMPONENTS.md`,
  `docs/design/DESIGN_SYSTEM.md` (§9 row "CodeBlock": the decision-13 colour mapping)

**Interfaces:**

A pattern may import only `components/ui`, `lib/utils` and `lib/i18n` (§7.2), so **CodeBlock
declares its own token types** and `lib/content/code-tokens.ts` declares identical ones (gate
review fix 1); `features/items/code-tokens.types.test.ts` (features may import both) keeps them
equal with `expectTypeOf<…>().toEqualTypeOf<…>()` for `CodeTokenKind`, `CodeLine` and
`HighlightedCode` — checked by `pnpm typecheck`.

```ts
// lib/content/code-tokens.ts — pure, client-safe
export const CODE_TOKEN_KINDS = ['keyword', 'string', 'constant', 'comment'] as const
export type CodeTokenKind = (typeof CODE_TOKEN_KINDS)[number]
/** Plain runs are strings; highlighted runs are [text, kind]; adjacent runs of one kind are merged. */
export type CodeLine = ReadonlyArray<string | readonly [text: string, kind: CodeTokenKind]>
export type HighlightedCode = { lang: string; lines: readonly CodeLine[] }
export type CodeBundle = {
  solutions: Partial<Record<'python' | 'java' | 'go', HighlightedCode>>   // a problem's solution files;
                                                             // 3.2b replaces the union by CodeLanguage (3.1)
  blocks: Readonly<Record<string, HighlightedCode>>           // fenced blocks of the item's MDX, by codeBlockKey
}
/** Removes one trailing '\n', splits on '\n' — no highlighting ('text' blocks, fallbacks). */
export function plainCode(lang: string, code: string): HighlightedCode
/** `${lang}:${fnv1a32 hex of the code without one trailing '\n'}` — the MDX `pre` override gets the
 *  text with a trailing newline (spike), content:build without; both normalise the same way. */
export function codeBlockKey(lang: string, code: string): string

// tools/content/highlight.ts
export type Highlighter = { highlight(code: string, lang: string): HighlightedCode; dispose(): void }
export async function createHighlighter(): Promise<Highlighter>
// langs python, java, go ('text' → plainCode; anything else throws `unsupported language: <x>`);
// kinds: -keyword → keyword; -string | -string-expression → string; -constant → constant;
// -comment → comment; every other colour → plain text

// components/patterns/code-block.tsx — server-compatible (no hooks, no 'use client'); imports no lib/content
export type CodeTokenKind = 'keyword' | 'string' | 'constant' | 'comment'
export type CodeLine = ReadonlyArray<string | readonly [text: string, kind: CodeTokenKind]>
export type HighlightedCode = { lang: string; lines: readonly CodeLine[] }
export type CodeBlockProps = { code: HighlightedCode; label: string /* accessible name, e.g. 'Lời giải Python' */ }
export function CodeBlock(props: CodeBlockProps): React.JSX.Element
export const CODE_TOKEN_CLASS: Readonly<Record<CodeTokenKind, string>>
// keyword 'text-primary', string 'text-success', constant 'text-warning', comment 'text-muted-foreground italic'
```

CodeBlock renders `<pre tabIndex={0} role="region" aria-label={label}>` (a focusable scroll
region: axe `scrollable-region-focusable`) with `overflow-x-auto`, `whitespace-pre` (never
wrapped), `rounded-md`, `bg-surface-muted`, `p-4`, `font-mono text-sm` (DESIGN_SYSTEM §9 "Code
tabs"); one `<span className="block">` per line (an empty line keeps its height with a zero-width
space); token runs are `<span className={CODE_TOKEN_CLASS[kind]}>`.

- [ ] **Step 1: Failing tests.** `code-tokens.test.ts`: `plainCode('text', 'a\nb\n')` → two lines;
  `codeBlockKey('python', 'x = 1\n') === codeBlockKey('python', 'x = 1')`; different language →
  different key; the key is stable (a literal expected value). `highlight.test.ts`: Python (the
  two-sum solution of §3.5 as fixture) has keyword runs `class`, `def`, `for`, `return`, a comment
  run starting `#`; Java `public`, `new`, `return` are keywords and `"x"` a string; Go `func`,
  `return` keywords; no two adjacent runs share a kind; `lang: 'text'` → plain; `'rust'` throws; 300
  highlights take < 3 s (guards against re-creating the highlighter per call).
  `code-block.test.tsx`: the region is named by `label` and focusable; keyword runs carry
  `text-primary`; comments `italic`; an empty line renders. `code-tokens.types.test.ts`: the three
  type pairs are equal (fails to typecheck if either side drifts).
- [ ] **Step 2: RED → implement → GREEN** (`pnpm test lib/content tools/content components
  features/items`, `pnpm typecheck`).
- [ ] **Step 3: Catalog** — CodeBlock entry in `COMPONENTS.md` (entry format) and in the registry
  (Python, Java and Go samples from `code-samples.ts`, plus one long line to show the scroll).
- [ ] **Step 4: Verify** `pnpm verify && pnpm test:e2e` (the catalog axe scan covers CodeBlock in
  light and dark). **Commit** — `feat(ui): build-time code highlighting and the CodeBlock pattern`.

### Task 3.5a: `content-verify` M3a, pure part — `tests.yaml` schema, verification, comparators, literals

Everything here is pure TypeScript (no child processes): the `tests.yaml` contract that
`content:build` (3.2b) validates, and the pieces of the harness that need no toolchain. The runtime
part (runners, orchestrator, sandbox, workflow) is 3.5b.

**Files:**

- Create: `lib/content/schemas/tests.ts` (+ test), `lib/content/verification.ts` (+ test),
  `tools/content-verify/comparators.ts` (+ test),
  `tools/content-verify/validators/{index,topological-order}.ts` (+ `topological-order.test.ts`),
  `tools/content-verify/literals.ts` (+ test)

**Interfaces:**

```ts
// lib/content/schemas/tests.ts (§3.5) — imports nothing from 3.1 (same wave): patterns are local,
// identifier = /^[A-Za-z_][A-Za-z0-9_]*$/
export const SCALAR_TYPES = ['int', 'long', 'double', 'bool', 'string', 'char'] as const
export type ValueType = { base: (typeof SCALAR_TYPES)[number]; dims: 0 | 1 | 2 }
export function parseValueType(text: string): ValueType | null   // 'int[][]' → { int, 2 }; unknown → null
export function valueMatches(value: unknown, type: ValueType): boolean
// int / long: safe integers; double: finite numbers; bool; string; char: a one-code-unit string; arrays per dims
export const SIGNATURE_KINDS = ['function', 'linked-list', 'tree', 'graph-node', 'random-list', 'design-class'] as const
export type SignatureKind = (typeof SIGNATURE_KINDS)[number]
// signature, discriminated on `kind`:
//   function:      strict { kind; name: identifier; params: Record<identifier, ValueTypeText> (YAML order = call order);
//                           returns: ValueTypeText | 'void' }
//   linked-list | tree | graph-node | random-list (M3b): strict { kind; name; params: Record<identifier, string>; returns: string }
//   design-class (M3c, decision 20): strict { kind; className: /^[A-Z][A-Za-z0-9]*$/;
//                           constructor: Record<identifier, ValueTypeText> = {};
//                           methods: Record<identifier, strict { params: Record<identifier, ValueTypeText> = {}; returns: ValueTypeText | 'void' }> }
// compare (default { kind: 'exact' }): 'exact' | 'unordered' | 'unordered-nested' shorthand strings, or
//   { kind: 'exact' | 'unordered' | 'unordered-nested' } | { kind: 'float'; tolerance: number > 0, ≤ 1 }
//   | { kind: 'in-place'; arg: identifier; compare: 'exact' | 'unordered' | 'unordered-nested' = 'exact' }
//   | { kind: 'validator'; name: /^[a-z][a-z0-9-]*$/ }
// cases: function/structured { name: /^[a-z0-9][a-z0-9-]*$/; input: Record<string, unknown>; expected: unknown }
//        design-class        { name: (same); ops: identifier[] ≥ 1; args: unknown[][]; expected: unknown[] }
export const testsFileSchema   // strict { signature; compare; cases; timeoutMs: int 100–10000 = 2000 }
// superRefine: unique case names; §3.5 minimum → testsMinimumIssues; function: input keys === params keys,
//   each value matches its type, expected matches `returns` (or the in-place arg's type when returns is 'void'),
//   in-place `arg` is a param; design-class: ops[0] === className, ops/args/expected lengths equal, each later op
//   is a method, args lengths match params, `{ $result: n }` only as an argument with n < its index,
//   `{ $any: true }` only in expected
export type TestsFile = z.infer<typeof testsFileSchema>
export type CompareSpec = TestsFile['compare']
/** §3.5 minimum: ≥ 1 case named `example-<n>`, ≥ 2 other cases, ≥ 4 in total. Every LeetCode example is an owner check. */
export function testsMinimumIssues(cases: readonly { name: string }[]): string[]

// lib/content/verification.ts
export type Verification = 'tested' | 'compile-only'
export const SUPPORTED_SIGNATURE_KINDS: readonly SignatureKind[]   // ['function'] in M3a (M3b, M3c extend it)
export function verificationFor(kind: SignatureKind): Verification

// tools/content-verify/comparators.ts
export type Comparison = { ok: true } | { ok: false; reason: string }
export function compare(spec: CompareSpec, actual: unknown, expected: unknown, input: Readonly<Record<string, unknown>>): Comparison
// exact: deep equality of JSON values; unordered: multiset of canonical JSON; unordered-nested: sort each inner
// array, then multiset; float: |a − e| ≤ tolerance elementwise; in-place: the runner reports the argument, then
// the nested compare; validator: VALIDATORS[name](input, actual, expected)

// tools/content-verify/validators/index.ts — executable checks live here, outside content/** (§3.7)
export type Validator = (input: Readonly<Record<string, unknown>>, actual: unknown, expected: unknown) => true | string
export const VALIDATORS: Readonly<Record<string, Validator>>   // 'topological-order' (for 210 later)

// tools/content-verify/literals.ts — used by 3.5b's generated Java and Go harnesses
export function javaLiteral(value: unknown, type: ValueType): string   // new int[][]{{1,2},{3}}, 5L, 2.0, 'x', "a\"b"
export function goLiteral(value: unknown, type: ValueType): string     // [][]int{{1,2},{3}}, int64(5), float64(2), byte(120)
export function javaType(type: ValueType): string                      // int[][], long, double, boolean, String, char[]
export function goType(type: ValueType): string                        // [][]int, int64, float64, bool, string, []byte
```

- [ ] **Step 1: Failing tests.** `tests.test.ts`: the §3.5 two-sum file parses (`compare:
  unordered` → `{ kind: 'unordered' }`, `timeoutMs` 2000); issues for 3 cases; no `example-*`; one
  edge case only; duplicate names; a missing and an extra input key; `nums: [1, '2']`; `expected:
  'x'` for `int[]`; in-place `arg: missing`; design-class `ops[0] !== className`, unequal lengths,
  `{ $result: 3 }` at index 2, `{ $any: true }` inside `args`; `parseValueType` table (`int`,
  `char[][]`, `int[][][]` → null, `List<int>` → null); `valueMatches` for `char` (`'ab'` false) and
  `long`. `verification.test.ts`: `function` → `tested`; every other kind → `compile-only`.
  `comparators.test.ts` — **every comparator**: exact (`[0, 1]` vs `[1, 0]` fails; `1` equals
  `1.0`); unordered (`[1, 0]` passes, `[1, 1]` vs `[1, 0]` fails); unordered-nested (the spike's
  group-anagrams outputs in three different orders pass; a missing group fails); float (tolerance
  boundary 1e-5 passes, 2e-5 fails); in-place with nested unordered; validator topological-order
  (valid and invalid orders for `numCourses: 4, prerequisites: [[1,0],[2,0],[3,1],[3,2]]`); unknown
  validator → `ok: false`. `literals.test.ts`: `javaLiteral` / `goLiteral` for `int[][]` `[[1, 2],
  [3]]`, empty `int[]`, empty `int[][]`, `char[][]` `[['5', '.']]`, a string with `"`, `\n` and
  "Xin chào", `long` 5, `double` 2 → `2.0` / `float64(2)`, `bool`.
- [ ] **Step 2: RED → implement → GREEN** (`pnpm test lib/content tools/content-verify`), `pnpm
  verify`.
- [ ] **Step 3: Commit** — `feat(content-verify): tests.yaml schema, comparators and literal
  rendering`.

### Task 3.2b: `content:build` core — loading, IDs, `ids.lock`, the generated catalog

The core of `pnpm content:build`: load and validate every file, build the items, keep `ids.lock`,
highlight code, emit `.generated/`, and wire the script into `verify`/`build`/CI. The
cross-references, derived decks, coverage and the full report follow in 3.2c (gate review fix 13).

**Files:**

- Create: `tools/content/{cli,build,load,ids-lock,nfc,emit}.ts` (+ a test each except `cli.ts`),
  `tools/content/__fixtures__/content/<scenario>/…` (small content roots: `ok` — two tracks with a
  noted problem, a pattern lesson, a deck, exercises, a prompt, a derived deck and 8w/10w roadmaps —
  and one folder per failing scenario below), `lib/content/catalog-types.ts`,
  `lib/content/catalog-access.ts` (+ test), `lib/content/catalog.ts`, `content/ids.lock` (header and
  empty sections — PR A has no items), `docs/adr/0010-namespaced-ids-and-ids-lock.md`
- Modify: `package.json` (scripts, decision 7), `lib/content/code-tokens.ts` (`CodeBundle.solutions`
  keyed by `CodeLanguage` from 3.1), `eslint.config.mjs` (`globalIgnores` gains `'.generated/**'`),
  `.prettierignore` (`.generated/` only — `**/*.mdx` came in 3.0), `.github/workflows/ci.yml` (job
  `content-build`)

**Interfaces:**

```ts
// lib/content/catalog-types.ts — types only, client-safe (`import type` from client components)
export type ProblemNote = {
  status: ItemStatus; mdxKey: string /* '<problem id>#note' */; verification: Verification
  languages: CodeLanguage[]; bilingual: { vi: string; en: string }; complexity: { time: string; space: string }
  deepDiveId: string | null   // filled by 3.2c (reverse lookup); null in 3.2b
}
export type ProblemContent = Problem & { slug: string; url: string /* https://leetcode.com/problems/<slug>/ */; note: ProblemNote | null }
export type LessonContent = LessonFrontmatter & { mdxKey: string /* the lesson ID */; sections: string[] }
export type FlashcardContent = Card & {   // every ContentByType[K] extends AuthoredByType[K]
  deckId: string
  lang: { front: 'en' | 'vi'; back: 'en' | 'vi'; hint: 'en' | 'vi' }; derivedFrom: string | null
}
export type ContentByType = { problem: ProblemContent; lesson: LessonContent; flashcard: FlashcardContent;
  exercise: Exercise; prompt: Prompt }
export type CatalogItem<K extends ItemType = ItemType> = { [T in K]: {
  id: string; type: T; trackId: string; localId: string
  topicId: string | null      // problem, lesson: own; card: its deck's; exercise: own; prompt, derived card: null
  week: number | null         // authored week: card (its deck), exercise, prompt; otherwise null (roadmap-dependent)
  status: ItemStatus
  title: string               // problem title | lesson title | card front | exercise/prompt instruction.vi
  source: string              // repo-relative path of the defining file
  content: ContentByType[T]
} }[K]
export type DeckSummary = { id: string; trackId: string; kind: 'vocabulary' | 'recall' | 'derived'; week: number | null;
  topicId: string | null; title: LocalizedText; status: ItemStatus; cardIds: string[] }
/** Placed items only (core + recap entries without a mode); bonus counted separately (fix 21). */
export type WeekCoverage = { week: number; topics: string[]; lessons: { topic: string; lessonId: string | null }[];
  placedProblems: number; notedProblems: number; bonusProblems: number; notedBonus: number;
  coreCards: number; extendedCards: number; exercises: number; prompts: number }
export type Catalog = {
  schemaVersion: 1
  tracks: TrackManifest[]                                       // sorted by id
  roadmaps: Record<string, Record<string, Roadmap>>             // trackId → variant → roadmap (existing files only)
  missingRoadmaps: { trackId: string; variant: string }[]       // decision 4
  decks: Record<string, DeckSummary>
  items: Record<string, CatalogItem>                            // every item, drafts and retired included
  coverage: Record<string, Record<string, WeekCoverage[]>>      // trackId → variant → weeks; {} until 3.2c
}

// lib/content/catalog-access.ts — pure; unit-tested with fixture catalogs
export type MdxLoaders = Readonly<Record<string, () => Promise<{ default: MDXContent }>>>
export type CodeLoaders = Readonly<Record<string, () => Promise<{ default: CodeBundle }>>>
export type CatalogAccess = {
  catalog: Catalog
  getTrack(id: string): TrackManifest | null
  getItem(id: string): CatalogItem | null
  getTrackItems(trackId: string): CatalogItem[]               // sorted by id
  getRoadmap(trackId: string, variant: string): Roadmap | null
  getDeck(id: string): DeckSummary | null
  loadMdx(key: string): Promise<MDXContent | null>            // unknown key → null
  loadCode(itemId: string): Promise<CodeBundle | null>
}
export function createCatalogAccess(catalog: Catalog, loaders: { mdx: MdxLoaders; code: CodeLoaders }): CatalogAccess

// lib/content/catalog.ts — import 'server-only'
export const catalogAccess: CatalogAccess   // createCatalogAccess(CATALOG, { mdx: MDX_LOADERS, code: CODE_LOADERS })
export function getCatalog(): Catalog
export const getTrack, getItem, getTrackItems, getRoadmap, getDeck, loadMdx, loadCode   // bound from catalogAccess

// tools/content/build.ts
export type BuildOptions = { repoRoot: string; contentDir?: string /* <repoRoot>/content */;
  outDir?: string /* <repoRoot>/.generated */; check: boolean }
export type BuildResult = { ok: boolean; issues: ContentIssue[]; catalog: Catalog | null; lock: LockDiff; report: string }
export async function buildContent(options: BuildOptions): Promise<BuildResult>
/** Check mode (fix 19): `--check`, or CI set and not '', '0', 'false' — Vercel builds set CI=1. */
export function isCheckMode(argv: readonly string[], env: NodeJS.ProcessEnv): boolean

// tools/content/ids-lock.ts
export type IdsLock = { published: string[]; retired: string[] }
export function parseLock(text: string): { lock: IdsLock; issues: string[] }   // missing file ≡ ''
export function formatLock(lock: IdsLock): string
export type LockDiff = { added: string[]; removed: string[]; reused: string[]; inBoth: string[]; normalized: boolean }
export function diffLock(lock: IdsLock, contentIds: readonly string[], fileText: string): LockDiff
export function lockIssues(diff: LockDiff, check: boolean): ContentIssue[]

// tools/content/nfc.ts — [RF-3]
export function nfcIssues(file: string, value: unknown, path?: string): ContentIssue[]   // every string in a parsed YAML value
export function nfcSourceIssue(file: string, source: string): ContentIssue | null        // MDX sources
```

**Generated files** (decision 5; every file rewritten each run, `code/` pruned of stale files, keys
sorted so output is deterministic):

- `.generated/catalog.json` — `JSON.stringify(catalog, null, 2)`.
- `.generated/catalog.ts` — `import type { Catalog } from '../lib/content/catalog-types'` +
  `export const CATALOG: Catalog = JSON.parse(<JSON.stringify(JSON.stringify(catalog))>)`.
- `.generated/mdx.ts` — `/// <reference types="mdx" />`, `import type { MDXContent } from
  'mdx/types'`, `export const MDX_LOADERS: Readonly<Record<string, () => Promise<{ default:
  MDXContent }>>> = { '<key>': () => import('../content/tracks/<…>.mdx'), … }` (keys: lesson IDs and
  `<problem ID>#note`; `{}` when empty).
- `.generated/code/<trackId>/<localId>.ts` —
  `import type { CodeBundle } from '../../../lib/content/code-tokens'` +
  `const bundle: CodeBundle = JSON.parse(<string>)` + `export default bundle`, for every problem
  with a note (solutions + the note's fenced blocks) and every lesson with fenced blocks;
  `.generated/code.ts` —
  `export const CODE_LOADERS = { '<item ID>': () => import('./code/<trackId>/<localId>') } satisfies Record<string, () => Promise<{ default: CodeBundle }>>`.

**Pipeline** (`buildContent`; all issues collected before failing; 3.2c adds steps 6–7):

1. **Layout:** `content/` holds only `LICENSE`, `ids.lock`, `tracks/`; a track folder only
   `track.yaml`, `roadmaps/`, `lessons/`, `problems/`, `decks/`, `exercises/`, `prompts/`; a problem
   folder only `problem.yaml` (required), `note.mdx`, `solution.py`, `Solution.java`, `solution.go`,
   `tests.yaml`; file and folder names ASCII `[a-z0-9-.]` (`Solution.java` excepted); **any image
   file** (`.svg`, `.png`, `.webp`, `.jpg`, `.jpeg`, `.gif`) under `content/` → "images live in the
   content-images bucket, not in git (OD3, ADR-0011)".
2. **YAML** (a safe parser, §3.6): `parseDocument(text, { uniqueKeys: true, prettyErrors: true })`
   from `yaml`; parse errors, duplicate keys, aliases/anchors and non-core tags are issues; then the
   file's schema (manifest, roadmap, problem, deck, exercises, prompts, `testsFileSchema` from
   3.5a), issues with `path`.
3. **[RF-3] NFC:** every YAML string and every MDX source is NFC; IDs and slugs are ASCII (3.1).
4. **Items and IDs:** build every item; IDs unique across all tracks; the file/ID rules of the 3.1
   table (folder track = ID track, lesson/deck file name = ID, problem folder = `leetcode` + slug);
   reserved `user:`; card local IDs never start with a reserved prefix; an item type the manifest
   does not list → issue.
5. **MDX:** `parseMdx` →
   `checkMdx(file, tree, context, { imagePathPrefix: '<trackId>/<localId>/' })` (the upload
   convention of OD3) → `mdxFacts`; lesson frontmatter through `lessonFrontmatterSchema`, note
   frontmatter (optional) through `noteFrontmatterSchema`; a note's verification =
   `verificationFor(tests.signature.kind)` (3.5a) — 3.2c makes `tests.yaml` mandatory for a note.
8. **Highlight** (3.3a): solution files and fenced blocks of every MDX; `text` → `plainCode`.
9. **`ids.lock`** (decision 8): `formatLock` output —

   ```text
   # content/ids.lock — every published content ID (platform design §3.3, ADR-0010).
   # IDs are append-only: events reference them forever. `pnpm content:build` adds new IDs.
   # An ID may leave content/** only after you move it from [published] to [retired] by hand.

   [published]
   dsa:lc-0001
   …

   [retired]
   ```

   Issues: removed → "`<id>` is in content/ids.lock but no longer in content/** — restore it, set
   `status: retired`, or move it to [retired] (IDs are append-only, ADR-0010)"; reused → "`<id>` is
   retired in content/ids.lock and cannot be reused"; in both sections; in check mode also added →
   "content/ids.lock is missing N IDs — run `pnpm content:build` and commit content/ids.lock" and
   not normalised → "content/ids.lock is not normalised — run `pnpm content:build`". Locally the
   file is rewritten (added IDs, sorted).
10. **Emit** — generated files only when there are no issues; a one-line summary (`content:build ·
    <n> tracks · <m> items · ids.lock +<k> · <s> s`, replaced by the full report in 3.2c), exit 0;
    otherwise every `formatIssue` line (sorted) and `✗ <n> issues`, exit 1. Usage errors / crashes:
    exit 2.

**Check mode** (fix 19, decision 7): `--check`, or `CI` set to anything but `''`, `'0'`, `'false'`.
Vercel sets `CI=1` during builds (its system environment variables), so a Vercel build never writes
`ids.lock` and fails on a stale one — which CI's `content-build` job has already caught; confirm the
value in a preview build log when the owner next opens one (the 2.2 runbook's check step).

**CI** — `ci.yml` gains (decision 22):

```yaml
  content-build:
    name: content-build
    runs-on: ubuntu-latest
    timeout-minutes: 10
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
      - run: pnpm content:build --check
```

- [ ] **Step 1: Failing tests** (every `buildContent` call writes to a fresh temp `outDir` — fix 7).
  - `ids-lock.test.ts`: missing file → empty lock; local run adds two IDs, sorted, and
    `formatLock` round-trips; check mode with a new ID → the "missing N IDs" issue; a removed ID →
    the removal issue in both modes; a `[retired]` ID present in content → reused; an ID in both
    sections; an unsorted file in check mode → not normalised; derived IDs are included.
  - `nfc.test.ts`: **[RF-3]** a deck `back` given as `'Tiếng Việt'.normalize('NFD')` → an issue
    naming the file and `cards.0.back`; the NFC form → none; an MDX source in NFD → one issue.
  - `load.test.ts`: an unknown folder under a track; a file `Notes.md` in a problem folder;
    `lessons/diagram.png` (image in git); YAML duplicate key; a YAML alias; a lesson file
    `arrays-hashing.mdx` whose ID is `dsa:lesson-arrays`; an item ID of another track; `user:` ID;
    a card `english:ex-oops`; a lesson in a track whose `itemTypes` lacks `lesson`; a lesson image
    under the wrong item prefix (the prefix is passed to `checkMdx`).
  - `emit.test.ts`: the five kinds of files exist; `catalog.ts` contains no object literal (only
    `JSON.parse`); `mdx.ts` starts with the reference line and maps each key to the right relative
    path; a stale code bundle is removed; two runs produce byte-identical output.
  - `build.test.ts`: the `ok` fixture builds with exact item counts; a failing fixture returns
    `ok: false` with sorted issues and writes nothing; `isCheckMode` for `--check`, `CI=1`,
    `CI=true`, `CI=0`, `CI=false`, `CI=''` and unset; **the real repository content builds in check
    mode with `ok === true` and `issues` equal to `[]`** — nothing else is asserted about the real
    content (fix 7), so later content PRs never touch this test.
  - `catalog-access.test.ts`: `getItem`, `getTrackItems` order, `getRoadmap` `null` for a missing
    file, `loadMdx` / `loadCode` `null` for unknown keys and the loader's default export otherwise.
- [ ] **Step 2: RED → implement → GREEN** (`pnpm test tools/content lib/content`).
- [ ] **Step 3: Wire it:** scripts (decision 7), the ESLint and Prettier ignores, `content/ids.lock`
  committed with the header only, the `content-build` job.
- [ ] **Step 4: ADR-0010** — `<track>:<localId>` IDs and the file rules; deterministic derived IDs;
  append-only `ids.lock` with `[retired]`; check mode in CI and on Vercel; reserved `user:`.
- [ ] **Step 5: Verify** `pnpm content:build --check && pnpm verify` (the build now starts with
  content:build). **Commit** — `feat(content): content:build core — loading, IDs, ids.lock and the
  generated catalog`.

### Task 3.3b: MDX pipeline with `@next/mdx` and the content components

**Spike (2026-09-25, `spike-findings.md` §2):** `@next/mdx` 16.3.6 with Turbopack,
plugins as strings, MDX imported from `content/` through a generated map, frontmatter excluded,
per-page `components` override, `pre` text with one trailing newline.

**Files:**

- Create: `mdx-components.tsx` (root), `features/items/mdx/{components.tsx,bind.tsx}` (+
  `bind.test.tsx`),
  `features/items/components/mdx/{section,callout,steps,var-table,complexity,bilingual,term,practice-card,quiz,reveal,solution-tabs,code-pre,external-link,content-image}.tsx`
  (+ a test each), `app/dev/content/{page.tsx,sample-lesson.mdx,sample-note.mdx,fixtures.ts}`,
  `public/dev/content-image-sample.svg` (a monochrome `currentColor` sample for the catalog entry —
  catalog asset, not content), `tools/content/mdx/samples.test.ts`,
  `e2e/content-components.spec.ts`, `docs/ops/content-images.md` (runbook, OD3),
  `tools/guards/next-config.test.ts`, `docs/adr/0011-mdx-safety-and-build-time-highlighting.md`
- Modify: `next.config.ts` (MDX + `images.remotePatterns`), `tools/guards/offline-build.test.ts` (M1
  deferred #20: also scan `next.config.ts`, `postcss.config.mjs`, `mdx-components.tsx`),
  `lib/i18n/vi.ts` (+ `vi.test.ts` keys), `docs/design/COMPONENTS.md`,
  `app/dev/components/registry.tsx`

**Interfaces:**

```ts
// next.config.ts
import createMDX from '@next/mdx'
import { contentImageRemotePatterns } from './tools/content/allowlist'
const withMDX = createMDX({
  extension: /\.mdx$/,
  // Turbopack: plugins by name (functions cannot cross into Rust — Next 16 MDX guide)
  options: { remarkPlugins: ['remark-frontmatter', 'remark-gfm'] },
})
const nextConfig: NextConfig = {
  // …existing M2 config…
  images: { remotePatterns: contentImageRemotePatterns() },   // from tools/content/allowlist.ts (OD3) — the one bucket host
}
export default withMDX(nextConfig)    // no pageExtensions: there are no MDX routes

// mdx-components.tsx (required by @next/mdx with the App Router)
/// <reference types="mdx" />
export function useMDXComponents(): MDXComponents   // returns `mdxComponents` imported from
                                                    // '@/features/items/mdx/components' (not the index: it re-exports the server-only registry from 3.4a)

// features/items/mdx/components.tsx
export const mdxComponents: MDXComponents & { [K in MdxComponentName]: React.ComponentType<never> }
// every allow-listed component (Solution and Practice as `null`-rendering fallbacks — MDX throws on an
// undefined component) + markdown overrides: h2, h3, h4, p, ul, ol, li, a (ExternalLink), img
// (ContentImage), blockquote, code (inline), table/thead/tbody/tr/th/td, hr, strong, em — token classes only

// features/items/mdx/bind.tsx — per page, server-safe
export type PracticeTarget = { title: string; href: string; leetcode: number | null; difficulty: Difficulty | null }
export type MdxBindings = { code: CodeBundle | null; codeLanguage: CodeLanguage;
  resolvePractice: (itemId: string) => PracticeTarget | null }
export function mdxComponentsFor(bindings: MdxBindings): MDXComponents   // { Solution, Practice, pre }
```

**Components** (`features/items/components/mdx/`; vi strings; English learning content in
`lang="en"`; never colour alone):

- `Section({ kind, children })` — `<section data-section={kind} aria-labelledby>` with an `h2` from
  `vi.content.sections[kind] ?? kind` (decision 33): signals "Dấu hiệu nhận biết", analogy "Ví dụ
  đời thường", visual "Minh hoạ", approach "Cách tiếp cận", code "Code", complexity "Độ phức tạp",
  bilingual "Giải thích song ngữ", practice "Luyện tập", quiz "Kiểm tra nhanh".
- `Callout({ tone, title?, children })` — `role="note"`, icon (`Info` / `Lightbulb` /
  `TriangleAlert`) + visible label ("Lưu ý" / "Mẹo" / "Cẩn thận" unless `title`), `bg-primary-soft`
  / `bg-success-soft` / `bg-warning-soft` (cva variants).
- `Steps` / `Step({ title? })` — `<ol>` / `<li>`, numbered.
- `VarTable({ caption?, children })` — a focusable scroll region (`role="region"`, `tabIndex={0}`,
  `aria-label={caption ?? vi.content.varTable}`) around the GFM table, mono cells.
- `Complexity({ time, space })` — `<dl>`: "Thời gian" / "Bộ nhớ", values `font-mono`.
- `Bilingual({ vi, en })` — two labelled paragraphs, "Tiếng Việt" then "English" (`lang="en"`).
- `Term({ vi?, children })` — `<span lang="en">`; when `vi` is set, a following " (vi)" gloss.
- `PracticeCard(target: PracticeTarget)` — a link card: "Bài luyện tập", `#leetcode`, title
  (`lang="en"`), difficulty. The bound `Practice({ problem })` resolves the target and renders it.
- `Quiz`, `Question({ prompt, answer })`, `Choice({ id, children })` — client (`quiz.tsx`, `'use
  client'`). Quiz provides a context; each Question registers `{ answer, selected }` and renders
  `<fieldset><legend>{prompt}</legend>…`; each Choice reads the Question context and renders a
  native radio in a ≥ 44 px label. "Kiểm tra" scores `correct/total`; each question then shows an
  icon + "Chính xác" or "Chưa đúng — đáp án: {id's text}" and the total "Đúng {correct}/{total}" is
  announced in a polite live region; "Làm lại" resets. Prop `onScore?: (score: { correct: number;
  total: number; percent: number }) => void` (percent rounded) — 5.2 sends it as
  `lesson.completed { quizScore }` (§3.5).
- `Reveal({ label?, children })` — client; a button (`aria-expanded`, `aria-controls`) "Xem" /
  `label`, content hidden until opened.
- `SolutionTabs({ solutions, defaultLanguage, onReveal? })` — client; hidden behind "Xem lời giải"
  (DESIGN_SYSTEM §9); then ui `Tabs` Python / Java / Go (only the languages present, in that order;
  initial tab = `defaultLanguage` when present, else the first), each a `CodeBlock` labelled "Lời
  giải {Python}"; `onReveal` fires once (5.2 uses it for the "Cần gợi ý" nudge).
- `CodePre` — the bound `pre`: reads `language-<lang>` and the text from its `code` child, looks up
  `code.blocks[codeBlockKey(lang, text)]`, falls back to `plainCode` (never crashes).
- `ExternalLink` — `a` override: `https:` only (the check guarantees it),
  `target="_blank" rel="noopener noreferrer"`, an `ExternalLink` icon (`aria-hidden`) and visually
  hidden "(mở trong tab mới)".
- `ContentImage({ src, alt, title })` — the `img` override (OD3; **rendering decision:** Markdown
  `![alt](url "WIDTHxHEIGHT")`, the size in the title — the safety check guarantees the URL, the
  alt text and the title): `next/image` with `width` / `height` parsed from the title, `alt`,
  `className="h-auto max-w-full rounded-md"`, lazy by default; raster images (`png`, `webp`,
  `jpg`) go through Next's optimiser, allowed by `images.remotePatterns` from the same base URL;
  `svg` is `unoptimized` (Next does not optimise SVG). No `sizes` (fixed-size images need none).
  An unparsable title (never reaches production — the check rejects it) renders nothing.

**`docs/ops/content-images.md`** (runbook, OD3, no secrets or keys): 1. **the bucket already
exists** — `content-images` in the production Supabase project, created by the owner in the
dashboard on 2026-09-25: public read, 1 MB per file, MIME types `image/svg+xml`, `image/png`,
`image/webp`, `image/jpeg`; no migration creates it (the local stack runs without the storage
service) and every environment (local, previews, staging, production) reads this one bucket, so
content URLs never change; 2. **upload via the dashboard** only (owner; the v1.1 bot never uploads
images), naming `<track>/<item-local-id>/<name>.<ext>` (e.g. `dsa/lesson-two-pointers/walk.svg`),
extensions `svg`, `png`, `webp`, `jpg`, lower-case names `[a-z0-9-_.]`, SVGs exported without
scripts; 3. licence: images are content, CC BY-NC-SA 4.0 like `content/**` (say so in the PR that
references them); 4. the base URL
`https://oelgwbxukbgaqqvociwi.supabase.co/storage/v1/object/public/content-images/` is committed as
`CONTENT_IMAGE_BASE_URL` in `tools/content/allowlist.ts` and also feeds `next.config.ts`
`images.remotePatterns`; changing buckets means a PR changing that one constant (and every image
URL); 5. reference images in MDX as
`![alt text](<base><track>/<local-id>/<name>.<ext> "WIDTHxHEIGHT")` — upload first, then open the
content PR (the build never fetches the image, so a missing upload only shows as a broken image on
the preview).

**`/dev/content`** (`requireDevAccess()` first, like the other `/dev` pages) renders
`sample-lesson.mdx` and `sample-note.mdx` — imported directly, not through the catalog, so PR A
proves the MDX build without content — with `mdxComponentsFor` bound to `fixtures.ts` (a CodeBundle
with Python/Java/Go solutions and the lesson's fenced block, a practice resolver). The samples use
every allow-listed component except images (e2e stays offline — no request to the bucket;
`ContentImage` is covered by its unit test and a catalog entry using
`public/dev/content-image-sample.svg`); `samples.test.ts`
runs 3.2a's `checkMdx` on them (lesson and note contexts) so they stay valid.

`vi.content`: the section labels above; `varTable` "Bảng biến"; `complexity { title: 'Độ phức
tạp', time: 'Thời gian', space: 'Bộ nhớ' }`; `bilingual { vi: 'Tiếng Việt', en: 'English' }`;
`callout { info: 'Lưu ý', tip: 'Mẹo', warning: 'Cẩn thận' }`; `quiz { check: 'Kiểm tra', retry:
'Làm lại', correct: 'Chính xác', incorrect: 'Chưa đúng — đáp án: {answer}', score: 'Đúng
{correct}/{total}' }`; `reveal { show: 'Xem', hide: 'Ẩn' }`; `solution { show: 'Xem lời giải', hide:
'Ẩn lời giải', tabs: 'Ngôn ngữ lời giải', label: 'Lời giải {language}' }`; `practice { title: 'Bài
luyện tập' }`; `newTab: '(mở trong tab mới)'`.

- [ ] **Step 1: Failing tests** — `section.test.tsx` (h2 from the kind, fallback, labelled region);
  `term.test.tsx` (**`<Term>` sets `lang="en"`**, the gloss); `quiz.test.tsx` (**quiz score**: 2 of
  3 correct → "Đúng 2/3" in a live region and `onScore({ correct: 2, total: 3, percent: 67 })`;
  per-question icon + text; retry resets; arrow keys move within a question; a question without a
  selection counts as wrong); `solution-tabs.test.tsx` (no code in the DOM before "Xem lời giải";
  the default tab is the viewer's language; only present languages; `onReveal` once);
  `code-pre.test.tsx` (a known block → token classes; unknown → plain text; the trailing newline
  does not change the key); `callout`, `reveal` (`aria-expanded`), `var-table` (focusable region),
  `bilingual`, `complexity`, `practice-card`, `external-link` tests; `bind.test.tsx` (`Practice`
  with an unknown ID renders nothing; `Solution` with `code: null` renders nothing);
  `content-image.test.tsx` (`title "640x360"` → an image with `width` 640, `height` 360 and the alt
  text; an `.svg` source is `unoptimized`, a `.png` is not; a bad title renders nothing);
  `next-config.test.ts` (tools/guards — `images.remotePatterns` equals
  `contentImageRemotePatterns()`: one pattern, host `oelgwbxukbgaqqvociwi.supabase.co`, pathname
  `/storage/v1/object/public/content-images/**`); `samples.test.ts`;
  `offline-build.test.ts` scans the three root files.
- [ ] **Step 2: Failing e2e** — `e2e/content-components.spec.ts` on `/dev/content` (light and dark,
  desktop and mobile, axe): **lesson renders sections in order** (`[data-section]` kinds equal the
  sample's order); `[lang="en"]` on the Term; the quiz flow shows the score; "Xem lời giải" reveals
  tabs and switching to Java shows `class Solution`; the VarTable region is keyboard-focusable.
- [ ] **Step 3: RED → implement → GREEN**; catalog entries for every client-safe component in
  `features/items/components/mdx/` (all of them; sample props), `COMPONENTS.md` entries.
- [ ] **Step 4: ADR-0011** — `@next/mdx` with Turbopack (plugins as strings), MDX imported through a
  generated import map, strict MDX safety check in `content:build` on the MDX syntax tree
  (`@mdx-js/mdx`, OD1; allowlist in code, literal attributes, `https:` links), highlighting at build
  time with shiki → token classes (decisions 13, 14), zero client JS for highlighting; **images
  (owner decision OD3):** remote, in one allow-listed Supabase Storage bucket (`content-images`,
  production project, public read, owner-only writes), not in git — one constant feeds the safety
  check and `images.remotePatterns`; the bucket was created by the owner on 2026-09-25 (1 MB per
  file; SVG, PNG, WebP, JPEG); consequences: images are not versioned with content PRs, reviewers
  see only URLs, the bot cannot add images, a missing upload is not caught by the offline build, an
  empty base URL rejects every image.
- [ ] **Step 5: Verify** `pnpm verify && pnpm test:e2e`. **Commit** — `feat(content): MDX pipeline
  with @next/mdx and the allow-listed content components`.

### Task 3.5b: `content-verify` M3a, runtime part — runners, orchestrator, sandbox, CI workflow

**Spike (2026-09-25):** a Node orchestrator ran group-anagrams (`string[] → string[][]`),
valid-sudoku (`char[][] → bool`) and an infinite loop in all three languages: Python case 155–280
ms; `javac --release 21` 0.5–2.2 s per problem; `java` 170–430 ms per case; `go build` 0.25–6.8 s
(cold cache) per problem; Go run 5 ms; the 1 500 ms timeout killed all three loops at 1.50 s.
`go vet` accepts `package main` without `func main`; `go build` needs a stub. W1–W3 (24 `function`
problems × ~6 cases + 3 compile-only) ≈ 90 s sequential.

**Files:**

- Create: `tools/content-verify/{cli,discover,orchestrator,sandbox,toolchains,report}.ts` (+ a test
  each except `cli.ts` and `toolchains.ts`), `tools/content-verify/integration.test.ts`,
  `tools/content-verify/runners/{python,java,go}.ts` (+ `runners/harness.test.ts`),
  `tools/content-verify/runners/python/{runner.py,check.py}`,
  `tools/content-verify/runners/java/Json.java`, `tools/content-verify/runners/go/normalize.go`,
  `tools/content-verify/__fixtures__/tracks/demo/problems/<seven folders>/…` and
  `__fixtures__/expected.json`, `.github/workflows/content-verify.yml`,
  `docs/adr/0012-sandboxed-solution-verification.md`
- Modify: `CLAUDE.md` (Commands: `content:verify`; local toolchains), `README.md` (Development:
  Python ≥ 3.11, JDK ≥ 21, Go ≥ 1.22). The `content:verify` script was added in 3.0.

**Interfaces** (3.1 is in by now, so the runner language is the shared `CodeLanguage` — gate review
fix 22; the pure pieces come from 3.5a):

```ts
// tools/content-verify/discover.ts
export type ProblemUnderTest = { id: string /* 'dsa:lc-0001' */; dir: string; tests: TestsFile; languages: CodeLanguage[] }
export function discoverProblems(tracksRoot: string, filter?: { ids?: readonly string[]; lang?: CodeLanguage }):
  { problems: ProblemUnderTest[]; issues: string[] }   // every problems/*/tests.yaml; languages = solution files present

// tools/content-verify/sandbox.ts
export type Sandbox = { user: string } | null
export type Command = { cmd: string; args: string[]; cwd: string; stdin?: string; env?: Record<string, string>; timeoutMs: number }
export type Spawn = { cmd: string; args: string[]; env: Record<string, string> }
export function wrapCommand(command: Command, sandbox: Sandbox, tools: { timeout: string; sudo: string }): Spawn
// no sandbox → cmd/args unchanged, env = { PATH, HOME, ...command.env }
// sandbox → EVERY toolchain command, compile included (fix 6):
//   sudo -n -u <user> -- <timeout> --kill-after=1 <ceil(ms/1000)+1>s env -i PATH=<tool dirs> HOME=/tmp <…command.env> <abs cmd> <args>
//   (sudo cannot relay SIGKILL, so the inner `timeout` is the second fence; the Node timer is the first)
export function killSandboxProcesses(sandbox: Sandbox): void   // sudo -n pkill -KILL -u <user> || true — after every case
export function assertSandboxPolicy(env: NodeJS.ProcessEnv): Sandbox
// GITHUB_ACTIONS === 'true' and no CONTENT_VERIFY_SANDBOX_USER → throws (the CLI exits 2: fail closed, fix 6)

// tools/content-verify/runners/{python,java,go}.ts
export type Harness = {
  lang: CodeLanguage
  /** Writes the harness into workDir (copies the solution and the static runner files, generates code). */
  prepare(problem: ProblemUnderTest, workDir: string): { compile: Command[]; runCase(index: number): Command; compileOnly: Command[] }
}
export const pythonHarness: Harness, javaHarness: Harness, goHarness: Harness

// tools/content-verify/orchestrator.ts
export type CaseResult = { name: string; status: 'pass' | 'fail' | 'timeout' | 'error'; ms: number; detail?: string }
export type LanguageResult = { lang: CodeLanguage; status: 'tested' | 'compile-only' | 'failed'; cases: CaseResult[]; detail?: string }
export type ProblemResult = { id: string; verification: Verification; languages: LanguageResult[]; ok: boolean }
export type ToolPaths = { python: string; javac: string; java: string; go: string; timeout: string; sudo: string }
export async function verifyProblems(problems: readonly ProblemUnderTest[], options: {
  jobs: number; workRoot: string; sandbox: Sandbox; tools: ToolPaths }): Promise<ProblemResult[]>

// tools/content-verify/report.ts
export function formatReport(results: readonly ProblemResult[], toolchains: string): string
```

**Runners** (decision 19; every generated or copied file lives in the work directory):

- **Python** — `runner.py` and `check.py` are **copied into the work directory** (fix 6) with the
  solution. `runner.py` reads `{"file", "method", "args", "output": null | <arg index>}` from stdin,
  loads the solution with `importlib.util.spec_from_file_location`, calls
  `Solution().<method>(*args)`, prints JSON of the result (or of `args[output]` after the call, for
  in-place). `check.py <file> <json signature>` compiles with `compile(src, path, 'exec')` (no
  `__pycache__`) and checks with `ast` that `class Solution` has the method (function) or `class
  <className>` has every method (design class); prints `{"ok": …, "reason": …}`.
- **Java** — generated `Main.java`: `switch (Integer.parseInt(args[0]))`, one `case` per test with
  literal arguments (`javaLiteral`, 3.5a), `System.out.print(Json.write(<call or arg>))`; static
  `Json.java` serialises `null`, `String`, `Character` (as a one-char string), boxed numbers and
  booleans, arrays (reflection) and `Iterable`, `NaN`/infinity → `null`. Compile once: `javac
  --release 21 -proc:none -encoding UTF-8 -d out Solution.java Json.java Main.java` (60 s;
  `-proc:none` — no annotation processors run during compilation, fix 6). Run: `java -Xss64m
  -Xmx512m -cp out Main <i>`. Compile-only: `javac` + a regex check for `class <Name>` and each
  `<method>(`.
- **Go** — generated `main_harness.go` (`package main`, `switch i`, literal arguments via
  `goLiteral`, then `json.Marshal(normalize(out))`) plus the copied static `normalize.go`:
  `normalize(v any) any` walks the value with `reflect`, turns **nil slices at any depth into empty
  slices** (fix 8: `json.Marshal` prints a nil slice as `null`) and `byte` / `[]byte` values from a
  `char` return type into strings (it would base64-encode them); `go.mod` = `module
  verify\n\ngo 1.22\n`; env `CGO_ENABLED=0` (fix 6), `GOPROXY=off`, `GOTOOLCHAIN=local`,
  `GOFLAGS=-mod=mod`, `GOCACHE` and `GOPATH` under the work root. Build once: `go build -o bin .`
  (120 s). Run: `./bin <i>`. Compile-only: add `main_stub.go` (`func main() {}`) unless the file
  declares `main`, then `go vet .` + a regex check for `func <name>(` (function) or `type
  <ClassName> struct`, `func Constructor(` and each capitalised method.
- The work root is a `mkdtemp` under the OS temp dir, one sub-directory per problem × language;
  in sandbox mode the orchestrator runs `sudo -n chown -R <user> <dir>` after writing the files, so
  compilation (as the sandbox user) can write `out/`, `bin` and the Go caches. Nothing is ever
  written into `content/`.

**Orchestrator behaviour:** discover → for each problem × language: if the kind is supported →
compile (a compile failure = `failed`, detail = the first 20 lines of stderr), run every case with
the Node-enforced `timeoutMs` (`spawn` + timer, `SIGTERM` then `SIGKILL` after 1 s), then
`killSandboxProcesses` (fix 6: no stray process survives a case), parse stdout as JSON (bad JSON =
`error`), `compare` (3.5a); else → `compileOnly` commands → `compile-only` or `failed`. Jobs:
locally `Math.max(1, Math.floor(os.availableParallelism() / 2))` units in parallel; **in sandbox
mode one unit at a time** (the per-case `pkill -u` must never hit another running case; ~90 s for
W1–W3 — M3b may add one sandbox user per worker when the content grows). Exit code 1 when any
problem fails, else 0. CLI:
`content:verify [--problem <id>]… [--lang <l>] [--jobs <n>] [--root <tracks dir>]`; the sandbox is
`assertSandboxPolicy(process.env)` (exit 2 on GitHub Actions without a sandbox user); toolchain
versions and absolute paths are resolved first (`command -v`, so `sudo`'s `secure_path` never
matters); a missing toolchain is an error naming the minimum version.

**Report** (the last line is what CI surfaces, §3.7):

```text
content:verify · python 3.13.7 · javac 23.0.2 · go 1.26.5 · 1 job (sandbox cvsandbox)
  dsa:lc-0001  tested        python 6/6 · java 6/6 · go 6/6       1.9 s
  dsa:lc-0155  compile-only  python ✓ · java ✓ · go ✓  (design-class runs in M3c)
  dsa:lc-0049  FAILED        go: case 'anagram-groups' expected [["a"]] got [] (0.2 s)
tested 24 · compile-only 3 · failed 1
```

**Workflow** `.github/workflows/content-verify.yml` (§3.7: a required check that always runs, the
path check inside the job; every step after the check carries the `if:`, fix 17):

```yaml
name: content-verify
on:
  pull_request:
  push:
    branches: [main]
permissions:
  contents: read
concurrency:
  group: content-verify-${{ github.ref }}
  cancel-in-progress: ${{ github.event_name == 'pull_request' }}
jobs:
  content-verify:
    name: content-verify
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v7
        with:
          persist-credentials: false
          fetch-depth: 0
      - id: paths
        name: Content or harness changed? (in-job check keeps this required check reporting)
        env:
          BASE: ${{ github.event_name == 'pull_request' && github.event.pull_request.base.sha || github.event.before }}
        run: |
          if [ -z "$BASE" ] || [ "$BASE" = "0000000000000000000000000000000000000000" ] \
             || ! git cat-file -e "$BASE^{commit}" 2>/dev/null \
             || ! git diff --quiet "$BASE" HEAD -- content tools/content-verify lib/content/schemas/tests.ts \
                  lib/content/verification.ts .github/workflows/content-verify.yml; then
            echo "run=true" >> "$GITHUB_OUTPUT"
          else
            echo "run=false" >> "$GITHUB_OUTPUT"; echo "No content or harness change — nothing to verify."
          fi
      - if: steps.paths.outputs.run == 'true'
        uses: pnpm/action-setup@v6
      - if: steps.paths.outputs.run == 'true'
        uses: actions/setup-node@v7
        with: { node-version-file: .nvmrc, cache: pnpm }
      - if: steps.paths.outputs.run == 'true'
        uses: actions/setup-python@v7
        with: { python-version: '3.13' }
      - if: steps.paths.outputs.run == 'true'
        uses: actions/setup-java@v6
        with: { distribution: temurin, java-version: '25' }
      - if: steps.paths.outputs.run == 'true'
        uses: actions/setup-go@v7
        with: { go-version: '1.26', cache: false }
      - if: steps.paths.outputs.run == 'true'
        run: pnpm install --frozen-lockfile
      - if: steps.paths.outputs.run == 'true'
        name: Sandbox user without network (OD2)
        run: |
          sudo useradd --system --no-create-home --shell /usr/sbin/nologin cvsandbox
          sudo iptables -I OUTPUT -m owner --uid-owner cvsandbox -j REJECT
          sudo ip6tables -I OUTPUT -m owner --uid-owner cvsandbox -j REJECT
      - if: steps.paths.outputs.run == 'true'
        name: Sandbox self-test (fail closed)
        run: |
          PY="$(command -v python3)"
          sudo -n -u cvsandbox -- "$PY" -c 'print(1)'                     # the sandbox user can run the toolchain
          curl -sSf -o /dev/null --max-time 10 https://example.com         # the runner itself has network
          if sudo -n -u cvsandbox -- "$PY" -c \
             "import urllib.request; urllib.request.urlopen('https://example.com', timeout=5)"; then
            echo "::error::the sandbox user reached the network"; exit 1
          fi
      - if: steps.paths.outputs.run == 'true'
        name: Harness self-test on fixtures
        run: pnpm vitest run tools/content-verify/integration.test.ts
        env: { CONTENT_VERIFY_INTEGRATION: '1', CONTENT_VERIFY_SANDBOX_USER: cvsandbox }
      - if: steps.paths.outputs.run == 'true'
        run: pnpm content:verify
        env: { CONTENT_VERIFY_SANDBOX_USER: cvsandbox }
```

**Fixtures** (`__fixtures__/tracks/demo/problems/`, IDs `demo:lc-9001`… — never in `content/`):
`lc-9001-sum-pass` (function `sumList(nums: int[]) → int`, all languages correct, compare exact),
`lc-9002-wrong-go` (Go returns a wrong value for one case), `lc-9003-timeout` (Python loops
forever), `lc-9004-design` (`design-class` MinStack-like, compile-only in all three),
`lc-9005-compile-error` (Java does not compile), `lc-9006-in-place` (`reverse(nums: int[]) → void`,
`compare: { kind: in-place, arg: nums }`), `lc-9007-empty-result` (`evens(nums: int[]) → int[]`;
the Go solution returns a nil slice for a case expecting `[]` — fix 8); `expected.json` lists each
problem's per-language status and failing case names.

- [ ] **Step 1: Failing tests (pure, always run).** `harness.test.ts`: the generated Java `Main` and
  Go `main_harness.go` for the two-sum signature match inline snapshots; the Python harness copies
  `runner.py` and `check.py` into the work dir; `javac` gets `-proc:none`; the Go env has
  `CGO_ENABLED=0`. `sandbox.test.ts`: no sandbox → unchanged; a sandbox → the exact `sudo … timeout
  … env -i …` argv for a **run and a compile** command; `killSandboxProcesses(null)` does nothing;
  `assertSandboxPolicy({ GITHUB_ACTIONS: 'true' })` throws, with `CONTENT_VERIFY_SANDBOX_USER` →
  `{ user }`, locally → `null`. `report.test.ts`: fixed results → the exact text above.
  `discover.test.ts`: the fixture root yields seven problems with the solution languages present.
  `orchestrator.test.ts` (a fake spawn): sandbox mode runs one unit at a time and calls
  `killSandboxProcesses` after every case.
- [ ] **Step 2: Failing integration test** — `integration.test.ts`
  (`describe.runIf(process.env.CONTENT_VERIFY_INTEGRATION === '1')`) runs `verifyProblems` on the
  fixtures and matches `expected.json`: **timeout** reported for `lc-9003` python within
  `timeoutMs` + 1.5 s; **`function` signatures pass** (`lc-9001`, `lc-9006`, `lc-9007` tested in
  all three — the Go nil slice compares equal to `[]`); **unsupported kinds → `compile-only`**
  (`lc-9004`, with the signature check passing); `lc-9002` go `failed` naming the case; `lc-9005`
  java `failed` with a stderr excerpt.
- [ ] **Step 3: RED → implement → GREEN** — `pnpm test tools/content-verify`, then
  `CONTENT_VERIFY_INTEGRATION=1 pnpm vitest run tools/content-verify/integration.test.ts`
  (toolchains are installed locally), then `pnpm content:verify` on the real content (no
  `tests.yaml` yet → `tested 0 · compile-only 0 · failed 0`, exit 0).
- [ ] **Step 4: ADR-0012** — the owner decision OD2: a sandboxed CI job (no secrets, read-only
  token; solution **and** compile processes run as a dedicated Linux user whose network, loopback
  included, is rejected by an iptables owner match; `CGO_ENABLED=0`, `javac -proc:none`, stray
  processes killed after every case; a fail-closed self-test; the CLI refuses to run unsandboxed on
  GitHub Actions) **instead of the container named in §3.7** — the deviation and why (no image
  pulls, the same orchestrator locally and in CI; local runs on a developer's machine are
  unsandboxed); a required check that always runs (in-job path check); phased harness (M3a
  `function`; M3b lists, trees, graph nodes, random lists; M3c design classes, before week 4, §0);
  compile-only + signature-check fallback; validators outside `content/**`; verification derived
  from the supported kinds (decision 21).
- [ ] **Step 5: Verify** `pnpm verify`; `CLAUDE.md` Commands: "`pnpm content:verify` — run every
  solution against its `tests.yaml` (Python ≥ 3.11, JDK ≥ 21, Go ≥ 1.22)"; README Development
  lists the toolchains. **Commit** — `feat(content-verify): runners, orchestrator and the sandboxed
  CI job`. After the controller cherry-picks this task it pushes the pipeline branch as a **draft
  PR** so `content-verify` (and the sandbox self-test) runs on GitHub early (fix 6).

### Task 3.2c: `content:build` cross-checks — cross-references, derived decks, coverage, report

**Files:**

- Create: `tools/content/{crossref,derived,coverage,report}.ts` (+ a test each), more fixture
  scenarios under `tools/content/__fixtures__/content/` (one per cross-reference row below; the `ok`
  fixture gains a deep-dive lesson)
- Modify: `tools/content/build.ts` (steps 6–7 and the report), `tools/content/cli.ts` (prints the
  report), `tools/content/build.test.ts` (the `ok` fixture's derived cards, `deepDiveId` and
  coverage), `CLAUDE.md` (Commands and a Content section), `README.md` (Development)

**Interfaces:**

```ts
// tools/content/crossref.ts
export type CrossrefInput = { tracks: readonly TrackManifest[]; roadmaps: Catalog['roadmaps'];
  roadmapFiles: readonly { trackId: string; file: string; roadmap: Roadmap }[];
  items: Readonly<Record<string, CatalogItem>>; decks: Readonly<Record<string, DeckSummary>>;
  facts: ReadonlyMap<string, MdxFacts>;                         // by item ID (lessons) and '<id>#note'
  problemFiles: ReadonlyMap<string, { solutions: CodeLanguage[]; tests: TestsFile | null }> }
export function crossrefIssues(input: CrossrefInput): ContentIssue[]
export function missingRoadmaps(tracks: readonly TrackManifest[], roadmaps: Catalog['roadmaps']): Catalog['missingRoadmaps']
export function deepDiveIndex(items: Readonly<Record<string, CatalogItem>>, tracks: readonly TrackManifest[]): Map<string, string>
// problem ID → the non-retired lesson whose format requires `about` and whose `about` is that problem

// tools/content/derived.ts
export function derivedCards(input: { tracks: readonly TrackManifest[]; items: Readonly<Record<string, CatalogItem>>;
  lockedIds: ReadonlySet<string> }): { cards: CatalogItem<'flashcard'>[]; decks: DeckSummary[] }

// tools/content/coverage.ts (fix 21)
export function weekCoverage(track: TrackManifest, roadmap: Roadmap, items: Readonly<Record<string, CatalogItem>>,
  decks: Readonly<Record<string, DeckSummary>>): WeekCoverage[]

// tools/content/report.ts
export function formatReport(catalog: Catalog, lock: LockDiff, ms: number): string
```

**Pipeline additions** (`buildContent`):

6. **Cross-references** (`crossref.ts`):

   | Check | Issue |
   | --- | --- |
   | roadmap file whose `id` ≠ file name, or not listed in the manifest | yes |
   | manifest roadmap without a file | coverage (`missingRoadmaps`) — decision 4 |
   | roadmap `core` / `bonus` / `recap` item missing, of another track, or not a problem | yes |
   | roadmap `decks` entry missing, of another track, or not a deck | yes |
   | week topic not in the manifest's `topics` | yes |
   | core item's topic ∉ its week's `topics` | yes |
   | bonus / recap item whose topic is not in this or an earlier week's topics **and** whose `requires` are not all there either (so tries bonus problems may follow the trees week) | yes |
   | recap entry with a mode whose item is not placed in the same or an earlier week | yes |
   | topic whose `requires` are not introduced in an earlier week or earlier in the same week's list (§3.6) | yes |
   | lesson `format` not in `lessonFormats`; sections ≠ the format's list, in order | yes |
   | lesson missing a `requires` field, or carrying one the format does not use | yes |
   | anchor / practice / about not a problem of the same track | yes |
   | rules `anchor!=practice`, `practice!=about`, `same-topic`, `one-per-topic` (non-retired, per topic), `max-1-per-about` | yes |
   | `<Practice problem>` ≠ the lesson's `practice` | yes |
   | lesson / problem / deck / exercise topic not in the manifest | yes |
   | problem with `note.mdx`: a solution file per `codeLanguages` + `tests.yaml` valid with the §3.5 minimum | yes |
   | exercise / prompt `week` beyond the longest existing roadmap of the track | yes |
   | derived deck source track missing, or not listing `problem` in its `itemTypes` (zero problems is fine — PR A) | yes |

   The **deep-dive reverse lookup** (§3.5) fills `note.deepDiveId` from `deepDiveIndex`.
7. **Derived decks** (`derived.ts`, §3.4): for each manifest `decks[]` entry, one card per source
   problem whose note is `active` and whose problem is not retired: `front` / `back` / `hint` from
   the map (templates filled from the problem; `note.bilingual.*` from the note's `<Bilingual>`),
   `tier: 'derived'`, `lang { front: en, back / hint: en for `note.bilingual.en`, vi for
   `note.bilingual.vi` }`, `status` = the problem's (draft stays draft), `derivedFrom` = the problem
   ID, ID `derivedCardId(...)`; one `DeckSummary` of kind `derived` per entry. An ID in the lock
   whose source no longer qualifies → a card with `status: 'retired'` (decision 8).
   **Coverage** (`coverage.ts`, fix 21) per track × existing roadmap × week: topic lessons (formats
   without `about`) per week topic or `null`; `placedProblems` / `notedProblems` count only placed
   items (core + recap entries without a mode); `bonusProblems` / `notedBonus` separately; core and
   extended cards of the week's decks; active exercises and prompts whose `week` is the week.

**Report** (`formatReport`; columns shown only for item types the track lists; numbers below are
illustrative — the exact text is pinned by `report.test.ts` on the `ok` fixture):

```text
content:build · 2 tracks · 360 items · ids.lock +360 · 0.9 s

Items            active  draft  retired
  problem           114      0        0
  lesson              5      0        0
  flashcard         216      0        0
  exercise           18      0        0
  prompt              4      0        0

Verification: tested 24 · compile-only 3 · no note 87

dsa · active · Cấu trúc dữ liệu & Giải thuật
  8w   8 weeks · week sizes 8 8 7 11 7 7 8 8
  10w  10 weeks · week sizes 8 8 8 8 8 7 8 8 8 8
  10w coverage  week  notes (placed)  bonus notes  lessons
                1     9/9             0/0          arrays-hashing
                4     0/10            0/1          — (linked-list missing)
english · active · Tiếng Anh cho môi trường IT
  10w  10 weeks · week sizes 12 16 14 14 12 13 16 14 11 13
  10w coverage  week  core  extended  exercises  prompts
                1     12    18        6          1
Missing roadmaps: none
Draft tracks: none
Draft items: none
```

- [ ] **Step 1: Failing tests.** `crossref.test.ts`: one fixture per row of the table (each yields
  exactly its issue), and the `ok` fixture → none; a tries bonus problem in the trees week passes.
  `derived.test.ts`: a noted active problem → one card `english:explaining-code:dsa:lc-0001` with
  front "Explain the optimal approach for Two Sum in English.", back = `note.bilingual.en`, hint =
  `note.bilingual.vi`, `tier: derived`; a draft note → no card; a draft problem with an active note
  → a draft card; a locked derived ID whose note became draft → a retired card.
  `coverage.test.ts`: a week with 8 core, 1 recap-introduced and 2 bonus problems, 3 of the placed
  ones noted and 1 bonus noted → `placedProblems 9, notedProblems 3, bonusProblems 2, notedBonus 1`;
  a recap entry with a mode is not counted; a week topic without a lesson → `lessonId: null`.
  `report.test.ts`: the `ok` fixture catalog → the exact report text (inline snapshot).
  `build.test.ts`: the `ok` fixture's `deepDiveId`, derived cards and coverage.
- [ ] **Step 2: RED → implement → GREEN** (`pnpm test tools/content`).
- [ ] **Step 3: Docs.** `CLAUDE.md` — Commands: "`pnpm content:build` — validate `content/**`,
  update `content/ids.lock`, write `.generated/` (runs first in `verify`, `build`, `dev`,
  `test:e2e`)"; the "Later milestones add …" line drops `content:build` and `content:verify`; a
  **Content** section: content is data; never copy LeetCode statements; IDs are append-only
  (`ids.lock`); MDX may use only the components in `tools/content/allowlist.ts`; images come only
  from the `content-images` bucket (`docs/ops/content-images.md`); generated code lives in
  `.generated/` (never edited, never committed). `README.md` Development: `pnpm content:build`.
- [ ] **Step 4: Verify** `pnpm content:build --check && pnpm verify`. **Commit** —
  `feat(content): content:build cross-references, derived decks, coverage and report`.

### Task 3.4a: Item-type registry, a page and a row per item type

**Files:**

- Create: `features/items/{types.ts,registry.ts,render.tsx,href.ts,narrow.ts,index.ts}` (+
  `registry.test.ts`, `render.test.tsx`, `href.test.ts`, `narrow.test.ts`),
  `features/items/{problem,lesson,flashcard,exercise,prompt}/{Page.tsx,Row.tsx}` (+ a test per
  file),
  `features/items/components/{difficulty-badge,verification-badge,item-status-badge,flashcard-view,fill-blank-exercise,self-graded-exercise,rubric-list}.tsx`
  (+ tests), `components/patterns/link-row.tsx` (+ test), `app/dev/items/{page.tsx,fixtures.ts}`,
  `tools/guards/item-type-branching.ts` (+ test), `e2e/items.spec.ts`,
  `docs/adr/0009-tracks-are-data-item-types-are-code.md`
- Modify: `lib/content/tracks.ts` (+ `tracks.test.ts`, `track-options.test.ts`) — manifests from
  the catalog (decision 6); `next.config.ts` (drop the `track.yaml` tracing include — `yaml` itself
  moved to devDependencies in 3.0, fix 10); `tools/guards/component-catalog.test.ts`;
  `lib/i18n/vi.ts` (+ test);
  `docs/design/COMPONENTS.md`; `app/dev/components/registry.tsx`

**Interfaces:**

```ts
// features/items/types.ts
export type ItemStateView = { status: 'weak' | 'ok' | 'strong' | 'mastered' | 'skipped'; level: number; dueOn: string | null }
export type ItemViewer = { codeLanguage: CodeLanguage; isAdmin: boolean }
export type ItemLink = { id: string; type: ItemType; title: string; href: string; leetcode: number | null; difficulty: Difficulty | null }
export type ItemPageData = { Body: MDXContent | null; code: CodeBundle | null }
export type RecordResultAction = (input: { itemId: string; result: string; mode?: Mode }) => Promise<{ ok: boolean; message: string }>
export type ItemPageProps<K extends ItemType> = {
  item: CatalogItem<K>
  state: ItemStateView | null                      // null until M4/M5 (decision 25)
  context: { planBlockId?: string; mode?: Mode }
  viewer: ItemViewer
  data: ItemPageData                               // preloaded by the route through `load`
  resolveItem: (id: string) => ItemLink | null     // practice, anchor, deep-dive, recap links
  recordResult?: RecordResultAction                // 5.2
}
export type ItemRowProps<K extends ItemType> = { item: CatalogItem<K>; state: ItemStateView | null; mode?: Mode; href: string; showStatus?: boolean }
export type ItemTypeDef<K extends ItemType> = ItemTypeCore<AuthoredByType[K]> & {
  Page: React.ComponentType<ItemPageProps<K>>
  Row: React.ComponentType<ItemRowProps<K>>
  load(item: CatalogItem<K>): Promise<ItemPageData>   // problem: note MDX + code; lesson: MDX + code; others: { null, null }
}

// features/items/registry.ts — server-only (load() uses lib/content/catalog)
export const ITEM_REGISTRY: { readonly [K in ItemType]: ItemTypeDef<K> }
export function getItemType<K extends ItemType>(type: K): ItemTypeDef<K>

// features/items/render.tsx — server-only; how pages turn catalog items into registry elements (fix 5)
export function renderItemRow(item: CatalogItem, props: { state?: ItemStateView | null; mode?: Mode;
  showStatus?: boolean }): React.ReactNode          // <Row item state href={itemHref(item)} …/> of getItemType(item.type)
export async function renderItemPage(item: CatalogItem, props: Omit<ItemPageProps<ItemType>, 'item' | 'data'>):
  Promise<React.ReactNode>                          // awaits getItemType(item.type).load(item), then <Page …/>

// features/items/narrow.ts — pure; the one sanctioned place to test an item's type outside the registry (fix 4)
export function isItemOfType<K extends ItemType>(item: CatalogItem, type: K): item is CatalogItem<K>

// features/items/href.ts — pure
export function itemHref(item: { trackId: string; localId: string }): string   // /t/dsa/items/lc-0001
export function itemIdFromRoute(trackId: string, itemParam: string): string    // decodeURIComponent → '<track>:<local>'

// features/items/index.ts — for pages and features/roadmap; NOT imported by client components
// (it re-exports the server-only registry): getItemType, ITEM_REGISTRY, renderItemRow, renderItemPage,
// isItemOfType, itemHref, itemIdFromRoute, mdxComponents, mdxComponentsFor, types

// components/patterns/link-row.tsx
export type LinkRowProps = { href: string; title: React.ReactNode; titleLang?: 'en' | 'vi';
  meta?: React.ReactNode[]; badges?: React.ReactNode; trailing?: React.ReactNode }
export function LinkRow(props: LinkRowProps): React.JSX.Element   // ≥ 44 px, whole row one link, focus ring
```

**Pages and rows** (read-only in M3; recording results arrives in 5.2):

- **problem** — Page: `#{leetcode}` + DifficultyBadge ("Easy"/"Medium"/"Hard" — LeetCode terms stay
  English) + topic title + VerificationBadge ("Đã kiểm thử" with `CircleCheck` / "Chỉ biên dịch"
  with `Info`, each with a one-line explanation) when a visible note exists; "Mở trên LeetCode"
  (ExternalLink to `content.url`); premium: a `Lock` + "Premium" marker and "Bản miễn phí:" links to
  every alternative; the note Body bound with `mdxComponentsFor({ code, codeLanguage:
  viewer.codeLanguage, resolvePractice })`; no note, or a draft note for a learner → EmptyState
  inline "Chưa có ghi chú" (§3.3) + "Bạn vẫn có thể giải bài trên LeetCode."; a draft note for an
  admin renders with "Bản nháp"; `note.deepDiveId` → a "Bài học chuyên sâu" link. Row: title
  (`lang="en"`), meta `#1 · Easy · Arrays & Hashing`, Premium marker, verification icon.
- **lesson** — Page: format label (`vi.items.lessonFormat[format] ?? format`: "Pattern",
  "Deep-dive"), topic, anchor and practice links via `resolveItem`, the Body. Row: title, "Pattern ·
  25 phút".
- **flashcard** — Page: `FlashcardView` (client): front (`lang` per card), "Xem nghĩa" reveals back,
  hint, usage ("danh từ · trung tính" + note), example (`lang="en"`), pronunciation; no grade
  buttons until 5.2. Row: front, tier label ("Cốt lõi" / "Mở rộng" / "Giải thích code").
- **exercise** — Page: instruction (vi, and en with `lang="en"`), text (`lang="en"`, the blank as
  a labelled input for fill-blank). fill-blank: "Kiểm tra" grades with `gradeFillBlank` → "Chính
  xác" / "Gần đúng — bạn đã xem gợi ý" / "Chưa đúng — đáp án: …" (icon + text, polite live region),
  "Xem gợi ý" reveals the hint. respond/rewrite: a Textarea ("Câu trả lời không được lưu."), "Xem
  câu trả lời mẫu" reveals sample answers (`lang="en"`) and the rubric. Row: instruction, kind
  label ("Điền từ" / "Trả lời" / "Viết lại").
- **prompt** — Page: instruction vi/en, minutes, tag label (`vi.template.tags`), rubric list. Row:
  instruction, tag · minutes.
- Every Row: `LinkRow` + `StatusPill` from `state` (null → "Chưa học") when `showStatus`; "Bản nháp"
  badge for drafts; "Đã ngừng" for retired. Every Page: draft/retired notice at the top.

**`/dev/items`** (`requireDevAccess()` first): every type's Page and Row rendered from `fixtures.ts`
(fixture `CatalogItem`s: a noted problem with Body = 3.3b's `sample-note.mdx`, a premium problem
without note, a pattern lesson with Body = `sample-lesson.mdx`, a vocabulary card, a derived card,
each exercise kind, a repeatable and a weekly prompt, one draft) — the page lists `file:
'features/items/<type>/Page.tsx'` / `Row.tsx` entries like the catalog registry.
`component-catalog.test.ts`: `features/items/*/{Page,Row}.tsx` must have `COMPONENTS.md` entries and
appear in `/dev/items` (server components cannot render in the client catalog registry).

**Architecture test** (`item-type-branching.ts`, §7.2 — "no `switch`/`case` on item types", gate
review fix 4): `itemTypeBranches(file, source): string[]` (TypeScript compiler API) reports every
`case` clause whose expression is a string literal in `ITEM_TYPES`. Scanned: `app/`, `components/`,
`features/` except `features/items/**`, and the rest of `lib/` and `tools/` except `lib/content/**`
and `tools/content/**` (the content pipeline builds items by type); test files are skipped. Equality
checks are not flagged — code that needs to narrow an item uses `isItemOfType` (`narrow.ts`). The
repo scan expects zero.

`lib/content/tracks.ts` keeps its exports (`loadTracks()`, `activeTracks()`, `getTrack(id)`; the
`root` parameter goes) and reads `getCatalog().tracks`; manifest-validation tests now live in 3.1's
`manifest.test.ts` (the fixture folders go). `vi.items`: the strings named above.

- [ ] **Step 1: Failing tests** — `registry.test.ts` (every `ITEM_TYPES` key registered with Page,
  Row and `load`; `srs` from the core; an unknown type throws); `href.test.ts`
  (`/t/dsa/items/lc-0001`; the derived card → `/t/english/items/explaining-code%3Adsa%3Alc-0001`;
  `itemIdFromRoute` round trip); per Page/Row tests (the behaviours above, incl. the LeetCode link
  `https://leetcode.com/problems/two-sum/` with `rel="noopener noreferrer"`; premium alternatives;
  "Chưa có ghi chú"; the draft note for learner vs admin; `lang="en"` on the card front and example;
  fill-blank pass/close/miss and **[RF-3]** an NFD answer passes; sample answers hidden until
  revealed; the "Chưa học" pill); `link-row.test.tsx`; `item-type-branching.test.ts` (one violation
  for `case 'problem':` in `features/roadmap/x.ts` and in `app/x/page.tsx`; none for
  `case 'review':`, none inside `features/items/**`, `lib/content/**` or `tools/content/**`, none
  for `item.type === 'lesson'`; the repo scan is clean); `narrow.test.ts` (`isItemOfType` true/false
  and narrows the content type — a `expectTypeOf` line); `render.test.tsx` (`renderItemRow` renders
  the registered Row with `itemHref`; `renderItemPage` awaits `load` and passes `data`);
  `tracks.test.ts` via the catalog.
- [ ] **Step 2: Failing e2e** — `e2e/items.spec.ts` on `/dev/items` (light and dark, desktop and
  mobile, axe): every type's heading renders; "Xem nghĩa" reveals the back; the fill-blank flow;
  "Xem lời giải" on the noted problem.
- [ ] **Step 3: RED → implement → GREEN**; catalog entries for the new `features/items/components`
  files and `LinkRow`; `COMPONENTS.md` entries for each Page and Row ("Item types" section).
- [ ] **Step 4: ADR-0009** — tracks are data (manifest + content validated by `content:build`),
  item types are code (a core in `lib/content/item-types`, Page/Row/load in `features/items/<type>`,
  one registry); screens never branch on item type (architecture test); adding an item type = one
  file, one folder, one registry line, one `COMPONENTS.md` entry.
- [ ] **Step 5: Verify** `pnpm verify && pnpm test:e2e` (onboarding and settings e2e prove the
  catalog-based track loader). **Commit** — `feat(items): item-type registry with a page and a row
  per item type`.

**Carry-overs from M2** (guards; tests first, same commit):

- `tools/guards/server-guards.ts`: recognise `return await requireX()` and a parenthesised
  `(await requireX())` as a first-statement guard; add a rule that feature modules other than
  `queries.ts` / `actions.ts` must not import `lib/supabase/server` or `lib/supabase/admin`, and a
  feature `index.ts` must not re-export them (today `features/settings/reads.ts` is safe only by
  convention).

### Task 3.4b: `/tracks`, the track roadmap page and item pages

**Files:**

- Create: `features/roadmap/{queries.ts,view-model.ts,slots.ts,index.ts}` (+ `queries.test.ts`,
  `view-model.test.ts`, `slots.test.tsx`),
  `features/roadmap/components/{track-list,track-card,track-overview,variant-links,week-section,roadmap-view,item-view}.tsx`
  (+ tests), `app/(app)/tracks/page.tsx`, `app/(app)/t/[trackId]/page.tsx`,
  `app/(app)/t/[trackId]/items/[itemId]/page.tsx`, `e2e/tracks.spec.ts`, `e2e/content.spec.ts`
- Modify: `lib/i18n/vi.ts` (+ test), `docs/design/COMPONENTS.md`, `app/dev/components/registry.tsx`,
  `e2e/support/test.ts` (the `_rsc=` comment: `/tracks` exists now)

**Interfaces:**

```ts
// features/roadmap/view-model.ts — pure
export type WeekView = {
  week: number
  topics: { id: string; title: string }[]
  lessons: CatalogItem<'lesson'>[]     // topic lessons: formats that do not require `about`, topic ∈ week topics
  core: CatalogItem<'problem'>[]
  recap: { item: CatalogItem<'problem'>; mode: RecapMode | null }[]
  bonus: CatalogItem<'problem'>[]
  decks: { deck: DeckSummary; core: CatalogItem<'flashcard'>[]; extended: CatalogItem<'flashcard'>[] }[]
  exercises: CatalogItem<'exercise'>[]  // week field = this week
  prompts: CatalogItem<'prompt'>[]      // non-repeatable, week field = this week
}
export type RoadmapView = { variant: string; weeks: WeekView[];
  anytime: { prompts: CatalogItem<'prompt'>[]; derivedDecks: { deck: DeckSummary; unlocked: number }[] } }
export function buildRoadmapView(input: { track: TrackManifest; roadmap: Roadmap; access: CatalogAccess;
  includeDrafts: boolean }): RoadmapView
// drafts only when includeDrafts (admins); retired items never; order = roadmap order, then file order;
// items are narrowed with isItemOfType (features/items/narrow.ts), never switched on

// features/roadmap/slots.ts — pure; turns a view into ReactNode slots through a callback (fix 5)
export type RowRenderer = (item: CatalogItem, extra: { mode: RecapMode | null }) => React.ReactNode
export type WeekSlots = { week: number; topics: { id: string; title: string }[]; lessons: React.ReactNode[];
  core: React.ReactNode[]; recap: { row: React.ReactNode; mode: RecapMode | null }[]; bonus: React.ReactNode[];
  decks: { deck: DeckSummary; core: React.ReactNode[]; extended: React.ReactNode[] }[];
  exercises: React.ReactNode[]; prompts: React.ReactNode[] }
export type RoadmapSlots = { variant: string; weeks: WeekSlots[];
  anytime: { prompts: React.ReactNode[]; derivedDecks: { deck: DeckSummary; unlocked: number }[] } }
export function roadmapSlots(view: RoadmapView, renderRow: RowRenderer): RoadmapSlots

// features/roadmap/components — presentational; NO file here imports features/items/registry, so each
// renders in the client catalog with plain props (fix 5):
//   RoadmapView({ slots: RoadmapSlots }), WeekSection({ week: WeekSlots }),
//   ItemView({ backHref: string; trackTitle: string; notice: 'draft' | 'retired' | null; page: React.ReactNode })

// features/roadmap/queries.ts — import 'server-only'; every loader starts with `await requireOnboarded()`
export type TrackSummary = { id: string; title: string; titleEn: string; accent: string; status: ItemStatus }
export type Enrollment = { status: 'active' | 'paused' | 'removed'; roadmapVariant: string; budgetMinutes: number }
export type TracksOverview = { isAdmin: boolean;
  mine: { track: TrackSummary; enrollment: Enrollment }[]            // active and paused enrollments
  others: TrackSummary[] }                                           // active tracks not enrolled (or removed); drafts for admins
export async function getTracksOverview(): Promise<TracksOverview>
export type TrackPageData = { track: TrackSummary; enrollment: Enrollment | null; template: TemplateDay[]; throttle: string[];
  variants: { id: string; label: string; href: string; current: boolean }[]; view: RoadmapView | null; isAdmin: boolean }
export async function getTrackPage(trackId: string, variant: string | undefined): Promise<TrackPageData | null>
// null → 404: unknown track; draft track for a learner; retired track the learner is not enrolled in.
// variant: the param when it is one of the manifest's roadmaps, else the enrolled one, else
// defaultVariant(roadmaps, defaults.budgetMinutes) (2.9); view null when that roadmap file is missing (decision 4)
export type ItemPageModel = { item: CatalogItem; track: TrackSummary; viewer: ItemViewer; backHref: string;
  resolveItem: (id: string) => ItemLink | null }
export async function getItemPage(trackId: string, itemParam: string): Promise<ItemPageModel | null>
// null → 404: unknown item, draft item or draft track for a learner; retired items stay viewable with a notice
```

`user_tracks` is read with the session client (own rows, RLS), selecting `track_id, status,
roadmap_variant, budget_minutes`.

**Pages** (no `className`; compose `features/roadmap` and patterns; `params` / `searchParams` are
promises in Next 16):

- `/tracks` — `metadata` "Lộ trình — Học Đều"; PageHeader "Lộ trình" + "Các lộ trình bạn đang học
  và các lộ trình khác."; Section "Lộ trình của bạn" (TrackCard per enrollment: `data-accent` chip,
  title, status "Đang học" / "Tạm dừng", variant label, link "Xem lộ trình"); Section "Lộ trình
  khác" (TrackCard + "Thêm trong Cài đặt" → `/settings`; drafts with "Bản nháp" for admins); a
  retired enrolled track shows "Lộ trình đã ngừng — không nhận học viên mới."; nothing at all →
  EmptyState (RF-4).
- `/t/[trackId]` — `generateMetadata` from the track title; `TrackOverview` (`data-accent`
  wrapper): PageHeader (vi title, en title as description), `VariantLinks` ("Phiên bản lộ trình":
  links with `aria-current="true"` on the current variant, `variantLabel`), the weekly template via
  `WeeklyTemplatePreview` from `@/features/tracks`; then `RoadmapView`: one Section per week
  ("Tuần {n}" + topic chips) listing lessons, core ("Bài chính"), recap ("Ôn lại cuối tuần" + mode
  label "Làm lại" / "Nhớ lại" / "Giải thích thành lời"), bonus ("Bài thêm"), decks ("Bộ thẻ": title,
  "{core} thẻ cốt lõi · {extended} thẻ mở rộng", cards in a `<details>` list), exercises ("Bài
  tập"), prompts ("Nhiệm vụ"); a final Section "Không theo tuần" (repeatable prompts, derived
  decks). The page builds the rows itself — `roadmapSlots(view, (item, { mode }) =>
  renderItemRow(item, { state: null, mode: mode ?? undefined }))` with `renderItemRow` from
  `@/features/items` — and passes the slots to `RoadmapView` (fix 5).
  `view === null` → EmptyState "Lộ trình này chưa có nội dung." + "Nội dung đang được bổ sung." +
  link to `/tracks` (RF-4). Progress and weak items: 5.4 (decision 25).
- `/t/[trackId]/items/[itemId]` — `generateMetadata` "{title} — Học Đều"; the page renders
  `ItemView` with a back link "Về lộ trình {title}" and
  `page = await renderItemPage(model.item, { state: null, context: {}, viewer: model.viewer, resolveItem: model.resolveItem })`
  (the registry's Page via `features/items`, fix 5); `null` model → `notFound()`. `ItemPageModel`
  then carries no `data` (`renderItemPage` loads it).
- Loading and errors: the `(app)` group's `loading.tsx` / `error.tsx` cover the new segments (M2
  pattern).

**e2e** (one onboarded learner per test, DSA 8w/60 + English 10w/25 via `seedLearnerSetup`, as
2.11):

- `tracks.spec.ts`: `/tracks` lists both tracks under "Lộ trình của bạn" with "8 tuần" / "10 tuần";
  the nav item "Lộ trình" has `aria-current="page"` on `/tracks` and on `/t/dsa`; `/t/dsa` shows the
  weekly template; if `.generated/catalog.json` has `roadmaps.dsa['8w']` the page shows "Tuần 1" and
  its first core row, otherwise the empty state (PR A); `/t/dsa?variant=10w` marks 10w current and
  `?variant=nope` falls back to 8w; `/t/nope` and `/t/dsa/items/lc-99999` → the Vietnamese 404; axe
  light/dark on `/tracks` and `/t/dsa`; mobile: the bottom-nav "Lộ trình" is current on `/t/dsa`.
- `content.spec.ts` (the **content smoke test**, decision 4): collects from
  `.generated/catalog.json` every active lesson, every active problem with an active note, and the
  first and last active item of each type; for each, as a learner signed in once per worker (a
  worker-scoped fixture saving `storageState`): the item page's `h1` is the item title, a lesson's
  `[data-section]` kinds equal its catalog `sections`, a noted problem shows its verification
  badge and "Xem lời giải" reveals its languages; axe light on desktop for all, dark and mobile for
  the first item per type. With no items (PR A) the spec skips with "no content items yet".
- The existing specs' `networkidle` workarounds for `/tracks` prefetches stay valid (M2 note).

- [ ] **Step 1: Failing tests** — `view-model.test.ts` (a fixture catalog: week order; topic lessons
  by topic, deep-dives excluded; recap modes; drafts only with `includeDrafts`; retired excluded;
  exercises and prompts by week; repeatable prompts and derived decks under "anytime"; **[RF-4]** a
  roadmap week whose items are all drafts renders an empty week without crashing); `queries.test.ts`
  (mocks for the DAL, the session client and a fixture `CatalogAccess`: a learner gets `null` for a
  draft track and for a draft item, an admin gets both; unknown variant → the enrolled one → the
  budget default; a missing roadmap file → `view: null`; `itemParam` decoding of a derived ID; each
  loader calls `requireOnboarded` first — the existing guard test also checks it); `slots.test.tsx`
  (the callback is called once per item with the recap mode; empty weeks stay empty); component
  tests with plain ReactNode props (TrackCard states, VariantLinks `aria-current`, WeekSection
  labels, ItemView notices, the empty states).
- [ ] **Step 2: Failing e2e** — `tracks.spec.ts`, `content.spec.ts` as above.
- [ ] **Step 3: RED → implement → GREEN**; catalog entries and `COMPONENTS.md` entries for every
  `features/roadmap/components` file; `vi.roadmap` strings.
- [ ] **Step 4: Verify** `pnpm verify && pnpm test:e2e`. **Commit** — `feat(tracks): tracks list,
  track roadmap and item pages from the catalog`.

**Carry-overs from M2** (pages; tests first, same commit):

- `/tracks` and the onboarding wizard show an EmptyState when there are no active tracks (RF-4).

### Task 3.6: DSA problem metadata, roadmaps, topic signals, mock-interview prompt [PR B]

**Owner review before merge.** Branch `feat/m3-dsa-content`, created by the controller from the
pipeline branch once 3.2c and 3.3b are in (end of wave 3), with its integration worktree
`int-dsa` (fix 16); this task runs in its own worktree from that branch like every other task.

**Files:**

- Create: `content/tracks/dsa/problems/lc-NNNN-<slug>/problem.yaml` × 114 (tables below),
  `content/tracks/dsa/roadmaps/10w.yaml`, `content/tracks/dsa/roadmaps/8w.yaml`,
  `content/tracks/dsa/prompts/mock-interview.yaml`, `tools/content/dsa-content.test.ts`
- Modify: `content/tracks/dsa/track.yaml` (`signals` for every topic). **Not** `content/ids.lock`:
  on the content branches the controller owns it (decision 8) — run `pnpm content:build` locally,
  then `git checkout content/ids.lock` before committing.

**File formats:**

```yaml
# content/tracks/dsa/problems/lc-0271-encode-and-decode-strings/problem.yaml
id: dsa:lc-0271
leetcode: 271
title: Encode and Decode Strings
difficulty: M
topic: arrays-hashing
premium: true
alternatives:
  - { label: 'LintCode 659 (miễn phí)', url: 'https://www.lintcode.com/problem/659/' }
```

```yaml
# content/tracks/dsa/roadmaps/10w.yaml
id: 10w
weeks:
  - week: 1
    topics: [arrays-hashing]
    core: [dsa:lc-0217, dsa:lc-0242, dsa:lc-0001, dsa:lc-0049, dsa:lc-0347, dsa:lc-0238, dsa:lc-0128, dsa:lc-0036]
    bonus: []
    recap:
      - { item: dsa:lc-0271 }
      - { item: dsa:lc-0128, mode: redo }
      - { item: dsa:lc-0049, mode: explain-aloud }
```

```yaml
# content/tracks/dsa/prompts/mock-interview.yaml (§5.6)
- id: dsa:prompt-mock-interview
  tag: mock-interview
  repeatable: true
  minutes: 45
  instruction:
    vi: 'Chọn bài Medium bạn đã học mà lâu nhất chưa gặp lại. Giải trong khoảng 30 phút rồi giải thích cách làm bằng tiếng Anh, như đang phỏng vấn.'
    en: 'Pick the Medium problem you have not seen for the longest. Solve it in about 30 minutes, then explain your approach aloud in English, as in an interview.'
  rubric: ['…3–5 criteria in Vietnamese…']
```

**The 10w roadmap — the brief's roadmap, the input of the §5.10/§5.11 simulation** (source:
`docs/plans/assets/2026-09-23-plan-sim.py` `W10`; recap without a mode = introduced there):

| Week | Topics | Core (difficulty) | Recap |
| --- | --- | --- | --- |
| 1 | arrays-hashing | 217 E, 242 E, 1 E, 49 M, 347 M, 238 M, 128 M, 36 M | 271 (new), 128 redo, 49 explain-aloud |
| 2 | two-pointers, sliding-window | 125 E, 121 E, 167 M, 15 M, 11 M, 3 M, 424 M, 42 H | 1 explain-aloud, 567 (new), 347 redo |
| 3 | stack, binary-search | 20 E, 704 E, 155 M, 739 M, 875 M, 153 M, 981 M, 84 H | 424 redo, 150 (new), 238 redo |
| 4 | linked-list | 206 E, 21 E, 141 E, 19 M, 143 M, 2 M, 146 M, 23 H | 74 (new), 3 redo, 138 (new) |
| 5 | trees | 226 E, 104 E, 100 E, 543 E, 102 M, 98 M, 230 M, 124 H | 146 redo, 199 (new), 128 redo |
| 6 | heap | 703 E, 1046 E, 973 M, 215 M, 621 M, 355 M, 295 H | 347 redo, 230 redo, 981 redo |
| 7 | backtracking | 78 M, 39 M, 46 M, 90 M, 40 M, 79 M, 17 M, 51 H | 22 (new), 572 (new), 215 redo |
| 8 | graphs | 200 M, 695 M, 133 M, 994 M, 417 M, 207 M, 210 M, 127 H | 79 redo, 102 redo, 739 redo |
| 9 | dp-1d | 70 E, 198 M, 213 M, 5 M, 91 M, 322 M, 139 M, 300 M | 994 redo, 647 (new), 42 redo |
| 10 | dp-2d, intervals, greedy | 62 M, 1143 M, 56 M, 57 M, 435 M, 253 M, 53 M, 763 M | 146 redo, 295 redo, 380 (new) |

Week sizes `[8, 8, 8, 8, 8, 7, 8, 8, 8, 8]` (79 core) + 10 recap-introduced = 89 problems.

**The 8w roadmap** (`W8` in the same file; §5.3 week sizes `[8, 8, 7, 11, 7, 7, 8, 8]`):

| Week | Topics | Core | Recap |
| --- | --- | --- | --- |
| 1 | arrays-hashing | 217, 242, 1, 49, 347, 238, 128, 36 | 271 (new), 128 redo, 49 explain-aloud |
| 2 | two-pointers, sliding-window | 125, 121, 167, 15, 11, 3, 424, 42 | 1 explain-aloud, 347 redo, 3 redo |
| 3 | stack, binary-search | 20, 704, 155, 739, 875, 153, 981 | 424 redo, 238 redo, 739 redo |
| 4 | linked-list, trees | 206, 21, 141, 146, 226, 104, 100, 543, 102, 98, 230 | 146 redo, 128 redo, 102 redo |
| 5 | heap, backtracking | 703, 973, 215, 78, 39, 46, 79 | 347 redo, 230 redo, 981 redo |
| 6 | graphs | 200, 695, 133, 994, 417, 207, 210 | 79 redo, 102 redo, 739 redo |
| 7 | dp-1d | 70, 198, 213, 5, 91, 322, 139, 300 | 994 redo, 42 redo, 5 redo |
| 8 | dp-2d, intervals, greedy | 62, 1143, 56, 57, 435, 253, 53, 763 | 146 redo, 215 redo, 380 (new) |

**Problem metadata** (title = LeetCode's English title, never translated; slug = LeetCode's URL
slug; topic = NeetCode 150 category mapped to the manifest topics; difficulty as the brief/sim —
it feeds the M4 projection hash):

| # | Title | Slug | Topic | Diff. |
| --- | --- | --- | --- | --- |
| 1 | Two Sum | two-sum | arrays-hashing | E |
| 2 | Add Two Numbers | add-two-numbers | linked-list | M |
| 3 | Longest Substring Without Repeating Characters | longest-substring-without-repeating-characters | sliding-window | M |
| 5 | Longest Palindromic Substring | longest-palindromic-substring | dp-1d | M |
| 11 | Container With Most Water | container-with-most-water | two-pointers | M |
| 15 | 3Sum | 3sum | two-pointers | M |
| 17 | Letter Combinations of a Phone Number | letter-combinations-of-a-phone-number | backtracking | M |
| 19 | Remove Nth Node From End of List | remove-nth-node-from-end-of-list | linked-list | M |
| 20 | Valid Parentheses | valid-parentheses | stack | E |
| 21 | Merge Two Sorted Lists | merge-two-sorted-lists | linked-list | E |
| 22 | Generate Parentheses | generate-parentheses | stack | M |
| 23 | Merge k Sorted Lists | merge-k-sorted-lists | linked-list | H |
| 36 | Valid Sudoku | valid-sudoku | arrays-hashing | M |
| 39 | Combination Sum | combination-sum | backtracking | M |
| 40 | Combination Sum II | combination-sum-ii | backtracking | M |
| 42 | Trapping Rain Water | trapping-rain-water | two-pointers | H |
| 46 | Permutations | permutations | backtracking | M |
| 49 | Group Anagrams | group-anagrams | arrays-hashing | M |
| 51 | N-Queens | n-queens | backtracking | H |
| 53 | Maximum Subarray | maximum-subarray | greedy | M |
| 56 | Merge Intervals | merge-intervals | intervals | M |
| 57 | Insert Interval | insert-interval | intervals | M |
| 62 | Unique Paths | unique-paths | dp-2d | M |
| 70 | Climbing Stairs | climbing-stairs | dp-1d | E |
| 74 | Search a 2D Matrix | search-a-2d-matrix | binary-search | M |
| 78 | Subsets | subsets | backtracking | M |
| 79 | Word Search | word-search | backtracking | M |
| 84 | Largest Rectangle in Histogram | largest-rectangle-in-histogram | stack | H |
| 90 | Subsets II | subsets-ii | backtracking | M |
| 91 | Decode Ways | decode-ways | dp-1d | M |
| 98 | Validate Binary Search Tree | validate-binary-search-tree | trees | M |
| 100 | Same Tree | same-tree | trees | E |
| 102 | Binary Tree Level Order Traversal | binary-tree-level-order-traversal | trees | M |
| 104 | Maximum Depth of Binary Tree | maximum-depth-of-binary-tree | trees | E |
| 121 | Best Time to Buy and Sell Stock | best-time-to-buy-and-sell-stock | sliding-window | E |
| 124 | Binary Tree Maximum Path Sum | binary-tree-maximum-path-sum | trees | H |
| 125 | Valid Palindrome | valid-palindrome | two-pointers | E |
| 127 | Word Ladder | word-ladder | graphs | H |
| 128 | Longest Consecutive Sequence | longest-consecutive-sequence | arrays-hashing | M |
| 133 | Clone Graph | clone-graph | graphs | M |
| 138 | Copy List with Random Pointer | copy-list-with-random-pointer | linked-list | M |
| 139 | Word Break | word-break | dp-1d | M |
| 141 | Linked List Cycle | linked-list-cycle | linked-list | E |
| 143 | Reorder List | reorder-list | linked-list | M |
| 146 | LRU Cache | lru-cache | linked-list | M |
| 150 | Evaluate Reverse Polish Notation | evaluate-reverse-polish-notation | stack | M |
| 153 | Find Minimum in Rotated Sorted Array | find-minimum-in-rotated-sorted-array | binary-search | M |
| 155 | Min Stack | min-stack | stack | M |
| 167 | Two Sum II - Input Array Is Sorted | two-sum-ii-input-array-is-sorted | two-pointers | M |
| 198 | House Robber | house-robber | dp-1d | M |
| 199 | Binary Tree Right Side View | binary-tree-right-side-view | trees | M |
| 200 | Number of Islands | number-of-islands | graphs | M |
| 206 | Reverse Linked List | reverse-linked-list | linked-list | E |
| 207 | Course Schedule | course-schedule | graphs | M |
| 210 | Course Schedule II | course-schedule-ii | graphs | M |
| 213 | House Robber II | house-robber-ii | dp-1d | M |
| 215 | Kth Largest Element in an Array | kth-largest-element-in-an-array | heap | M |
| 217 | Contains Duplicate | contains-duplicate | arrays-hashing | E |
| 226 | Invert Binary Tree | invert-binary-tree | trees | E |
| 230 | Kth Smallest Element in a BST | kth-smallest-element-in-a-bst | trees | M |
| 238 | Product of Array Except Self | product-of-array-except-self | arrays-hashing | M |
| 242 | Valid Anagram | valid-anagram | arrays-hashing | E |
| 253 | Meeting Rooms II | meeting-rooms-ii | intervals | M — **premium**, alternative LintCode 919 `https://www.lintcode.com/problem/919/` |
| 271 | Encode and Decode Strings | encode-and-decode-strings | arrays-hashing | M — **premium**, alternative LintCode 659 `https://www.lintcode.com/problem/659/` |
| 295 | Find Median from Data Stream | find-median-from-data-stream | heap | H |
| 300 | Longest Increasing Subsequence | longest-increasing-subsequence | dp-1d | M |
| 322 | Coin Change | coin-change | dp-1d | M |
| 347 | Top K Frequent Elements | top-k-frequent-elements | arrays-hashing | M |
| 355 | Design Twitter | design-twitter | heap | M |
| 380 | Insert Delete GetRandom O(1) | insert-delete-getrandom-o1 | arrays-hashing | M — not in NeetCode 150; the brief's roadmap introduces it in the last recap |
| 417 | Pacific Atlantic Water Flow | pacific-atlantic-water-flow | graphs | M |
| 424 | Longest Repeating Character Replacement | longest-repeating-character-replacement | sliding-window | M |
| 435 | Non-overlapping Intervals | non-overlapping-intervals | intervals | M |
| 543 | Diameter of Binary Tree | diameter-of-binary-tree | trees | E |
| 567 | Permutation in String | permutation-in-string | sliding-window | M |
| 572 | Subtree of Another Tree | subtree-of-another-tree | trees | E |
| 621 | Task Scheduler | task-scheduler | heap | M |
| 647 | Palindromic Substrings | palindromic-substrings | dp-1d | M |
| 695 | Max Area of Island | max-area-of-island | graphs | M |
| 703 | Kth Largest Element in a Stream | kth-largest-element-in-a-stream | heap | E |
| 704 | Binary Search | binary-search | binary-search | E |
| 739 | Daily Temperatures | daily-temperatures | stack | M |
| 763 | Partition Labels | partition-labels | greedy | M |
| 875 | Koko Eating Bananas | koko-eating-bananas | binary-search | M |
| 973 | K Closest Points to Origin | k-closest-points-to-origin | heap | M |
| 981 | Time Based Key-Value Store | time-based-key-value-store | binary-search | M |
| 994 | Rotting Oranges | rotting-oranges | graphs | M |
| 1046 | Last Stone Weight | last-stone-weight | heap | E |
| 1143 | Longest Common Subsequence | longest-common-subsequence | dp-2d | M |

**Bonus problems — selected NeetCode 150 problems (Q2, decision 29; the owner confirms or edits the
list in PR B).** Selection rule, as actually applied (gate review fix 14): a hand-picked set of the
NeetCode 150 problems of the manifest's topics that the roadmap leaves out, targeting ~110 problems
in total (Q5) — at most 4 per topic, Easy and Medium first, free problems first — plus three
exceptions: 76 (the classic sliding-window Hard), 252 (premium, but LintCode 920 is free) and 743
(from NeetCode's **Advanced Graphs** category, mapped to the `graphs` topic). In 10w each sits in
the week of its topic; in 8w likewise:

| # | Title | Slug | Topic | Diff. | 10w week | 8w week |
| --- | --- | --- | --- | --- | --- | --- |
| 76 | Minimum Window Substring | minimum-window-substring | sliding-window | H | 2 | 2 |
| 853 | Car Fleet | car-fleet | stack | M | 3 | 3 |
| 33 | Search in Rotated Sorted Array | search-in-rotated-sorted-array | binary-search | M | 3 | 3 |
| 287 | Find the Duplicate Number | find-the-duplicate-number | linked-list | M | 4 | 4 |
| 110 | Balanced Binary Tree | balanced-binary-tree | trees | E | 5 | 4 |
| 235 | Lowest Common Ancestor of a Binary Search Tree | lowest-common-ancestor-of-a-binary-search-tree | trees | M | 5 | 4 |
| 1448 | Count Good Nodes in Binary Tree | count-good-nodes-in-binary-tree | trees | M | 5 | 4 |
| 105 | Construct Binary Tree from Preorder and Inorder Traversal | construct-binary-tree-from-preorder-and-inorder-traversal | trees | M | 5 | 4 |
| 208 | Implement Trie (Prefix Tree) | implement-trie-prefix-tree | tries | M | 5 | 4 |
| 211 | Design Add and Search Words Data Structure | design-add-and-search-words-data-structure | tries | M | 5 | 4 |
| 131 | Palindrome Partitioning | palindrome-partitioning | backtracking | M | 7 | 5 |
| 130 | Surrounded Regions | surrounded-regions | graphs | M | 8 | 6 |
| 684 | Redundant Connection | redundant-connection | graphs | M | 8 | 6 |
| 743 | Network Delay Time (NeetCode: Advanced Graphs) | network-delay-time | graphs | M | 8 | 6 |
| 746 | Min Cost Climbing Stairs | min-cost-climbing-stairs | dp-1d | E | 9 | 7 |
| 152 | Maximum Product Subarray | maximum-product-subarray | dp-1d | M | 9 | 7 |
| 416 | Partition Equal Subset Sum | partition-equal-subset-sum | dp-1d | M | 9 | 7 |
| 309 | Best Time to Buy and Sell Stock with Cooldown | best-time-to-buy-and-sell-stock-with-cooldown | dp-2d | M | 10 | 8 |
| 518 | Coin Change II | coin-change-ii | dp-2d | M | 10 | 8 |
| 494 | Target Sum | target-sum | dp-2d | M | 10 | 8 |
| 72 | Edit Distance | edit-distance | dp-2d | M | 10 | 8 |
| 252 | Meeting Rooms | meeting-rooms | intervals | E — **premium**, alternative LintCode 920 `https://www.lintcode.com/problem/920/` | 10 | 8 |
| 55 | Jump Game | jump-game | greedy | M | 10 | 8 |
| 45 | Jump Game II | jump-game-ii | greedy | M | 10 | 8 |
| 134 | Gas Station | gas-station | greedy | M | 10 | 8 |

**Omitted** — the 17 NeetCode 150 problems of these topics not in the roadmap and not selected:
239, 4, 25, 297, 212, 286, 323, 261, 97, 329, 115, 312, 10, 846, 1899, 678, 1851 (Hard, premium
without a chosen alternative, or over the per-topic cap). NeetCode's other Advanced Graphs problems
(1584, 332, 778, 269, 787) and its Math & Geometry and Bit Manipulation categories have no topic in
the manifest.

The 8w variant also lists as **bonus**, in the week of their topic, the 10w problems it drops: W2
567; W3 84, 150, 22, 74; W4 19, 143, 2, 23, 138, 124, 199, 572; W5 1046, 621, 355, 295, 90, 40, 17,
51; W6 127; W7 647. (The 8w recap introduces 271 and 380 as in the table.) Bonus items stay out of
the new-item queue while `include_bonus` is false (§5.3); they are listed on the track page.

**Topic signals:** 2–4 per topic in Vietnamese with English terms (e.g. arrays-hashing: "Cần tra cứu
nhanh một giá trị đã gặp", "Đếm tần suất phần tử", "So sánh hai tập hợp không theo thứ tự"); tries
too (its lesson is optional).

**`tools/content/dsa-content.test.ts`** (pins only the simulation input — roadmap lists and
difficulties, fix 20 — so later content PRs that add problems, notes or bonus items never touch it;
builds the real content with `buildContent({ check: true, outDir: <temp> })`): the 10w and 8w `core`
and `recap` lists (items and modes) equal the two tables (encoded in the test as data), hence week
sizes `[8, 8, 8, 8, 8, 7, 8, 8, 8, 8]` and `[8, 8, 7, 11, 7, 7, 8, 8]`; every core and recap
problem's difficulty equals the table.

- [ ] **Step 1: Failing test** — `dsa-content.test.ts`. **Step 2:** write the files (a throwaway
  script in the scratchpad may generate the YAML from the tables; do not commit it), `pnpm format`,
  `pnpm content:build` (locally the lock gains 115 IDs — 114 problems + the prompt; restore it
  before committing, the controller records them). **Step 3: GREEN** + `pnpm verify`; the report
  pastes the `content:build` output.
- [ ] **Step 4: Commit** — `feat(content): DSA problem metadata, 8w and 10w roadmaps, topic signals
  and the mock-interview prompt`.

**Owner review checklist (PR B):** every problem's number, title, slug (the LeetCode link opens the
right problem), difficulty and topic; the premium flags and the LintCode alternatives open the right
problems; both roadmaps match the brief tables, recap modes included; the bonus list and placement
(Q2); topic signals read well; the mock-interview prompt; no problem statement text anywhere.

### Task 3.10: English topics, 10w roadmap, core decks W1–W10 [PR C]

**Owner review before merge** (OD4). Branch `feat/m3-english-content`, created by the controller
from the pipeline branch once 3.2c is in (end of wave 3), with its integration worktree
`int-english` (fix 16); this task runs in its own worktree from that branch.

**Files:** Modify `content/tracks/english/track.yaml` (`topics`); Create
`content/tracks/english/roadmaps/10w.yaml`, `content/tracks/english/decks/w01-standup.yaml` …
`w10-<topic>.yaml` (core cards only), `tools/content/english-content.test.ts`. Not
`content/ids.lock` — the controller records the new IDs (decision 8).

**Topics (Q3, decision 30)** and core cards per week — the counts are the §5.10 simulation input
(135 core cards):

| Week | Topic ID | vi / en title | Core cards |
| --- | --- | --- | --- |
| 1 | standup | Họp stand-up / Stand-up meetings | 12 |
| 2 | tickets | Ticket và báo lỗi / Tickets and bug reports | 16 |
| 3 | code-review | Code review / Code review | 14 |
| 4 | pull-requests | Pull request và commit / Pull requests and commits | 14 |
| 5 | meetings | Họp và thảo luận / Meetings and discussions | 12 |
| 6 | estimates | Ước lượng và lập kế hoạch / Estimates and planning | 13 |
| 7 | incidents | Sự cố và trực on-call / Incidents and on-call | 16 |
| 8 | documentation | Viết tài liệu kỹ thuật / Technical writing | 14 |
| 9 | interviews | Phỏng vấn xin việc / Job interviews | 11 |
| 10 | demos | Demo và nhận phản hồi / Demos and feedback | 13 |

**Formats:**

```yaml
# content/tracks/english/roadmaps/10w.yaml
id: 10w
weeks:
  - { week: 1, topics: [standup], decks: [english:deck-w01-standup] }
  # … weeks 2–10
```

```yaml
# content/tracks/english/decks/w01-standup.yaml
id: english:deck-w01-standup
kind: vocabulary
week: 1
topic: standup
title: { vi: 'Họp stand-up', en: 'Stand-up meetings' }
cards:
  - id: english:w01-blocker
    tier: core
    front: blocker
    back: vấn đề đang chặn, khiến bạn chưa làm tiếp được
    usage: { pos: noun, register: neutral, note: 'Hay đi với "have" hoặc "hit".' }
    example: "I have one blocker: I'm still waiting for access to the staging database."
    pronunciation: '/ˈblɒk.ər/ · BLOCK-er'
```

Card rules: `front` = a term or short phrase used in IT workplaces; `back` = a short, natural
Vietnamese meaning; `usage.note` in Vietnamese; `example` = one original work-context sentence in
English; `pronunciation` = IPA + a stress hint; no dictionary text copied; card IDs
`english:w<NN>-<slug of the term>`; no duplicate `front` across decks (case-insensitive).

**`tools/content/english-content.test.ts`** (pins only the roadmap lists and core card counts — the
simulation input, fix 20; builds the real content into a temp `outDir`): the 10w roadmap's week →
deck list equals the table (`english:deck-w01-standup` … `w10`), and the `tier: core` card count per
week is `[12, 16, 14, 14, 12, 13, 16, 14, 11, 13]`. Extended cards, exercises and prompts are not
pinned, so later content PRs never touch this test. No duplicate fronts is a review check (the
report lists the counts).

- [ ] **Step 1: Failing test. Step 2:** write the files, `pnpm format`, `pnpm content:build`,
  `git checkout content/ids.lock`. **Step 3: GREEN** + `pnpm verify`. **Commit** —
  `feat(content): English topics, 10w roadmap and core decks for weeks 1–10`. The report pastes the
  `content:build` report.

**Owner review checklist (PR C):** topic order and titles (Q3); meanings accurate and natural;
examples sound like real IT-workplace English; pronunciation hints right; register labels right.

### Tasks 3.7a–3.9a and 3.7b–3.9b: DSA W1, W2, W3 — tests and solutions, then notes and lessons [PR B]

**Owner review before merge, including checking every `tests.yaml` example against the LeetCode
examples.** Each week is split in two (gate review fix 11): **(a)** `tests.yaml` + the three
solutions (wave 5), **(b)** notes + pattern lessons (wave 6, after its week's (a) — a note requires
solutions and tests). The three (a) tasks run in parallel worktrees from `feat/m3-dsa-content`
after 3.6, then the three (b) tasks; they touch disjoint problem folders and lessons. **Nobody but
the controller commits `content/ids.lock`** on this branch (decision 8): (a) adds no IDs; after
cherry-picking the (b) tasks the controller runs `pnpm content:build` in `int-dsa` and commits
`chore(content): record new IDs in ids.lock` (lesson IDs and the derived
`english:explaining-code:dsa:lc-…` IDs).

| Week | (a) task | (b) task | Problems (the 10w W1–W3 sets, which contain 8w W1–W3) | Lessons (anchor → practice, proposed) |
| --- | --- | --- | --- | --- |
| 1 | 3.7a | 3.7b (writes ADR-0013) | 217, 242, 1, 49, 347, 238, 128, 36, **271** | arrays-hashing (1 → 49) |
| 2 | 3.8a | 3.8b | 125, 121, 167, 15, 11, 3, 424, 42, 567 | two-pointers (167 → 15), sliding-window (121 → 3) |
| 3 | 3.9a | 3.9b | 20, 704, **155**, 739, 875, 153, **981**, 84, 150 | stack (20 → 739), binary-search (704 → 875) |

Bold = `design-class`, `compile-only` in M3a (§3.7). Expected `content:verify` after 3.9a:
`tested 24 · compile-only 3 · failed 0`.

**Files** — (a), per problem in its `problems/lc-NNNN-<slug>/` folder: `tests.yaml`, `solution.py`,
`Solution.java`, `solution.go`. (b), per problem: `note.mdx`; per lesson: `lessons/<topic>.mdx`;
3.7b also `docs/adr/0013-one-lesson-per-pattern.md` and links its row in `docs/adr/README.md`
(fix 18).

**Where the examples come from** (fix 11): the implementer may open the public LeetCode problem page
(`https://leetcode.com/problems/<slug>/`, e.g. with WebFetch) **only to read the examples** —
inputs and outputs; no statement text is copied anywhere (Q7). When the page cannot be fetched,
write the examples from memory and mark each such case **unverified** in the report. Every (a)
report contains, per problem, a table: the LeetCode URL, then each `example-N` as written in
`tests.yaml` (input → output) with `verified` / `unverified` — the owner's checklist uses it.

**Signatures** (`tests.yaml` `signature` / `compare`; names, parameter names and orders as on
LeetCode):

| # | Kind / name | Params → returns | Compare |
| --- | --- | --- | --- |
| 217 | function `containsDuplicate` | `nums: int[]` → `bool` | exact |
| 242 | function `isAnagram` | `s: string, t: string` → `bool` | exact |
| 1 | function `twoSum` | `nums: int[], target: int` → `int[]` | unordered |
| 49 | function `groupAnagrams` | `strs: string[]` → `string[][]` | unordered-nested |
| 347 | function `topKFrequent` | `nums: int[], k: int` → `int[]` | unordered |
| 238 | function `productExceptSelf` | `nums: int[]` → `int[]` | exact |
| 128 | function `longestConsecutive` | `nums: int[]` → `int` | exact |
| 36 | function `isValidSudoku` | `board: char[][]` → `bool` | exact |
| 271 | design-class `Codec` | `encode(strs: string[]) → string`, `decode(s: string) → string[]` | round trip via `$result` |
| 125 | function `isPalindrome` | `s: string` → `bool` | exact |
| 121 | function `maxProfit` | `prices: int[]` → `int` | exact |
| 167 | function `twoSum` | `numbers: int[], target: int` → `int[]` | exact |
| 15 | function `threeSum` | `nums: int[]` → `int[][]` | unordered-nested |
| 11 | function `maxArea` | `height: int[]` → `int` | exact |
| 3 | function `lengthOfLongestSubstring` | `s: string` → `int` | exact |
| 424 | function `characterReplacement` | `s: string, k: int` → `int` | exact |
| 42 | function `trap` | `height: int[]` → `int` | exact |
| 567 | function `checkInclusion` | `s1: string, s2: string` → `bool` | exact |
| 20 | function `isValid` | `s: string` → `bool` | exact |
| 704 | function `search` | `nums: int[], target: int` → `int` | exact |
| 155 | design-class `MinStack` | `push(val: int) → void`, `pop() → void`, `top() → int`, `getMin() → int` | exact |
| 739 | function `dailyTemperatures` | `temperatures: int[]` → `int[]` | exact |
| 875 | function `minEatingSpeed` | `piles: int[], h: int` → `int` | exact |
| 153 | function `findMin` | `nums: int[]` → `int` | exact |
| 981 | design-class `TimeMap` | `set(key: string, value: string, timestamp: int) → void`, `get(key: string, timestamp: int) → string` | exact |
| 84 | function `largestRectangleArea` | `heights: int[]` → `int` | exact |
| 150 | function `evalRPN` | `tokens: string[]` → `int` | exact |

**`tests.yaml` rules (§3.5):** cases `example-1` … `example-n` = **every LeetCode example**, input
and output copied exactly (the owner checks each); ≥ 2 edge cases valid under the problem's
constraints (smallest input, single element, duplicates, negatives, a larger input where cheap)
with names like `single-element`, `all-duplicates`; ≥ 4 cases in total; `timeoutMs` default. For a
problem with several valid answers, pick the comparator (1, 347 `unordered`; 49, 15
`unordered-nested`); when LeetCode states the answer is unique (1), keep `unordered` anyway (order
free). Design classes use the ops format (decision 20):

```yaml
signature:
  kind: design-class
  className: MinStack
  methods:
    push: { params: { val: int }, returns: void }
    pop: { returns: void }
    top: { returns: int }
    getMin: { returns: int }
cases:
  - name: example-1        # copy LeetCode's example
    ops: [MinStack, push, push, push, getMin, pop, top, getMin]
    args: [[], [-2], [0], [-3], [], [], [], []]
    expected: [null, null, null, null, -3, null, 0, -2]
  # … ≥ 2 edge cases (e.g. equal minimums pushed twice, a single element), ≥ 4 in total
```

For 271 the decode step takes the encode result: `args: [[], [["…", "…"]], [{ $result: 1 }]]`,
`expected: [null, { $any: true }, ["…", "…"]]`.

**Note template** (`note.mdx`; Vietnamese prose, English technical terms in `<Term>` the first
time; own words, never the statement):

```mdx
---
status: active
---

## Ý tưởng chính

2–5 câu: nhận ra pattern nào và vì sao; mẹo then chốt.

## Cách làm

<Steps>

<Step title="…">…</Step>

<Step title="…">…</Step>

</Steps>

<Complexity time="O(n)" space="O(n)" />

<Solution />

<Bilingual vi="Một câu tóm tắt cách tối ưu bằng tiếng Việt." en="One sentence on the optimal approach in English." />
```

Optional: a `<VarTable caption="…">` walk-through on an own small input, a `<Callout tone="tip">`,
a fenced code block. `<Bilingual>` becomes the derived "Explaining code" card (§3.4): `en` is a
self-contained explanation in ≤ 300 characters.

**Solution conventions** (decision 34; the same approach in the three files):

```python
# solution.py
from typing import List


class Solution:
    def twoSum(self, nums: List[int], target: int) -> List[int]:
        ...
```

```java
// Solution.java
import java.util.*;

class Solution {
    public int[] twoSum(int[] nums, int target) {
        ...
    }
}
```

```go
// solution.go
package main

func twoSum(nums []int, target int) []int {
	...
}
```

Design classes: Python `class MinStack:` with `__init__`; Java `class MinStack {`; Go `type MinStack
struct {…}`, `func Constructor() MinStack`, `func (this *MinStack) Push(val int)`, `Pop`, `Top`,
`GetMin` (LeetCode's Go names; 271: `Codec` with `Encode` / `Decode`).

**Pattern lesson template** (`lessons/<topic>.mdx`, sections exactly the §3.4 `pattern` format, in
order):

```mdx
---
id: dsa:lesson-arrays-hashing
format: pattern
topic: arrays-hashing
title: 'Arrays & Hashing: tra cứu nhanh bằng hash map'
anchor: dsa:lc-0001
practice: dsa:lc-0049
---

<Section kind="signals">…bullets: when to reach for the pattern…</Section>

<Section kind="analogy">…an everyday Vietnamese analogy…</Section>

<Section kind="visual">…a `<VarTable>` or `<Steps>` walk-through of the anchor on an own small input, or an image from the content-images bucket (`![alt](url "WxH")`, once CONTENT_IMAGE_BASE_URL is set — OD3)…</Section>

<Section kind="approach">…`<Steps>`: the template reasoning…</Section>

<Section kind="code">…a fenced ```python block with the pattern template (the anchor's full three-language solution lives in its note)…</Section>

<Section kind="complexity">

<Complexity time="…" space="…" />

</Section>

<Section kind="bilingual">

<Bilingual vi="…" en="…" />

</Section>

<Section kind="practice">

<Practice problem="dsa:lc-0049" />

One sentence on what to try.

</Section>

<Section kind="quiz">
<Quiz>

<Question prompt="…" answer="b">

<Choice id="a">…</Choice>

<Choice id="b">…</Choice>

</Question>

</Quiz>
</Section>
```

(Block content inside a `<Section>` goes on its own lines after blank lines — decision 17.) Quiz:
≥ 3 questions, 2–4 choices each.

**Steps — (a) tasks (3.7a, 3.8a, 3.9a):**

- [ ] **Step 1:** write `tests.yaml` for every problem of the week first (examples as above, edge
  cases with hand-checked expected values) and run `pnpm content:verify --problem <id>` against a
  stub solution → RED.
- [ ] **Step 2:** write the three solutions → `pnpm content:verify` GREEN for the week (function
  problems `tested`, design classes `compile-only`); `pnpm content:build` clean (tests without a
  note are allowed); `pnpm verify`.
- [ ] **Step 3: Commit** — `feat(content): DSA week 1 tests and solutions in Python, Java and Go`
  (3.8a: week 2, 3.9a: week 3). The report pastes the `content:verify` output and the per-problem
  example tables.

**Steps — (b) tasks (3.7b, 3.8b, 3.9b):**

- [ ] **Step 1:** notes for every problem of the week and the week's pattern lessons; `pnpm
  content:build` clean (MDX safety, sections, lesson rules, derived cards), `git checkout
  content/ids.lock`; `pnpm verify`.
- [ ] **Step 2 (3.7b only): ADR-0013** — one lesson per pattern (anchor ≠ practice, same topic, at
  most one per topic), notes upgradeable to deep-dives (`format: deep-dive, about`), a missing
  lesson is coverage, not an error; link its row in `docs/adr/README.md`.
- [ ] **Step 3: Commit** — `feat(content): DSA week 1 notes and the Arrays & Hashing lesson` (3.8b:
  `… week 2 notes and the Two Pointers and Sliding Window lessons`; 3.9b: `… week 3 notes and the
  Stack and Binary Search lessons`). The report pastes the `content:build` report's coverage lines
  for the week.

**Owner review checklist (PR B, per week):** every `example-N` case equals the LeetCode example
(input and output — the (a) reports' tables list them, `unverified` ones first); edge cases valid
and correct; notes correct, in own words, complexity right;
`<Bilingual>` reads well in both languages; the three solutions follow the same approach and are
readable; the `content:verify` report (`tested 24 · compile-only 3 · failed 0` after W3); lessons:
sections complete, analogy/visual helpful, quiz answers right; on the preview, the badges show "Đã
kiểm thử" / "Chỉ biên dịch".

### Task 3.11: English W1–W3 extended cards, exercises, weekend prompts [PR C]

**Owner review before merge** (OD4). Worktree from `feat/m3-english-content` after 3.10 (wave 5).

**Files:** Modify `content/tracks/english/decks/w0{1,2,3}-*.yaml` (+ `tier: extended` cards: 18, 14
and 16, so each week has ~30 cards, Q5); Create `content/tracks/english/exercises/w01.yaml`,
`w02.yaml`, `w03.yaml` (6 per week: 2 `fill-blank`, 2 `respond`, 2 `rewrite` — the weekday practice
block picks one per weekday, §5.6), `content/tracks/english/prompts/weekend.yaml` (`tag:
weekend-task`, `week` 1–3, `minutes: 15`, e.g. W1 "Record a 1-minute stand-up update" with a
rubric). Not `content/ids.lock` (the controller records the IDs) and not the pinning test (fix 20).

Formats as §3.5 (exercises, prompts) and 3.10 (cards). Exercise texts are original, workplace-real
and use the week's vocabulary; `hint` in Vietnamese.

- [ ] **Step 1:** write the files, `pnpm format`, `pnpm content:build` — the schema makes every
  exercise carry its `week` (**exercise `week` set**, Part A) and the coverage lines must show, for
  weeks 1–3, 28–32 cards, ≥ 5 exercises covering the three kinds and one `weekend-task` prompt
  (checked in the report, not pinned by a test — fix 20); `git checkout content/ids.lock`. **Step
  2:** `pnpm verify`. **Commit** —
  `feat(content): English weeks 1–3 extended cards, exercises and weekend prompts`. The report
  pastes the coverage lines.

**Owner review checklist (PR C):** as 3.10, plus exercise answers (fill-blank `answers` accept the
right variants), sample answers and rubrics sensible, prompts doable in 15 minutes.

### M3 finish

1. **PR A (wave 5, in `int-pipeline`).** The draft PR A has been on GitHub since wave 2 (fix 6), so
   `content-verify` and its sandbox self-test have already run there. `pnpm verify:full` green;
   `git status` clean. Fresh end-of-milestone review (most capable model) over
   `main..feat/m3-content-pipeline` with the ledger's deferred minors; one fix pass (each fix RED →
   GREEN); residuals ledgered. Mark the PR ready: "M3: content pipeline — schemas, content:build,
   MDX, item registry, track pages, content-verify", with the owner decisions OD1–OD5 and the
   rulings list; CI green (`verify`, `db`, `e2e`, `content-build`, `content-verify`, CodeQL). Once
   `content-build` and `content-verify` have reported on the PR, add both to the `main` ruleset's
   required checks (decision 22) and say so in the PR. **The controller merges** (OD4). Post-merge
   owner checklist in the PR: onboarding on a Vercel preview still lists both tracks (decision 6);
   the preview build log shows `CI=1` and a check-mode `content:build` (decision 7).
2. **PR B and PR C (wave 7, in `int-dsa` / `int-english`).** For each content branch:
   `git rebase --onto origin/main <pipeline commit it was created from> <branch>` (PR A was
   squash-merged); `pnpm content:build` and commit `ids.lock` if it changed; `pnpm verify`;
   `pnpm content:verify` (B); then `pnpm test:e2e` once per branch, sequentially (e2e lock) — the
   content smoke spec now runs on the real items. A fresh review per branch focused on content
   accuracy and the §3.5 / §3.6 rules (for B: the (a) reports' example tables, `unverified` cases
   first). Push; open **PR B** "M3: DSA content — metadata, roadmaps, week 1–3 tests, solutions,
   notes and lessons" and **PR C** "M3: English content — roadmap, core decks, week 1–3 extended
   cards, exercises and prompts", each with its owner checklist and the pasted `content:build` (and
   `content:verify`) reports; CI green. **Stop for the owner's review — the owner merges B and C**
   (OD4). The second of B/C to merge is rebased first and its `ids.lock` regenerated (the controller
   keeps either side, runs `pnpm content:build`, commits).
3. M4 starts after PR A (content PRs run in parallel, Execution methods note); task 4.8 waits for
   PR B.

## Part B-M4 — Plan engine + spaced repetition, step by step

Written at the start of M4 (2026-09-25) from the code merged in M0–M3 (`main` at `86b637b`: PR #5
pipeline, #6, #7 English content, #8 DSA content), then revised the same day after an independent
gate review ("approve after fixes": 5 blockers, 7 important, 19 minor — all applied; decisions
31–34 come from it). The shared domain types, helpers and test fixtures in task 4.0 were compiled in a throwaway worktree against that commit (`tsc`, ESLint, the
`tools/guards` suite — green), so they are known to fit the pinned toolchain and the
`lib/domain` purity rules. Executed **subagent-driven with parallel waves in git worktrees** (as
M3, owner request): a fresh implementer and a fresh reviewer per task, the tasks of one wave in
separate worktrees, then one whole-branch review on the most capable model, one fix pass and one
re-review.

**Branch:** `feat/m4-plan-engine` from `main` at `86b637b`; this section is its first commit. One
pull request, "M4: plan engine + spaced repetition", plus the small follow-up PR **F1** (M3
residuals, own branch `fix/m3-followups` from `main`).

**Scope.** Pure functions in `lib/domain` (SRS, projection and replay, gate, queues, budget,
`buildPlan`, stale-plan resume, stats, simulation), the content → domain adapter, and the database
side of the plan engine: `day_plans` and the derived tables, the full `apply_event`, the plan and
auto check-in paths of `apply_system_event`, `mark_plan_seen`. No screen changes: `/today`,
check-in, `/review`, "Học thêm" and `/progress` are M5, which consumes these interfaces. §5.12
overrides and custom items are v1.1 (release table; owned by task 6.6) and are not built: `buildPlan` takes no
overrides and skips items that are not in the catalog.

**Owner questions** (answer at the review of this section; everything else below is a ruling the
owner can overturn):

- **Q1 — `fast-check` (dev).** Spec §7.10 already lists `fast-check` among the approved dev
  dependencies and §7.8 names it for the property tests, but it is not installed yet, and the owner
  asked to be asked before any new dependency. Proposal: `fast-check@4.10.2` (exact; one
  transitive dependency, `pure-rand`), installed by the controller in 4.0 and used only by
  `lib/domain/**/__tests__` (the purity guard already allows it there; `pnpm view` on 2026-09-25:
  4.10.2 is the latest release, its only dependency `pure-rand ^8`). **If declined:** the property
  tests of 4.4a and 4.6 draw their inputs from the seeded `mulberry32` generator
  (`lib/domain/random.ts`, created in 4.0 anyway) with the same invariants over 500 generated
  contexts; no shrinking.

**Execution schedule.** A task starts when every task it depends on has been cherry-picked onto
`feat/m4-plan-engine`; the waves below apply that rule in lockstep. "Stack" = the task uses the
single local Supabase stack — `pnpm db:reset` / `pnpm test:db` (DB) or `pnpm test:e2e` (e2e); one
stack holder per wave, because a `db:reset` under a running e2e breaks it.

**Owner hold (2026-09-25):** the SQL parts (4.9a–c, decision 33) and everything touching
`supabase/**` wait for the owner's approval. Until then the pure-TypeScript tasks run in their
waves (wave 1: 4.1, 4.4a, 4.4b, 4.5); after it, the stack tasks run in dependency order
(4.9a → 4.9b → 4.9c → 4.12 → 4.11), one at a time.

| Task | Depends on | Stack | Shared files it owns in its wave |
| --- | --- | --- | --- |
| 4.0 plan, deps, shared types (controller) | M3 merged | — | plan, spec, `docs/adr/README.md`, `package.json`, `pnpm-lock.yaml`, `lib/domain/{catalog,state,random}.ts`, `lib/domain/srs/outcomes.ts`, `lib/domain/plan/{types,reviewMode}.ts`, `lib/domain/plan/__tests__/fixtures.ts` |
| 4.1 SRS transitions | 4.0 | — | — |
| 4.4a roadmap position, new queue, recap source | 4.0 | — | — |
| 4.4b due queue, weak topics, practice pickers | 4.0 | — | — |
| 4.5 budget and throttle | 4.0 | — | — |
| 4.9a migration: plans and derived tables | 4.0 | DB | `lib/domain/rules.ts`, `tools/db/sql-sync.test.ts`, `lib/supabase/database.types.ts`, `supabase/tests/database/{001,012,030,040,060}-*.sql`, `docs/adr/0007-*.md` |
| 4.2 projection and replay | 4.1 | — | `lib/domain/events.ts` (+ test) |
| 4.3 gate and plan history | 4.0 | — | — |
| 4.7 stats, weekday, time-zone cache | 4.0 | — | `lib/domain/time/timeZones.ts` (+ test) |
| 4.10 plan catalog adapter | 4.0 | — | — |
| 4.9b `apply_event` with derived changes | 4.9a | DB | `lib/events/apply.ts` (+ test), `lib/supabase/database.types.ts`, `supabase/tests/database/{001,040}-*.sql` |
| 4.6 `buildPlan`, resume, property tests | 4.3, 4.4a, 4.4b, 4.5, 4.7 | — | — |
| 4.9c `apply_system_event`: plans, auto check-in | 4.9b | DB | `lib/events/apply.ts` (+ test), `lib/supabase/database.types.ts`, `supabase/tests/database/{001,041}-*.sql` |
| F1 M3 follow-ups (separate PR) | — | — | its own branch: `tools/content/derived.ts` (+ test), the fence-parity test, `vitest.config.ts`, `tools/content-verify/workflow.test.ts` |
| 4.8 simulation and projection table | 4.2, 4.6 | — (the controller runs the e2e after the wave) | `lib/domain/plan/projections.ts` (+ test), `package.json` scripts, `CLAUDE.md`, `README.md`, spec §5.10–§5.11, onboarding / variant-picker tests, `e2e/onboarding.spec.ts` |
| 4.12 schedule-history floor | 4.9c | DB | `supabase/tests/database/{011,012}-*.sql`, `docs/adr/0017-*.md` |
| 4.11 settings `pausedDays` e2e | 4.9b | e2e | `e2e/support/users.ts`, `e2e/settings.spec.ts` |

| Wave | Parallel tasks (one worktree each) | Stack holder | Controller at the end of the wave |
| --- | --- | --- | --- |
| 0 | 4.0 (controller, in the integration worktree) | — | `pnpm verify` |
| 1 | 4.1 ‖ 4.4a ‖ 4.4b ‖ 4.5 ‖ 4.9a | DB: 4.9a | `pnpm verify`, then `pnpm db:reset && pnpm test:db` |
| 2 | 4.2 ‖ 4.3 ‖ 4.7 ‖ 4.10 ‖ 4.9b | DB: 4.9b | same |
| 3 | 4.6 ‖ 4.9c ‖ F1 | DB: 4.9c | same; F1: CI, review, merge to `main` (controller) |
| 4 | 4.8 ‖ 4.12 | DB: 4.12 | same, then `pnpm test:e2e --grep onboarding` |
| 5 | 4.11 | e2e: 4.11 | `pnpm verify:full` |
| 6 | — | controller | whole-branch review, one fix pass, re-review, `verify:full`, PR, CI |

- **Same-wave tasks share no file.** Each shared file has one owner per wave (last column above);
  new files belong to the task that creates them. Wave sizes are capped at five agents (M3 lost two
  agents to rate limits with more).
- **Integration worktree:** `/Users/ryan/ws/hoc-deu-int-m4` (branch `feat/m4-plan-engine`). The
  controller never switches the main checkout; it cherry-picks reviewed commits there, checks that
  the tree equals the reviewed tree (`git rev-parse HEAD^{tree}`), and verifies.
- **Task worktrees:** `/Users/ryan/ws/hoc-deu-worktrees/wt-<task>` (M3-R1), created from the
  integration branch head with `git worktree add … -b feat/m4-task-<task>`, then `pnpm install
  --frozen-lockfile`; removed with their branch after the cherry-pick. F1 uses
  `wt-f1` on `fix/m3-followups` from `origin/main`.
- **Stack lock:** the local Supabase stack is shared. Only the wave's stack task runs `pnpm
  db:reset`, `pnpm test:db` or `pnpm test:e2e`; the controller runs its post-wave checks after that
  task has finished (e2e under `/Users/ryan/ws/hoc-deu-worktrees/E2E_LOCK`). Nobody runs
  `db:stop`. Never touch the other local project, `ytb-extractor`.

**Decisions taken while writing (each is a ledger ruling; the owner can overturn any):**

1. **Execution:** subagent-driven, parallel waves in worktrees (the plan's M4 row said
   subagent-driven; the owner asked for M3-style parallelism).
2. **Task splits:** Part A 4.4 → **4.4a** (roadmap position, new-item queue, recap source) +
   **4.4b** (due queue, weak topics, practice pickers); 4.9 → **4.9a** (tables, RLS,
   `mark_plan_seen`, `RULES_VERSION` 2) + **4.9b** (`apply_event` with derived changes) + **4.9c**
   (`apply_system_event` for plans and the auto check-in); new **4.10** (content → domain
   adapter); stale-plan resume moves from 4.3 to **4.6** (it is a plan build and needs the budget
   rules); `stats/weakTopics.ts` moves from 4.7 to **4.4b** (the due-queue sort needs it).
3. **Shared vocabulary first.** Task 4.0 commits, verbatim from this section, the domain types
   every task uses (`lib/domain/catalog.ts`, `state.ts`, `srs/outcomes.ts`, `plan/types.ts`), two
   tiny helpers two same-wave tasks both need (`plan/reviewMode.ts`, `random.ts`) and the test
   fixtures (`plan/__tests__/fixtures.ts`), so parallel tasks never declare their own copies (the
   M3 wave-1 pain).
4. **`lib/domain` never imports `lib/content`** (layer rule): the engine reads a `PlanCatalog` —
   items with resolved SRS parameters and minutes per mode — built by `lib/content/plan-catalog.ts`
   (4.10). Result names map to outcomes through the domain's `RESULT_OUTCOMES`; a 4.10 test keeps
   it equal to the item-type cores' `outcomes`.
5. **No `due_items()` SQL function and no `v_weak_topics` view** (§4.3 lists both). The due list
   and weak areas exclude retired and draft items and paused or removed tracks, which only the
   catalog and the enrollments know; one rule in one place (`plan/queues.ts`,
   `stats/weakTopics.ts`). Spec §4.3 is annotated in 4.0.
6. **Columns beyond §4.1:** `plan_block_state` gains `track_id` (daily minutes per track) and
   `checked_in_on` (the local day of the first check-in, which the block counts for — an edit on
   a later day never moves it); `user_tracks` gains `reset_on`; `day_plans.roadmap_weeks` holds a
   per-track snapshot `{ variant, week, dueCount, newPerDay, throttled, reviewDebt }` (the
   dashboard's throttle message, §5.5, reads it). `day_plans.rationale` and `bot_run_id` are v1.1:
   owned by task **6.2** (the bot tables migration).
7. **Block JSON:** a block lists `items: [{ itemId, mode, minutes, overBudget? }]` instead of
   §4.1's `item_ids` + one block `mode` — a review block mixes quick-recall and redo problems and a
   deep-dive lesson, so the mode is per item. Recap blocks carry `recapWeek`, shadowing blocks
   `shadowing` (card IDs). Stored camelCase inside the JSON, like event payloads.
8. **`daily_activity`:** `minutes_by_track` and `completed` are recomputed from the blocks whose
   `checked_in_on` is that day (so an edited check-in replaces its minutes, never adds);
   `items_done` = distinct items with a counted outcome that day.
9. **`track.reset`** deletes the track's `item_state` rows and sets `user_tracks.reset_on`; events,
   plans, check-ins and daily activity stay (history, streak). Recap-done derivation ignores plans
   dated before `reset_on`. **`track.resumed`** shifts the track's `due_on` by `pausedDays` (§5.9).
   Both are set-based in SQL (4.9b) and mirrored in `project()` (4.2); a pgTAP case and a Vitest
   case run the same fixture.
10. **Derived writes carry versions.** `p_changes` = `[{ table, row }]` (snake_case rows),
    `p_expected` = `{ "<table>:<key>": version }` with `0` for a row that must not exist yet; a
    mismatch raises `version_conflict` and rolls the event back, so the caller reloads, recomputes
    and retries (≤ 3, §4.4). `p_event.local_day` (optional) is the local day the caller computed
    the change for; the database raises `day_changed` when its own `local_day` differs (a request
    crossing the day start), so an SRS due date is never computed from the wrong day.
11. **Derived tables are bounded** like the state tables (M2 ruling R14): a learner may write their
    own derived rows directly (`apply_event` is `SECURITY INVOKER`), so triggers cap `item_state`
    at 5000 rows per user, accept a new `daily_activity` row only within one day of the user's
    current local day, and a `plan_block_state` row only for a block its plan lists; and `UPDATE`
    is granted per column, never on a key column (`item_id`, `local_day`, `plan_id`, `block_id`,
    `user_id`), so an update cannot move a row out of those bounds.
12. **Untouched plan** (§2.3, §5.4 rebuilds): no `plan_block_state` row and no event carrying its
    `plan_id` other than `plan.generated` and `plan.ai_*` (the generation event itself carries the
    `plan_id`).
13. **One overshoot per track per plan.** §5.4 lets the first new item and the first recap item
    exceed the budget, and reserves fixed blocks first — but a 45-minute mock interview on a
    10-minute budget followed by a forced recap item breaks the §5.4 invariant
    (planned ≤ budget + the largest single item). Rule: the track's overshoot is **used** as soon
    as its remaining budget goes below zero, whatever caused it (a forced unit or a half-fit one);
    fixed blocks, the first recap item and the first new item may exceed the remaining budget
    **only while it is unused**, and skip / half-fit additions need a positive remainder anyway. The
    invariant then holds for every budget from 10 to 240 and every valid template, custom ones
    included (4.6 property test).
14. **Empty blocks are dropped;** a practice block that finds no item is dropped before its
    minutes are reserved (RF-4: English weeks 4–10 have no weekend prompts yet, so from week 4 the
    Sunday prompt block disappears once W1–W3's are done; the exercise block falls back to an
    introduced exercise, so it stays).
15. **Queue details §5.3 leaves open:** unlocked derived cards, ordered by their source's first
    outcome (`introducedOn`, then source ID — stable, unlike the last result), go once, into the
    earliest roadmap week that still has not-introduced items, after its recap items and before its
    extended cards; exercises are ordered by ID, not file order (the catalog keeps none for them),
    so the kinds of a week come grouped — `fill-1, fill-2, respond-1, …` — accepted; a weekly
    prompt falls back to the earliest not-introduced one of an earlier week, then to nothing; recap
    filler items use the normal review mode (Weak problem → redo).
16. **Roadmap week counts passed core items:** introduced, or not active (draft, retired, missing
    from the catalog), so a retired core problem never blocks the week, `fromWeek` or the recap.
    Publishing a draft core item the learner has already passed can move the week back by one step
    — accepted (owner-only content change).
17. **SRS edge rules:** a first-attempt fail sets Weak but is not a lapse; mastered items have
    `due_on` null; `item.readded` puts a mastered item back at the top level, due today,
    `top_successes` 0; completion-only items (lessons, exercises, prompts) get an `item_state` row
    with level 0 and status `ok`; the first-result-per-day rule applies to every item type.
18. **`RULES_VERSION` becomes 2** in 4.9a, in TypeScript and SQL together (the first version with
    plan and SRS rules). Replay supports only the current rules; an event from a later version is
    an error. **Tests that the two agree** (owner request): the existing
    `tools/db/sql-sync.test.ts` case compares `RULES_VERSION` with the last `public.rules_version()`
    definition in the migrations (static, in `pnpm test`); 4.9a adds a pgTAP assertion that the
    **running** database's `public.rules_version()` returns the value, and a sql-sync case that
    this pgTAP literal equals `RULES_VERSION` — so the constant, the migrations and the live
    function cannot disagree without a red test.
19. **`item.snapshot` payload** gains `introducedOn`, `lastResult` and `lastResultOn` (the type is
    reserved and nothing writes it yet), so a snapshot restores a full `item_state` row (4.2).
20. **Simulation inputs:** the DSA simulation reads `lib/domain/plan/sim-inputs.generated.json`
    (roadmaps, difficulties, topics and the manifest fields of §5.11, written by
    `pnpm sim:projections` and hash-checked in `tools/sim`), because `lib/domain` tests cannot read
    the catalog. The English simulation uses a fixed synthetic model (the §5.10 card counts per
    week, 0.9 derived cards per day, a weekly exercise set and weekend prompt), so English content
    PRs — the v1.1 bot's — never make it stale. The simulation may be split into several
    `plan/__tests__/simulation*.test.ts` files so Vitest runs them in parallel.
21. **Simulation thresholds are recalibrated once** (§5.10): 4.8 records the TypeScript engine's
    numbers next to each threshold. A threshold the engine meets stays as the spec wrote it; one it
    misses stops the task (`BLOCKED`, with the numbers) — the controller decides by a ledger ruling
    (engine bug, or a loosened threshold stated in the PR), never the implementer.
22. **`weeklySummary`** covers the Monday–Sunday week of a given day (Vietnamese weeks start on
    Monday); `weekdayOf` / `weekStart` live in `lib/domain/time/weekday.ts`.
23. **Streak and schedule changes (RF-1):** the dates a schedule change skips are computed from the
    schedule versions (`scheduleSkippedDays`), not assumed — so two identical consecutive versions
    (a reverted change, M2 note) skip nothing.
24. **The mock-interview problem** ("the introduced Medium problem not seen for the longest", §5.6)
    is a helper for M5's prompt page (`mockInterviewProblem`), not a second item in the block.
25. **Stale-plan resume** (§5.8): per track, a `review` block (today's weekday cap and debt rule)
    and a `new` block with exactly the stale plan's not-yet-introduced new items, under today's
    throttle, first-item and half-fit rules — items that do not fit stay not introduced; no practice
    or recap blocks.
26. **English Sundays spill** leftover minutes into new cards: §5.4 step 6 applies to any day whose
    template has neither a `new` nor a `recap` block (the prototype had no Sunday spill; 4.8
    recalibrates).
27. **M2 deferred minors absorbed:** re-enrolling a track resets `new_per_day`, `throttle`,
    `weekly_template` and `include_bonus`; `track.updated` on a removed track raises
    `track_not_enrolled`; plan events take the `(user, plan_date)` advisory lock (all in 4.9b); a
    BigInt in a free-form payload object is a `ZodError`, not a `TypeError` (4.2); identical
    schedule versions do not break the streak (4.7). **Owned by new tasks** (owner rule: nothing
    is postponed without an owning task): M2 2.4's schedule-history tightening — the next-day-start
    floor for schedule versions and the advisory lock for concurrent first versions — is task
    **4.12**; the settings `pausedDays` query test is task **4.11**, in M4 rather than M5 because
    pause / resume has been in settings since M2 and 4.9b makes `pausedDays` move due dates.
28. **M3 follow-ups:** the four PR A residuals (m1–m4) go to the separate small PR **F1**; the
    `isTimeZoneOption` cache goes to 4.7 (it is `lib/domain/time`); the real HTTP 404 for unknown
    tracks and items goes to 5.1 (it needs the loading-boundary restructure that `/today` touches);
    the Java `List<String>` bridge and Go `Constructor()` become the first step of the **M3b**
    harness task (Part A, "Before any learner reaches week 4"; 4.0 Step 2 writes it there).
29. **Tie-breaks** are by item ID (deterministic; §5 asks for a `userId + localDay` hash, which
    only matters when a random-looking spread is wanted — nothing in M4 needs one).
30. **After merge:** the controller runs `supabase db push` for the four M4 migrations on the
    production project (docs/ops/staging.md), as for M2 and M3 — first checking there that `select
    count(*) from public.events where plan_id is not null` is 0 (M2 accepted any UUID as a
    `plan_id`, and the new foreign key would fail on one).
31. **§5.12's override simulation scenario** (one `extra_week` per four weeks, two `insert_block`s)
    moves with overrides to v1.1: owned by task **6.6** (overrides and `effectiveRoadmap`); M4
    simulates the baseline engine only.
32. **One plan per local day after a resume** (§5.2, §5.9): when the last seen plan is from an
    earlier day and its first `done` / `partial` check-in happened **today**, the gate is open but
    `resumedToday` — no new plan is built today (M5's `ensurePlan` shows the resumed plan); the
    next plan comes on the next local day (4.3, 4.8).
33. **Lock order:** every path takes the `(user, plan_date)` advisory lock **before** any row lock —
    `apply_system_event` used to lock the profile row first, and `apply_event`'s event insert takes
    a key-share lock on the same profile row after its advisory lock, a deadlock between a learner
    check-in and an auto check-in or a rebuild. The key comes from one helper,
    `public.plan_lock_key(user, date)` (4.9a).
34. **Check-in minutes are whole numbers** (`block.checked_in` and `plan_block_state.minutes` are
    integers, but card minutes are 1.5 / 0.5): the one-tap and auto check-in pre-fill
    `checkInMinutes(block) = Math.ceil(block.estMinutes)` (4.6).

**Review focus for M4** — inputs the spec implies but no happy-path test exercises; each line's test
is in the task named (the plan-level RF-1…RF-5 lines are marked where they land):

1. **Tiny budgets and big fixed blocks** — 10 minutes a day, a 45-minute mock interview, a 50-minute
   Hard problem: the plan stays within budget + one item and still gives work (4.5, 4.6 property
   test **I1**, decision 13).
2. **Content holes** — a missing roadmap file, a week without a lesson, a retired or draft core
   item, English weeks without exercises or weekend prompts, an empty catalog: a valid (possibly
   empty) plan, the roadmap week never stuck, the gate never stuck on an empty plan (4.3, 4.4a,
   4.4b, 4.6 — **[RF-4]**).
3. **Long absence** — weeks away with 100+ reviews due: debt cap, throttle, Weak-first order,
   "Học tiếp hôm nay" without advancing the pointer (4.3, 4.4b, 4.5, 4.6 — **[RF-5]**).
4. **Same-day and repeated writes** — a second result on the same day, a check-in edited on a
   later day, the same event sent twice, two tabs racing on one row, a request crossing the day
   start (4.1, 4.2, 4.9b — **[RF-2]**, decision 10).
5. **Reset, pause and schedule changes** — reset then study again, pause across days, re-enroll a
   removed track, move east over a date: TypeScript and SQL agree, the streak survives
   (4.2, 4.7, 4.9b — **[RF-1]**).

**Changes to the spec, Part A and the plan header** (applied in task 4.0): the "Execution status"
bullet gains "M4: step-level detail in Part B-M4"; the Execution methods row for M4 becomes
"Subagent-driven, parallel waves in git worktrees (owner request 2026-09-25)"; under the M4 table a
note "**Part B-M4 changes to this table**" (decisions 2, 5, 28, 31); Part A row 5.1 gains "the
real HTTP 404 for unknown tracks and items (M3 follow-up)", "no second plan on a resume day
(`gateStatus().resumedToday`, decision 32)" and "settings, track add / pause / remove / reset
rebuild today's plan while it is untouched (`storePlan` mode `rebuild`, §5.4, §5.9)"; Part A row 5.2
gains "one-tap and auto check-in minutes = `checkInMinutes(block)` (decision 34)"; the M4 table
gains rows 4.10 (adapter), 4.11 (`pausedDays` e2e) and 4.12 (schedule-history floor); the
"Before any learner reaches week 4" block names the **M3b** harness task and its first step, "the
Java harness bridges `List<String>` parameters and Go design classes are created via
`Constructor()` (problems 139, 127, 271)" (decision 28); spec §4.3 annotates `due_items()` and
`v_weak_topics` as "not built — computed in TypeScript (implementation plan Part B-M4 decision 5)";
spec §4.1 notes the added columns (decision 6) and the block item shape (decision 7); spec §4.4 notes
the `item.snapshot` payload fields (decision 19); `docs/adr/README.md` links rows 0008, 0014, 0016
and 0037 with their final file names (`0008-rules-version.md`,
`0014-simulation-backed-srs-parameters.md`, `0016-gate-on-last-seen-plan.md`,
`0037-projection-inputs-hash.md`) — tasks only create the files.

**Subagent contract for every task** (M3's contract, plus): read `CLAUDE.md`, the platform-design
sections the task cites and this task's text; TDD (superpowers:test-driven-development) — the
listed tests fail first; `pnpm verify` green before the commit (plus `pnpm test:db` for 4.9a–c
and 4.12, `pnpm test:e2e` for 4.11, each only while holding the stack lock); never read `.env*` other than the
committed template `.env.example`, and never `docs/credentials/`; no subagents.

- Work only in the worktree and branch named in your brief; commit there; never push; never touch
  the main checkout, the integration worktree or another task's worktree.
- Change no dependency (`pnpm install --frozen-lockfile` only); if something is missing, stop and
  report `BLOCKED`.
- Edit only the shared files your task owns (the schedule table); anything else shared → ask the
  controller.
- **`lib/domain` rules:** imports only from `lib/domain` and `zod` (tests also `vitest` and
  `fast-check`); no `Date.now()`, argument-less `new Date()`, local-time getters or
  `Math.random()`; `now` and `localDay` are parameters. No `case '<item type>'` anywhere outside
  `lib/content` and `features/items` — compare `item.itemType === block.itemType` instead.
- **Immutability:** no function mutates its inputs; tests freeze inputs where it matters
  (`Object.freeze` on the fixture objects they pass).
- **Types come from 4.0.** Import `PlanCatalog`, `PlanItem`, `ItemState`, `PlanBlock`,
  `PlanContext`, … from `lib/domain/{catalog,state}.ts` and `lib/domain/plan/types.ts`; never
  redeclare them. If one must change, stop and ask the controller.
- Tests use the fixtures in `lib/domain/plan/__tests__/fixtures.ts` (copy and change; never edit
  the file — it is shared) and may add task-local fixtures next to their tests.
- Merged migrations are never edited; each DB task adds its own migration file (timestamps below).
  Regenerate `lib/supabase/database.types.ts` with `pnpm db:types` after a schema change (CI's
  `db` job diffs it).
- Report: files changed, the commit(s), the verification output (test counts), and anything you
  decided that this section does not say.

### Task 4.0: Plan commit, dependencies and shared domain types (controller)

**Files:**

- Modify: `docs/plans/2026-09-24-implementation-plan.md` (this section + the header / Part A
  changes above), `docs/plans/2026-09-23-platform-design.md` (§4.1, §4.3, §4.4 notes),
  `docs/adr/README.md` (rows 0008, 0014, 0016, 0037 linked), `package.json`, `pnpm-lock.yaml`
- Create: `lib/domain/catalog.ts`, `lib/domain/state.ts`, `lib/domain/srs/outcomes.ts`,
  `lib/domain/plan/types.ts`, `lib/domain/plan/reviewMode.ts`, `lib/domain/random.ts`,
  `lib/domain/plan/__tests__/fixtures.ts` (verbatim below)

- [ ] **Step 1: Integration worktree** (done while writing this section):
  `git worktree add /Users/ryan/ws/hoc-deu-int-m4 -b feat/m4-plan-engine origin/main`, `pnpm
  install --frozen-lockfile`. All controller work for M4 happens there.
- [ ] **Step 2: Plan commit** — this section alone was committed at the owner-review stop
  (`docs: Part B-M4 step-level plan`). After the owner's approval (and any changes the review asks
  for), apply the header / Part A / spec / ADR-index changes listed above. Commit `docs: apply
  Part B-M4 decisions to the plan header, Part A and the spec`.
- [ ] **Step 3: Dependency (Q1)** — if the owner approved: `pnpm add --save-exact -D
  fast-check@4.10.2`, then `pnpm verify`. Commit `build(deps): fast-check for the plan-engine
  property tests`. If declined: skip — 4.4a and 4.6 then draw their property inputs from
  `mulberry32` (`lib/domain/random.ts`, Step 4).
- [ ] **Step 4: Shared domain types, helpers and fixtures** — create the seven files below exactly
  as written, run `pnpm verify` (they compile and pass the guards; `reviewMode` is tested in 4.4b,
  `mulberry32` in 4.8). Commit `feat(domain): shared plan-engine types, helpers and test
  fixtures`.

`lib/domain/catalog.ts`:

```ts
/**
 * The plan engine's view of the content catalog (platform design §3, §5): what the engine reads
 * about tracks, roadmaps and items, already resolved — SRS parameters per item (track `srs` plus
 * `srs.byType`) and minutes per mode (manifest `estimates` / `review`). `lib/domain` never imports
 * `lib/content`: `lib/content/plan-catalog.ts` (task 4.10) builds this from the generated catalog,
 * the simulation builds it from its inputs (4.8), and tests build it by hand
 * (`plan/__tests__/fixtures.ts`).
 */

export type ContentStatus = 'draft' | 'active' | 'retired'

/** How an item is studied in a plan block (§5.4, §5.5); `lib/content` `Mode` has the same members. */
export const ITEM_MODES = ['new', 'review', 'recall', 'redo', 'explain-aloud'] as const
export type ItemMode = (typeof ITEM_MODES)[number]

export type SrsParams = {
  readonly intervals: readonly number[]
  readonly relearnDays: number
  readonly masteredAfter: number
}

export type Difficulty = 'E' | 'M' | 'H'
export type CardTier = 'core' | 'extended' | 'derived'

export type PlanItem = {
  readonly id: string
  readonly trackId: string
  /** Compared by equality only (a practice block's `itemType`); never switched on (§7.2). */
  readonly itemType: string
  readonly topicId: string | null
  /** The authored week: a card's deck, an exercise, a weekly prompt; otherwise null. */
  readonly week: number | null
  readonly status: ContentStatus
  /** Resolved SRS parameters, or null for completion-only item types (§5.7 `srs: true`). */
  readonly srs: SrsParams | null
  /** Minutes per mode (§5.4 estimates; decision 12 of Part B-M3 for explain-aloud). */
  readonly minutes: Readonly<Record<ItemMode, number>>
  /** Problems: reviewed by quick recall, or redo when Weak (§5.5). Cards: plain review. */
  readonly reviewModes: boolean
  readonly difficulty: Difficulty | null
  readonly tier: CardTier | null
  readonly deckId: string | null
  /** A derived card's source item (§3.4); null otherwise. */
  readonly derivedFrom: string | null
  /** A deep-dive lesson's problem (§3.3 `about`); null for a pattern lesson and non-lessons. */
  readonly about: string | null
  /** A problem's deep-dive lesson (§5.4 step 3), whatever that lesson's status; null otherwise. */
  readonly deepDiveId: string | null
  /** Prompts: the tag a practice block picks them by. */
  readonly tag: string | null
  /** Prompts: repeatable ones (the mock interview) have no week. */
  readonly repeatable: boolean
  /** Cards with an example sentence (shadowing, §5.6). */
  readonly hasExample: boolean
}

export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'
export type TemplateDayKey = 'mon-fri' | Weekday

/** A weekly-template block (§3.4, §5.4) — the manifest's `templateBlockSchema`, as data. */
export type PlanTemplateBlock =
  | { readonly kind: 'review'; readonly maxMinutes?: number; readonly fromWeek?: number }
  | { readonly kind: 'new'; readonly fromWeek?: number }
  | { readonly kind: 'recap'; readonly count: number; readonly fromWeek?: number }
  | {
      readonly kind: 'practice'
      readonly minutes: number
      readonly tag?: string
      readonly itemType?: string
      readonly fromWeek?: number
    }

export type PlanWeeklyTemplate = Readonly<
  Partial<Record<TemplateDayKey, readonly PlanTemplateBlock[]>>
>

export type ThrottleRule = { readonly dueAbove: number; readonly newPerDay: number }

export type RecapMode = 'recall' | 'redo' | 'explain-aloud'

export type PlanRoadmapWeek = {
  readonly week: number
  readonly topics: readonly string[]
  readonly core: readonly string[]
  readonly bonus: readonly string[]
  /** An entry without a mode introduces its item (§5.3 step 3). */
  readonly recap: readonly { readonly item: string; readonly mode?: RecapMode }[]
  /** Deck IDs; their `core` / `extended` cards belong to this week. */
  readonly decks: readonly string[]
}

export type PlanRoadmap = { readonly id: string; readonly weeks: readonly PlanRoadmapWeek[] }

export type PlanTrack = {
  readonly id: string
  readonly status: ContentStatus
  readonly weeklyTemplate: PlanWeeklyTemplate
  readonly defaults: {
    readonly budgetMinutes: number
    readonly newPerDay: number | null
    readonly throttle: readonly ThrottleRule[]
  }
  /** Variant → roadmap, for the roadmap files that exist (a missing one is coverage, M3 dec. 4). */
  readonly roadmaps: Readonly<Record<string, PlanRoadmap>>
}

/** An authored deck; `cardIds` in file order. Derived decks are not listed (their cards are). */
export type PlanDeck = {
  readonly id: string
  readonly trackId: string
  readonly status: ContentStatus
  readonly cardIds: readonly string[]
}

export type PlanCatalog = {
  readonly tracks: Readonly<Record<string, PlanTrack>>
  readonly items: Readonly<Record<string, PlanItem>>
  readonly decks: Readonly<Record<string, PlanDeck>>
}
```

`lib/domain/state.ts`:

```ts
/**
 * Derived state (platform design §4.1): the rows of `item_state`, `plan_block_state` and
 * `daily_activity` as the engine sees them — no `version` / `rules_version`, which are persistence
 * concerns (`lib/events/derived.ts`, task 4.9b). `projection/project.ts` computes them from events.
 */
import type { LocalDay } from './time/localDay'

/** §5.7 status; no row = not started. */
export const ITEM_STATE_STATUSES = ['weak', 'ok', 'strong', 'mastered', 'skipped'] as const
export type ItemStateStatus = (typeof ITEM_STATE_STATUSES)[number]

export type ItemState = {
  readonly itemId: string
  readonly trackId: string
  readonly topicId: string | null
  readonly itemType: string
  /** SRS level 1…N; 0 = not in spaced repetition (completion-only or skipped items). */
  readonly level: number
  readonly weak: boolean
  readonly topSuccesses: number
  readonly status: ItemStateStatus
  /** The next review day; null when not scheduled (completion-only, skipped, mastered). */
  readonly dueOn: LocalDay | null
  /** The raw result of the last counted outcome: `solved`, `know`, `pass`, `completed`, … */
  readonly lastResult: string | null
  readonly lastResultOn: LocalDay | null
  /** The local day of the first recorded outcome, `item.skipped` included (§5.3). */
  readonly introducedOn: LocalDay
  readonly lapses: number
  readonly reps: number
}

export const CHECK_IN_STATUSES = ['done', 'partial', 'skipped'] as const
export type CheckInStatus = (typeof CHECK_IN_STATUSES)[number]

export type BlockState = {
  readonly planId: string
  readonly blockId: string
  readonly trackId: string
  readonly status: CheckInStatus
  readonly minutes: number
  readonly note: string | null
  readonly auto: boolean
  /** The local day of the block's first check-in: the `daily_activity` day it counts for. */
  readonly checkedInOn: LocalDay
}

export type DailyActivity = {
  readonly localDay: LocalDay
  readonly minutesByTrack: Readonly<Record<string, number>>
  /** Distinct items with a counted outcome that day. */
  readonly itemsDone: number
  /** At least one block checked in `done` or `partial` that day (§4.1). */
  readonly completed: boolean
}

export type DerivedState = {
  readonly items: Readonly<Record<string, ItemState>>
  /** Keyed by `blockKey(planId, blockId)`. */
  readonly blocks: Readonly<Record<string, BlockState>>
  readonly days: Readonly<Record<LocalDay, DailyActivity>>
}

export const EMPTY_DERIVED_STATE: DerivedState = { items: {}, blocks: {}, days: {} }

export function blockKey(planId: string, blockId: string): string {
  return `${planId}/${blockId}`
}
```

`lib/domain/srs/outcomes.ts`:

```ts
/** SRS outcomes (platform design §5.7) and the result names that map to them (§4.4). */

export const OUTCOMES = ['success', 'partial', 'fail'] as const
export type Outcome = (typeof OUTCOMES)[number]

/**
 * Every `item.result` result name → its outcome. The item-type cores in `lib/content` carry the
 * same mapping per type; `lib/content/plan-catalog.test.ts` (task 4.10) keeps them equal.
 */
export const RESULT_OUTCOMES = {
  solved: 'success',
  hint: 'partial',
  failed: 'fail',
  know: 'success',
  unsure: 'partial',
  dont_know: 'fail',
} as const satisfies Record<string, Outcome>

export type ResultName = keyof typeof RESULT_OUTCOMES
```

`lib/domain/plan/types.ts`:

```ts
/**
 * Plans (platform design §4.1 `day_plans`, §5.4): the blocks `buildPlan` produces and
 * `day_plans.blocks` stores, the per-track snapshot stored in `day_plans.roadmap_weeks`, and the
 * inputs of a plan build. The Zod schemas validate the JSON read back from the database (M5).
 */
import { z } from 'zod'
import {
  ITEM_MODES,
  type PlanCatalog,
  type PlanWeeklyTemplate,
  type ThrottleRule,
} from '../catalog'
import type { ItemState } from '../state'
import type { LocalDay } from '../time/localDay'

export const BLOCK_KINDS = ['review', 'new', 'recap', 'practice', 'extra'] as const
export type BlockKind = (typeof BLOCK_KINDS)[number]

export const planBlockItemSchema = z.strictObject({
  itemId: z.string().min(1).max(128),
  mode: z.enum(ITEM_MODES),
  minutes: z.number().min(0).max(600),
  /** The first new item that exceeds the remaining budget ("dài hơn thời gian dự kiến", §5.4). */
  overBudget: z.literal(true).optional(),
})
export type PlanBlockItem = z.infer<typeof planBlockItemSchema>

export const planBlockSchema = z.strictObject({
  /** `<planDate>:<trackId>:<kind>:<n>`, n = 1, 2, … per kind within the track (§5.4 step 8). */
  id: z.string().min(1).max(128),
  trackId: z.string().min(1).max(32),
  kind: z.enum(BLOCK_KINDS),
  /** The sum of the items' minutes; a practice block's fixed length. */
  estMinutes: z.number().min(0).max(600),
  items: z.array(planBlockItemSchema).max(500),
  /** Practice blocks: the template's tag or item type. */
  tag: z.string().min(1).max(32).optional(),
  itemType: z.string().min(1).max(32).optional(),
  /** Recap blocks: the roadmap week whose recap this is (§5.6); null for filler-only recaps. */
  recapWeek: z.number().int().positive().nullable().optional(),
  /** Shadowing blocks: the cards whose example sentences are read aloud (§5.6). */
  shadowing: z.array(z.string().min(1).max(128)).max(10).optional(),
})
export type PlanBlock = z.infer<typeof planBlockSchema>

/** Per-track facts at plan time (`day_plans.roadmap_weeks`): the week snapshot and the throttle. */
export const trackSnapshotSchema = z.strictObject({
  variant: z.string().min(1).max(32),
  week: z.number().int().positive(),
  dueCount: z.number().int().min(0),
  /** The effective new-item cap (§5.5); null = no cap. */
  newPerDay: z.number().int().min(0).nullable(),
  throttled: z.boolean(),
  reviewDebt: z.boolean(),
})
export type TrackSnapshot = z.infer<typeof trackSnapshotSchema>

export const PLAN_MODES = ['baseline', 'resume'] as const
export type PlanMode = (typeof PLAN_MODES)[number]

/** What `buildPlan` / `buildResumePlan` return — a plan not stored yet. */
export type DayPlan = {
  readonly planDate: LocalDay
  readonly mode: PlanMode
  readonly blocks: readonly PlanBlock[]
  readonly tracks: Readonly<Record<string, TrackSnapshot>>
}

/** A `day_plans` row as the engine reads it. */
export type StoredPlan = {
  readonly id: string
  readonly planDate: LocalDay
  readonly version: number
  readonly source: 'baseline' | 'ai'
  /** Set once, when `/today` first renders the plan in the browser (§5.2); null = never seen. */
  readonly seenAt: string | null
  readonly blocks: readonly PlanBlock[]
  readonly tracks: Readonly<Record<string, TrackSnapshot>>
}

/** A `user_tracks` row with every track default resolved (`lib/content/plan-catalog.ts`, 4.10). */
export type Enrollment = {
  readonly trackId: string
  readonly variant: string
  readonly status: 'active' | 'paused' | 'removed'
  readonly startDate: LocalDay
  readonly budgetMinutes: number
  /** Null = no daily cap on new SRS items. */
  readonly newPerDay: number | null
  readonly throttle: readonly ThrottleRule[]
  readonly weeklyTemplate: PlanWeeklyTemplate
  readonly includeBonus: boolean
  /** The local day of the last `track.reset` (4.9b); plans before it do not count (4.3). */
  readonly resetOn: LocalDay | null
}

/** Everything `buildPlan` reads (§5.4) — loaded by M5's `ensurePlan`, never by the engine. */
export type PlanContext = {
  readonly planDate: LocalDay
  readonly catalog: PlanCatalog
  readonly enrollments: readonly Enrollment[]
  /** Every `item_state` row of the user, all tracks (derived cards unlock from other tracks). */
  readonly items: Readonly<Record<string, ItemState>>
  /** Track → roadmap weeks whose recap is done (`recapWeeksDone`, 4.3). */
  readonly recapDone: Readonly<Record<string, ReadonlySet<number>>>
}
```

`lib/domain/plan/__tests__/fixtures.ts`:

```ts
/**
 * Hand-built catalogs and state for the plan-engine tests (Part B-M4, task 4.0). Small on
 * purpose: two DSA weeks and two English weeks with every case the engine branches on — a pattern
 * and a deep-dive lesson, a recap entry that introduces its item, a bonus and a retired core
 * problem, a repeatable prompt, core / extended / derived cards, cards with and without an
 * example, weekly exercises and prompts. Tests copy and change them; they never mutate them.
 */
import type {
  ItemMode,
  PlanCatalog,
  PlanItem,
  PlanRoadmap,
  PlanTrack,
  PlanWeeklyTemplate,
  SrsParams,
} from '../../catalog'
import type { ItemState } from '../../state'
import type { LocalDay } from '../../time/localDay'
import type { Enrollment, PlanContext } from '../types'

export const DSA_SRS: SrsParams = { intervals: [7, 21, 60], relearnDays: 3, masteredAfter: 2 }
export const DSA_CARD_SRS: SrsParams = {
  intervals: [1, 3, 7, 14],
  relearnDays: 1,
  masteredAfter: 2,
}
export const ENGLISH_SRS: SrsParams = { intervals: [1, 3, 7, 14], relearnDays: 1, masteredAfter: 2 }

/** Every mode costs `minutes`. */
export const flat = (minutes: number): Record<ItemMode, number> => ({
  new: minutes,
  review: minutes,
  recall: minutes,
  redo: minutes,
  'explain-aloud': minutes,
})

/** DSA problem minutes (§5.4): new E/M/H 20/35/50, recall and explain-aloud 5, redo ×0.6. */
const PROBLEM_MINUTES = {
  E: { new: 20, review: 5, recall: 5, redo: 12, 'explain-aloud': 5 },
  M: { new: 35, review: 5, recall: 5, redo: 21, 'explain-aloud': 5 },
  H: { new: 50, review: 5, recall: 5, redo: 30, 'explain-aloud': 5 },
} as const satisfies Record<string, Record<ItemMode, number>>

const CARD_MINUTES: Record<ItemMode, number> = {
  new: 1.5,
  review: 0.5,
  recall: 0.5,
  redo: 0.5,
  'explain-aloud': 0.5,
}

/** A plan item with neutral defaults; pass what the test is about. */
export function planItem(
  item: Partial<PlanItem> & Pick<PlanItem, 'id' | 'trackId' | 'itemType'>,
): PlanItem {
  return {
    topicId: null,
    week: null,
    status: 'active',
    srs: null,
    minutes: flat(10),
    reviewModes: false,
    difficulty: null,
    tier: null,
    deckId: null,
    derivedFrom: null,
    about: null,
    deepDiveId: null,
    tag: null,
    repeatable: false,
    hasExample: false,
    ...item,
  }
}

const problem = (
  id: string,
  difficulty: 'E' | 'M' | 'H',
  topicId: string,
  extra: Partial<PlanItem> = {},
): PlanItem =>
  planItem({
    id,
    trackId: 'dsa',
    itemType: 'problem',
    topicId,
    difficulty,
    srs: DSA_SRS,
    minutes: PROBLEM_MINUTES[difficulty],
    reviewModes: true,
    ...extra,
  })

const lesson = (id: string, topicId: string, about: string | null = null): PlanItem =>
  planItem({ id, trackId: 'dsa', itemType: 'lesson', topicId, about, minutes: flat(25) })

const card = (
  id: string,
  deckId: string,
  week: number,
  tier: 'core' | 'extended',
  hasExample: boolean,
): PlanItem =>
  planItem({
    id,
    trackId: 'english',
    itemType: 'flashcard',
    topicId: week === 1 ? 'standup' : 'tickets',
    week,
    srs: ENGLISH_SRS,
    minutes: CARD_MINUTES,
    tier,
    deckId,
    hasExample,
  })

const derivedCard = (source: string): PlanItem =>
  planItem({
    id: `english:explaining-code:${source}`,
    trackId: 'english',
    itemType: 'flashcard',
    srs: ENGLISH_SRS,
    minutes: CARD_MINUTES,
    tier: 'derived',
    derivedFrom: source,
  })

const exercise = (id: string, week: number): PlanItem =>
  planItem({ id, trackId: 'english', itemType: 'exercise', week, minutes: flat(5) })

const weeklyPrompt = (id: string, week: number): PlanItem =>
  planItem({
    id,
    trackId: 'english',
    itemType: 'prompt',
    week,
    tag: 'weekend-task',
    minutes: flat(10),
  })

export const DSA_TEMPLATE: PlanWeeklyTemplate = {
  'mon-fri': [{ kind: 'review', maxMinutes: 15 }, { kind: 'new' }],
  sat: [{ kind: 'review' }],
  sun: [
    { kind: 'practice', tag: 'mock-interview', minutes: 45, fromWeek: 3 },
    { kind: 'recap', count: 3 },
  ],
}

export const ENGLISH_TEMPLATE: PlanWeeklyTemplate = {
  'mon-fri': [
    { kind: 'practice', itemType: 'exercise', minutes: 5 },
    { kind: 'practice', tag: 'shadowing', minutes: 3 },
    { kind: 'review' },
    { kind: 'new' },
  ],
  sat: [{ kind: 'review' }],
  sun: [{ kind: 'practice', tag: 'weekend-task', minutes: 15 }, { kind: 'review' }],
}

/** Two DSA weeks. W1 recap introduces p4; W2 lists a retired core problem (p8) and a bonus (p7). */
export const DSA_8W: PlanRoadmap = {
  id: '8w',
  weeks: [
    {
      week: 1,
      topics: ['arrays'],
      core: ['dsa:p1', 'dsa:p2', 'dsa:p3'],
      bonus: [],
      recap: [
        { item: 'dsa:p4' },
        { item: 'dsa:p2', mode: 'redo' },
        { item: 'dsa:p1', mode: 'explain-aloud' },
      ],
      decks: [],
    },
    {
      week: 2,
      topics: ['two-pointers'],
      core: ['dsa:p5', 'dsa:p6', 'dsa:p8'],
      bonus: ['dsa:p7'],
      recap: [{ item: 'dsa:p3', mode: 'redo' }],
      decks: [],
    },
  ],
}

export const DSA_TRACK: PlanTrack = {
  id: 'dsa',
  status: 'active',
  weeklyTemplate: DSA_TEMPLATE,
  defaults: { budgetMinutes: 60, newPerDay: null, throttle: [] },
  roadmaps: { '8w': DSA_8W },
}

export const ENGLISH_10W: PlanRoadmap = {
  id: '10w',
  weeks: [
    { week: 1, topics: ['standup'], core: [], bonus: [], recap: [], decks: ['english:deck-w1'] },
    { week: 2, topics: ['tickets'], core: [], bonus: [], recap: [], decks: ['english:deck-w2'] },
  ],
}

export const ENGLISH_TRACK: PlanTrack = {
  id: 'english',
  status: 'active',
  weeklyTemplate: ENGLISH_TEMPLATE,
  defaults: {
    budgetMinutes: 25,
    newPerDay: 8,
    throttle: [
      { dueAbove: 40, newPerDay: 4 },
      { dueAbove: 60, newPerDay: 0 },
    ],
  },
  roadmaps: { '10w': ENGLISH_10W },
}

const byId = (items: readonly PlanItem[]): Record<string, PlanItem> =>
  Object.fromEntries(items.map((item) => [item.id, item]))

export const DSA_ITEMS: readonly PlanItem[] = [
  lesson('dsa:lesson-arrays', 'arrays'),
  lesson('dsa:lesson-two-pointers', 'two-pointers'),
  lesson('dsa:lesson-deep-dive-p3', 'arrays', 'dsa:p3'),
  problem('dsa:p1', 'E', 'arrays'),
  problem('dsa:p2', 'M', 'arrays'),
  problem('dsa:p3', 'M', 'arrays', { deepDiveId: 'dsa:lesson-deep-dive-p3' }),
  problem('dsa:p4', 'H', 'arrays'),
  problem('dsa:p5', 'E', 'two-pointers'),
  problem('dsa:p6', 'M', 'two-pointers'),
  problem('dsa:p7', 'M', 'two-pointers'),
  problem('dsa:p8', 'M', 'two-pointers', { status: 'retired' }),
  planItem({
    id: 'dsa:prompt-mock',
    trackId: 'dsa',
    itemType: 'prompt',
    tag: 'mock-interview',
    repeatable: true,
    minutes: flat(45),
  }),
]

export const ENGLISH_ITEMS: readonly PlanItem[] = [
  card('english:e1', 'english:deck-w1', 1, 'core', true),
  card('english:e2', 'english:deck-w1', 1, 'core', true),
  card('english:e3', 'english:deck-w1', 1, 'core', false),
  card('english:e4', 'english:deck-w1', 1, 'core', false),
  card('english:x1', 'english:deck-w1', 1, 'extended', true),
  card('english:x2', 'english:deck-w1', 1, 'extended', false),
  card('english:e5', 'english:deck-w2', 2, 'core', true),
  card('english:e6', 'english:deck-w2', 2, 'core', false),
  derivedCard('dsa:p1'),
  derivedCard('dsa:p2'),
  exercise('english:ex-w1-a', 1),
  exercise('english:ex-w1-b', 1),
  exercise('english:ex-w2-a', 2),
  weeklyPrompt('english:prompt-w1', 1),
  weeklyPrompt('english:prompt-w2', 2),
]

/** DSA and English together: derived English cards unlock from DSA problems. */
export const CATALOG: PlanCatalog = {
  tracks: { dsa: DSA_TRACK, english: ENGLISH_TRACK },
  items: byId([...DSA_ITEMS, ...ENGLISH_ITEMS]),
  decks: {
    'english:deck-w1': {
      id: 'english:deck-w1',
      trackId: 'english',
      status: 'active',
      cardIds: ['english:e1', 'english:e2', 'english:e3', 'english:e4', 'english:x1', 'english:x2'],
    },
    'english:deck-w2': {
      id: 'english:deck-w2',
      trackId: 'english',
      status: 'active',
      cardIds: ['english:e5', 'english:e6'],
    },
  },
}

export const EMPTY_CATALOG: PlanCatalog = { tracks: {}, items: {}, decks: {} }

/** A copy of `catalog` with `changes` applied to the named items. */
export function withItems(
  catalog: PlanCatalog,
  changes: Readonly<Record<string, Partial<PlanItem>>>,
): PlanCatalog {
  const items = { ...catalog.items }
  for (const [id, change] of Object.entries(changes)) {
    const item = items[id]
    if (item === undefined) throw new Error(`withItems: no item ${id}`)
    items[id] = { ...item, ...change }
  }
  return { ...catalog, items }
}

/**
 * An item's state as a fresh success at level 1 would leave it, introduced on `day`; pass the
 * fields the test is about. `trackId`, `topicId` and `itemType` come from `CATALOG`.
 */
export function itemState(
  itemId: string,
  day: LocalDay,
  state: Partial<ItemState> = {},
  catalog: PlanCatalog = CATALOG,
): ItemState {
  const item = catalog.items[itemId]
  if (item === undefined) throw new Error(`itemState: no item ${itemId}`)
  return {
    itemId,
    trackId: item.trackId,
    topicId: item.topicId,
    itemType: item.itemType,
    level: item.srs === null ? 0 : 1,
    weak: false,
    topSuccesses: 0,
    status: 'ok',
    dueOn: null,
    lastResult: item.srs === null ? 'completed' : 'solved',
    lastResultOn: day,
    introducedOn: day,
    lapses: 0,
    reps: 1,
    ...state,
  }
}

/** Item states by ID. */
export const statesOf = (...states: readonly ItemState[]): Record<string, ItemState> =>
  Object.fromEntries(states.map((state) => [state.itemId, state]))

/** An active enrollment with the track's defaults (DSA 8w, English 10w), starting 2026-09-28. */
export function enrollment(
  trackId: 'dsa' | 'english',
  change: Partial<Enrollment> = {},
): Enrollment {
  const track = CATALOG.tracks[trackId]
  if (track === undefined) throw new Error(`enrollment: no track ${trackId}`)
  return {
    trackId,
    variant: trackId === 'dsa' ? '8w' : '10w',
    status: 'active',
    startDate: '2026-09-28',
    budgetMinutes: track.defaults.budgetMinutes,
    newPerDay: track.defaults.newPerDay,
    throttle: track.defaults.throttle,
    weeklyTemplate: track.weeklyTemplate,
    includeBonus: false,
    resetOn: null,
    ...change,
  }
}

/** 2026-09-28 is a Monday; 2026-10-03 a Saturday; 2026-10-04 a Sunday. */
export const MONDAY = '2026-09-28'
export const SATURDAY = '2026-10-03'
export const SUNDAY = '2026-10-04'

/** A plan context on `MONDAY` with both tracks enrolled and nothing studied yet. */
export function planContext(change: Partial<PlanContext> = {}): PlanContext {
  return {
    planDate: MONDAY,
    catalog: CATALOG,
    enrollments: [enrollment('dsa'), enrollment('english')],
    items: {},
    recapDone: {},
    ...change,
  }
}
```

`lib/domain/plan/reviewMode.ts`:

```ts
/** How a due item is reviewed (platform design §5.5) — shared by the due queue and the recap. */
import type { ItemMode, PlanItem } from '../catalog'
import type { ItemState } from '../state'

/** Problems (`reviewModes`): redo when Weak, quick recall otherwise. Anything else: 'review'. */
export function reviewMode(item: PlanItem, state: ItemState): ItemMode {
  if (!item.reviewModes) return 'review'
  return state.weak ? 'redo' : 'recall'
}
```

`lib/domain/random.ts`:

```ts
/**
 * A seeded pseudo-random generator (mulberry32) for the simulation (§5.10) and property tests:
 * the same seed gives the same sequence on every machine. Never `Math.random()` in `lib/domain`.
 */

/** Floats in [0, 1), deterministic for `seed` (any 32-bit integer). */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
```

- [ ] **Step 5:** write the dispatch context file
  `.superpowers/sdd/2026-09-24-implementation-plan/m4-context.md` (Global Constraints, this
  section's header, decisions and contract) and record wave 0 in the ledger.

### Task 4.1: SRS transitions

**Spec:** §5.7 (table, outcomes, first result per day, mastery, readd, status). **Files:**

- Create: `lib/domain/srs/applyResult.ts`, `lib/domain/srs/applyResult.test.ts`

**Interfaces:**

- Consumes: `SrsParams` (`catalog.ts`), `ItemState`, `ItemStateStatus` (`state.ts`), `Outcome`
  (`srs/outcomes.ts`), `LocalDay`, `addDays` (`time/localDay.ts`).
- Produces (4.2 and 4.8 rely on these names):

```ts
// lib/domain/srs/applyResult.ts
/** The spaced-repetition fields of an item's state (§5.7). */
export type SrsState = Pick<
  ItemState,
  'level' | 'weak' | 'topSuccesses' | 'status' | 'dueOn' | 'lastResultOn' | 'lapses' | 'reps'
>

/** An item with no row yet (§5.7 "not started"). */
export const NOT_STARTED: SrsState // { level: 0, weak: false, topSuccesses: 0, status: 'ok',
//                                     dueOn: null, lastResultOn: null, lapses: 0, reps: 0 }

/** Weak → 'weak'; level ≥ N with topSuccesses ≥ masteredAfter → 'mastered'; level ≥ 3 →
 *  'strong'; else 'ok' (N = params.intervals.length). */
export function srsStatus(
  level: number,
  weak: boolean,
  topSuccesses: number,
  params: SrsParams,
): Exclude<ItemStateStatus, 'skipped'>

/** One result on `day` (the local day of the result, §5.7). Returns `state` itself (the same
 *  object) when `state.lastResultOn === day` — only the first result per item per day counts. */
export function applyResult(
  state: SrsState,
  outcome: Outcome,
  day: LocalDay,
  params: SrsParams,
): SrsState

/** `item.readded` (§5.7): a mastered item back at the top level, due `day`, topSuccesses 0.
 *  Any other state is returned unchanged (the same object). Not a result: lastResultOn and reps
 *  stay. */
export function readd(state: SrsState, day: LocalDay, params: SrsParams): SrsState
```

**Rules** (N = `params.intervals.length`; L = `Math.min(state.level, N)` — a level above N after the
manifest shortened its intervals is treated as N; level 0 is "not started" whatever the status,
so a skipped item that gets a result starts SRS):

| Current | Outcome | level | weak | topSuccesses | lapses | dueOn |
| --- | --- | --- | --- | --- | --- | --- |
| L = 0 | success / partial | 1 | false | 0 | same | day + intervals[0] |
| L = 0 | fail | 1 | **true** | 0 | same (a first attempt is not a lapse) | day + relearnDays |
| 1 ≤ L < N | success | L + 1 | false | same | same | day + intervals[L] |
| L = N | success | N | false | + 1 | same | day + intervals[N − 1] |
| L ≥ 1 | partial | L | same | same | same | day + intervals[L − 1] |
| L ≥ 1 | fail | 1 | **true** | 0 | + 1 | day + relearnDays |

Then `reps + 1`, `lastResultOn = day`, `status = srsStatus(level, weak, topSuccesses, params)`, and
`dueOn = null` when the status is `mastered`.

- [ ] **Step 1: Write the failing tests** (`applyResult.test.ts`), table-driven with `it.each`:
  - every row of the table above with the DSA problem parameters (`DSA_SRS` from the fixtures:
    `[7, 21, 60]`, relearn 3, mastered after 2), from `2026-10-01`: e.g. not started + success →
    `{ level: 1, weak: false, dueOn: '2026-10-08', reps: 1, status: 'ok' }`; L 2 + success →
    level 3, due `2026-10-01 + 60`, status `strong`; L 1 + fail → level 1, weak, lapses + 1,
    due `2026-10-04`, status `weak`;
  - the same rows with `ENGLISH_SRS` (`[1, 3, 7, 14]`, relearn 1) and with `DSA_CARD_SRS` (the
    `srs.byType.flashcard` parameters — resolving them is 4.10's job; here they are just params);
  - mastery: L = N, two successes on different days → the first leaves `topSuccesses: 1`, status
    `strong`; the second → `topSuccesses: 2`, status `mastered`, `dueOn: null`; a partial on a
    mastered item keeps it mastered; a fail on a mastered item → level 1, weak, `topSuccesses: 0`,
    lapses + 1, status `weak`;
  - English (N = 4): level 3 and 4 are `strong`, level 1–2 `ok`;
  - first result per day: a second `applyResult` on the same day returns the identical object
    (`toBe`), whatever the outcome;
  - "today" is the result day: an item due `2026-10-01` reviewed on `2026-10-05` with success from
    L 1 → due `2026-10-05 + 21`;
  - `readd` on a mastered DSA item on `2026-11-01` → level 3, `topSuccesses: 0`, `dueOn:
    '2026-11-01'`, status `strong`, `reps` and `lastResultOn` unchanged; on a non-mastered state →
    returns the same object;
  - level clamp: a state with level 5 under `DSA_SRS` + success → level 3 (N), `topSuccesses + 1`;
  - `srsStatus` truth table (weak wins; mastered needs level N; strong needs level ≥ 3);
  - purity: the input state (frozen) is never modified.
- [ ] **Step 2:** `pnpm vitest run lib/domain/srs` — fails (module missing).
- [ ] **Step 3: Implement** `applyResult.ts` with `addDays` for every date; no other imports
  beyond the types.
- [ ] **Step 4:** `pnpm vitest run lib/domain/srs` — passes; `pnpm verify` — green.
- [ ] **Step 5: Commit** `feat(domain): SRS transitions (§5.7)`.

### Task 4.2: Projection and replay — **Writes ADR-0008**

**Spec:** §4.1 (derived tables), §4.4 (event types and payloads), §4.7 (rules version), §5.3
(introduced set), §5.7, §5.9 (pause, reset). **Files:**

- Create: `lib/domain/projection/project.ts`, `lib/domain/projection/replay.ts` (+ a `*.test.ts`
  each), `docs/adr/0008-rules-version.md`
- Modify: `lib/domain/events.ts` (+ `events.test.ts`): the `item.snapshot` payload (decision 19)
  and the BigInt guard (M2 deferred minor)

**Interfaces:**

- Consumes: `applyResult`, `readd`, `srsStatus`, `NOT_STARTED` (4.1); `RESULT_OUTCOMES`;
  `PlanCatalog`; `DerivedState`, `ItemState`, `BlockState`, `DailyActivity`, `blockKey`,
  `EMPTY_DERIVED_STATE`; `EVENT_PAYLOADS`, `EventType` (`events.ts`); `RULES_VERSION`.
- Produces (4.8 and M5 rely on these):

```ts
// lib/domain/projection/project.ts
/** An `events` row as the engine reads it (payload not yet validated). */
export type DomainEvent = {
  readonly id: string
  readonly type: EventType
  /** ISO-8601 instant (`occurred_at`). */
  readonly occurredAt: string
  /** The event's local day, computed by the database (§4.5). */
  readonly localDay: LocalDay
  readonly trackId: string | null
  readonly itemId: string | null
  readonly planId: string | null
  readonly blockId: string | null
  readonly payload: unknown
  readonly rulesVersion: number
}

export type IgnoreReason =
  | 'invalid_payload'
  | 'unknown_item'
  | 'not_srs'
  | 'wrong_type'
  | 'missing_keys'

/** Applies one event. `ignored` says why an event changed nothing it could have changed; events
 *  that never touch derived state (settings, schedules, admin, plan.generated, …) return
 *  `ignored: null` and the same state object. Never mutates `state`. */
export function projectEvent(
  state: DerivedState,
  event: DomainEvent,
  catalog: PlanCatalog,
): { readonly state: DerivedState; readonly ignored: IgnoreReason | null }

/** `projectEvent(...).state`. */
export function project(state: DerivedState, event: DomainEvent, catalog: PlanCatalog): DerivedState

// lib/domain/projection/replay.ts
export type ReplayResult = {
  readonly state: DerivedState
  readonly ignored: readonly { readonly eventId: string; readonly reason: IgnoreReason }[]
}
/** Rebuilds all derived state from the events, sorted by (Date.parse(occurredAt), id) — the input
 *  order and the timestamp's text form (`Z` vs `+00:00`) do not matter. `rulesVersion` defaults to RULES_VERSION and must equal it (only the current rules
 *  exist); an event stamped with a later version throws. */
export function replay(
  events: readonly DomainEvent[],
  catalog: PlanCatalog,
  options?: { readonly rulesVersion?: number },
): ReplayResult
```

**What each event does** (every payload is first checked with `EVENT_PAYLOADS[type].safeParse`;
a failure → `invalid_payload`):

| Event | Effect |
| --- | --- |
| `item.result` | Needs `itemId` (else `missing_keys`) and a catalog item (else `unknown_item`) with `srs` (else `not_srs`). `applyResult(row ?? NOT_STARTED, RESULT_OUTCOMES[result], localDay, item.srs)`; a new row gets `introducedOn = localDay` and `trackId` / `topicId` / `itemType` from the catalog; `lastResult = result`. If `applyResult` returned the same object: nothing changes (not even `lastResult`). |
| `lesson.completed`, `exercise.submitted`, `prompt.completed` | Needs `itemId` and a catalog item whose `itemType` is `lesson` / `exercise` / `prompt` respectively and whose `srs` is null (else `wrong_type` — so a completion event never blocks an SRS item's result that day). Counted once per item per day (`lastResultOn === localDay` → nothing): a new row is `{ level: 0, weak: false, topSuccesses: 0, status: 'ok', dueOn: null, lapses: 0, reps: 1, introducedOn: localDay }`; an existing row gets `reps + 1`, and a `skipped` status becomes `ok`. `lastResult` = `'completed'` (lesson, prompt) or the exercise `grade`; `lastResultOn = localDay`. |
| any of the four above, when counted | `days[localDay].itemsDone + 1` (the day row is created with `{ minutesByTrack: {}, itemsDone: 0, completed: false }` if missing). |
| `item.skipped` | Needs `itemId` and a catalog item. No row → `{ level: 0, status: 'skipped', dueOn: null, introducedOn: localDay, lastResult: null, lastResultOn: null, reps: 0 }`; a row → `status: 'skipped'`, `dueOn: null`, everything else kept. Not an outcome: `itemsDone` unchanged. |
| `item.readded` | Needs `itemId`, a catalog item with `srs`, and a row: `readd(row, localDay, item.srs)`. |
| `item.snapshot` | Needs `itemId` and a catalog item: the row becomes the payload's fields (`level`, `weak`, `topSuccesses`, `dueOn`, `lapses`, `reps`, `introducedOn`, `lastResult`, `lastResultOn`), status `srsStatus(...)` (or `ok` when `srs` is null / level 0). |
| `block.checked_in` | Needs `planId`, `blockId`, `trackId` (else `missing_keys`). No block row → create it with `checkedInOn = localDay`; a row → replace `status`, `minutes`, `note ?? null`, `auto ?? false`, keep `checkedInOn`. Then recompute `days[checkedInOn]`: `minutesByTrack` = sum of `minutes` by `trackId` over all blocks with that `checkedInOn`; `completed` = any of them `done` or `partial`; `itemsDone` kept. |
| `track.reset` | Needs `trackId`: every item row with that `trackId` is removed. Blocks and days stay. |
| `track.resumed` | Needs `trackId`: every item row of the track with `dueOn !== null` gets `dueOn = addDays(dueOn, pausedDays)`. |
| everything else | No change, `ignored: null`. |

- [ ] **Step 1: `events.ts` first** (failing tests in `events.test.ts`): the `item.snapshot`
  payload accepts `introducedOn` (local day, required), `lastResult` (string ≤ 32, nullable),
  `lastResultOn` (local day, nullable) and still rejects unknown keys; `parseEventPayload(
  'track.updated', { weeklyTemplate: { x: 1n } })` throws a `ZodError` (today `jsonbTextBytes`'s
  `JSON.stringify` throws a `TypeError`) — catch the `TypeError` inside `parseEventPayload` and
  rethrow it as `payloadError(payload, 'the <type> payload is not JSON-serialisable')`. Make them
  pass.
- [ ] **Step 2: Write the failing projection tests** (`project.test.ts`, `replay.test.ts`), using
  `CATALOG` and small event builders local to the test (`event(type, fields)` with ids
  `e-001`, `e-002`, … and `occurredAt` one minute apart):
  - `item.result` for `dsa:p1` solved on `2026-09-28` → a row `{ level: 1, dueOn: '2026-10-05',
    introducedOn: '2026-09-28', lastResult: 'solved', topicId: 'arrays', itemType: 'problem' }`
    and `days['2026-09-28'].itemsDone === 1`; a second result the same day changes nothing and
    `itemsDone` stays 1; a result for a card uses the card's SRS (`english:e1` know → due
    `2026-09-29`);
  - `item.result` for `dsa:lesson-arrays` → `ignored: 'not_srs'`; for `dsa:nope` →
    `unknown_item`; without `itemId` → `missing_keys`; with payload `{ result: 'maybe' }` →
    `invalid_payload`; each returns the same state object;
  - `lesson.completed`, `exercise.submitted { kind: 'fill-blank', grade: 'close' }` and
    `prompt.completed` → level-0 rows, `lastResult` `completed` / `close` / `completed`; repeated on
    the next day → `reps: 2`;
  - `item.skipped` then `item.result` on the same item → SRS starts at level 1 (level 0 = not
    started), `introducedOn` stays the skip day, status no longer `skipped`;
  - `item.readded` on a mastered row → level 3, due that day; on an unknown row → ignored,
    unchanged;
  - `item.snapshot` → exactly the payload's fields and the derived status;
  - `block.checked_in` done 30 min + another block partial 10 min the same day → `minutesByTrack
    { dsa: 30, english: 10 }`, `completed: true`; re-checking the first block as `skipped` 0 min on
    the **next** day keeps its `checkedInOn` and recomputes that day to `{ dsa: 0, english: 10 }`,
    still completed (the partial); only `skipped` blocks → `completed: false`;
  - `track.reset` removes only that track's items (an English item survives a DSA reset);
    `track.resumed { pausedDays: 5 }` shifts every DSA `dueOn` by 5 and leaves `null` ones and
    English items alone;
  - `schedule.changed`, `settings.changed`, `plan.generated`, `admin.user_approved` → same state
    object, `ignored: null`;
  - purity: a deep-frozen state is never modified;
  - `replay`: a 3-week scripted history (enrol, 10 results over several days, check-ins, a skip,
    a pause and resume, a reset) gives exactly the state of folding `project` over the same
    events; shuffling the input gives the same result; the `ignored` list names the invalid
    events; `rulesVersion: RULES_VERSION - 1` throws `/rules version/`; a `lesson.completed` naming
    a problem → `wrong_type`, and that day's `item.result` for the problem still counts; an event
    with `rulesVersion:
    RULES_VERSION + 1` throws.
- [ ] **Step 3:** `pnpm vitest run lib/domain/projection lib/domain/events.test.ts` — fails.
- [ ] **Step 4: Implement** `project.ts` (one small function per row of the table; a `setItem`
  / `setBlock` / `setDay` helper returning new records) and `replay.ts` (sort, fold, collect
  `ignored`).
- [ ] **Step 5: ADR-0008** `docs/adr/0008-rules-version.md` (from `0000-template.md`): every event
  and derived row carries `rules_version`; `RULES_VERSION` (TS) and `public.rules_version()` (SQL)
  are bumped together (sql-sync test); replay is an explicit choice — today only the current rules
  exist, so replay re-derives everything under them and refuses newer events; `item.snapshot` makes
  compacted history replayable (with its limitation: rules changed after a snapshot cannot
  recompute what came before it). Status: accepted.
- [ ] **Step 6:** `pnpm verify` — green. **Commit** `feat(domain): projection and replay of
  derived state (ADR-0008)`.

### Task 4.3: Gate rule and plan history — **Writes ADR-0016**

**Spec:** §5.2, §5.6 (recap done), §5.8 (offer), §5.9. **Files:**

- Create: `lib/domain/plan/gate.ts`, `lib/domain/plan/history.ts` (+ a `*.test.ts` each),
  `docs/adr/0016-gate-on-last-seen-plan.md`

**Interfaces:**

- Consumes: `StoredPlan`, `PlanBlock`, `Enrollment` (`plan/types.ts`), `BlockState`, `blockKey`,
  `daysBetween`.
- Produces (4.6, 4.8 and M5 rely on these):

```ts
// lib/domain/plan/gate.ts
/** "Học tiếp hôm nay" is offered when the last seen plan is more than this many days old (§5.8). */
export const RESUME_AFTER_DAYS = 2

export type GateStatus =
  | {
      readonly open: true
      readonly lastSeen: StoredPlan | null
      /** The last seen plan (from an earlier day) got its first `done` / `partial` check-in today:
       *  resuming counts as today's work, so no new plan is built today (§5.2, §5.9; decision 32). */
      readonly resumedToday: boolean
    }
  | {
      readonly open: false
      readonly lastSeen: StoredPlan
      /** daysBetween(lastSeen.planDate, today). */
      readonly daysSince: number
      readonly offerResume: boolean
    }

/** The seen plan with the latest planDate before `today` (§5.2); unseen plans never count. */
export function lastSeenPlan(plans: readonly StoredPlan[], today: LocalDay): StoredPlan | null

/** Open when there is no last seen plan, when it has no blocks (nothing could be done — RF-4), or
 *  when any of its blocks is checked in `done` or `partial` (at any time) — `resumedToday` when the
 *  earliest `checkedInOn` of those blocks is `today`. Closed otherwise, with `offerResume` when
 *  `daysSince > RESUME_AFTER_DAYS`. */
export function gateStatus(
  plans: readonly StoredPlan[],
  blocks: Readonly<Record<string, BlockState>>,
  today: LocalDay,
): GateStatus

/** The plan's blocks without a `done` / `partial` check-in, in plan order (the paused view, M5). */
export function unfinishedBlocks(
  plan: StoredPlan,
  blocks: Readonly<Record<string, BlockState>>,
): PlanBlock[]

// lib/domain/plan/history.ts
/** Track → roadmap weeks whose recap is done (§5.6): a `recap` block of that track with a
 *  `recapWeek`, checked in `done` or `partial`, in a plan whose `tracks[trackId].variant` is the
 *  enrollment's current variant and whose planDate is on or after the enrollment's `resetOn`.
 *  Every enrollment gets an entry (possibly empty). */
export function recapWeeksDone(
  plans: readonly StoredPlan[],
  blocks: Readonly<Record<string, BlockState>>,
  enrollments: readonly Enrollment[],
): Record<string, Set<number>>
```

- [ ] **Step 1: Write the failing tests** with a local `plan(date, blocks, seenAt)` builder:
  - no plans → open, `lastSeen: null`; only a plan for today → open (today's plan is not "last");
  - last seen plan with a `done` block → open; `partial` → open; all `skipped` → closed; no
    check-in → closed; a check-in made two days after the plan date still opens it;
  - `resumedToday` (decision 32): yesterday's seen plan whose first `done` check-in is today →
    open, `resumedToday: true`; checked in yesterday → `resumedToday: false`; a `skipped` check-in
    yesterday and a `done` one today → `true`; no last seen plan → `false`;
  - **[RF-5]** closed with the last seen plan 3 days old → `offerResume: true`, `daysSince: 3`;
    2 days old → `offerResume: false`;
  - an **unseen** later plan (an AI plan never opened) is ignored: the gate follows the earlier
    seen plan (open or closed); a seen plan with zero blocks → open;
  - `lastSeenPlan` picks the latest date among seen plans before today, whatever the input order;
  - `unfinishedBlocks` keeps plan order and drops `done` / `partial` blocks, keeps `skipped`;
  - `recapWeeksDone`: a done recap block with `recapWeek: 1` → `{ dsa: {1} }`; a `skipped` one →
    empty; a recap block from a plan whose snapshot variant is `10w` while the enrollment is `8w`
    → ignored; a plan dated before `resetOn` → ignored, on `resetOn` → counted; `recapWeek: null`
    → ignored; an English enrollment → an empty set.
- [ ] **Step 2:** run them — fail. **Step 3:** implement. **Step 4:** pass.
- [ ] **Step 5: ADR-0016** `docs/adr/0016-gate-on-last-seen-plan.md`: the gate reads the last
  **seen** plan, so unseen (AI or skipped) plans never close it; closing means no new plan and no
  roadmap advance; the first `done` / `partial` check-in reopens it, and the next plan comes on the
  next local day (`resumedToday`); a stale plan older than two days offers "Học tiếp hôm nay"
  (§5.8, built in `plan/resume.ts`, 4.6); an empty seen plan never closes it. Status: accepted.
- [ ] **Step 6:** `pnpm verify`. **Commit** `feat(domain): gate rule on the last seen plan and
  recap history (ADR-0016)`.

### Task 4.4a: Roadmap position, new-item queue, recap source

**Spec:** §5.3, §5.6 (DSA recap), §3.4 (week sizes, derived decks). **Files:**

- Create: `lib/domain/plan/roadmap.ts`, `lib/domain/plan/roadmap.test.ts`,
  `lib/domain/plan/__tests__/roadmap.property.test.ts`

**Interfaces:**

- Consumes: `PlanCatalog`, `PlanRoadmap`, `PlanRoadmapWeek`, `ItemMode`, `ItemState`;
  `reviewMode` (`plan/reviewMode.ts`, 4.0) for filler recap items.
- Produces (4.6 and 4.8 rely on these):

```ts
// lib/domain/plan/roadmap.ts
/** A week's core items (§3.4): `week.core`, then the `core`-tier cards of `week.decks` (deck
 *  order, card order), whatever their status. */
export function coreItemsOfWeek(week: PlanRoadmapWeek, catalog: PlanCatalog): string[]

/** Core items per week (§3.4 week sizes). */
export function weekSizes(roadmap: PlanRoadmap, catalog: PlanCatalog): number[]

/** A core item counts as passed when introduced (it has a row) or not active in the catalog
 *  (draft, retired, missing) — decision 16. */
export function isPassed(
  itemId: string,
  catalog: PlanCatalog,
  items: Readonly<Record<string, ItemState>>,
): boolean

/** §5.3: the first week w whose cumulative size exceeds `passedCore`, clamped to the last week;
 *  1 when `sizes` is empty. [8, 8, 7]: 0 → 1, 7 → 1, 8 → 2, 20 → 3, 99 → 3. */
export function weekForProgress(passedCore: number, sizes: readonly number[]): number

/** The learner's roadmap week on this track; 1 without a roadmap. */
export function roadmapWeek(
  roadmap: PlanRoadmap | null,
  catalog: PlanCatalog,
  items: Readonly<Record<string, ItemState>>,
): number

/** §5.3 new-item queue: active, not-introduced item IDs in roadmap order — per week: pattern
 *  lessons of its topics (lessons with that topic and `about === null`, in `week.topics` order then
 *  ID), core items, recap entries without a mode, [unlocked derived cards — once, see below],
 *  extended cards, bonus problems (only with `includeBonus`). An item appears at most once.
 *  Unlocked derived cards of `trackId` (tier `derived`, their source has `lastResultOn !== null`),
 *  ordered by (source introducedOn, source ID) — stable, decision 15 — go into the first week that
 *  still has a not-introduced item of its own, after its recap items; with no such week, at the
 *  end. Without a roadmap only the derived cards remain. */
export function newQueue(input: {
  readonly trackId: string
  readonly roadmap: PlanRoadmap | null
  readonly catalog: PlanCatalog
  readonly items: Readonly<Record<string, ItemState>>
  readonly includeBonus: boolean
}): string[]

/** §5.6: the latest week w ≤ currentWeek whose core items are all passed and w ∉ done; null when
 *  none. */
export function recapSource(input: {
  readonly roadmap: PlanRoadmap | null
  readonly catalog: PlanCatalog
  readonly items: Readonly<Record<string, ItemState>>
  readonly done: ReadonlySet<number>
  readonly currentWeek: number
}): number | null

export type RecapPick = { readonly itemId: string; readonly mode: ItemMode }

/** §5.6 recap items, at most `count`: the source week's recap entries that have a mode, whose item
 *  is active and introduced (level ≥ 1), in file order, with that mode; then filler — the track's
 *  other introduced SRS items (level ≥ 1, not mastered, active), sorted by (level, lastResultOn,
 *  ID), each time preferring a topic not picked yet ("spread across topics"), in their review
 *  mode (`reviewMode`: Weak problem → 'redo', other problem → 'recall', card → 'review'). `week: null` = filler
 *  only. Items in `exclude` are never picked. */
export function recapCandidates(input: {
  readonly trackId: string
  readonly roadmap: PlanRoadmap | null
  readonly week: number | null
  readonly catalog: PlanCatalog
  readonly items: Readonly<Record<string, ItemState>>
  readonly count: number
  readonly exclude: ReadonlySet<string>
}): RecapPick[]
```

- [ ] **Step 1: Write the failing tests** (`roadmap.test.ts`) against `CATALOG` / `DSA_8W` /
  `ENGLISH_10W`:
  - `coreItemsOfWeek`: DSA W2 → `['dsa:p5', 'dsa:p6', 'dsa:p8']` (the retired p8 included);
    English W1 → `['english:e1', …, 'english:e4']` (extended cards not included);
  - `weekSizes(DSA_8W)` → `[3, 3]`; `weekSizes(ENGLISH_10W)` → `[4, 2]`;
  - `weekForProgress` — the five examples in the doc comment, and `[]` → 1;
  - `roadmapWeek`: nothing introduced → 1; p1–p3 introduced → 2; p1–p3, p5, p6 introduced → 2
    (p8 is retired, so passed: 6 passed of 6 → clamped to week 2); no roadmap → 1;
  - `newQueue` (DSA, nothing introduced) → `['dsa:lesson-arrays', 'dsa:p1', 'dsa:p2', 'dsa:p3',
    'dsa:p4', 'dsa:lesson-two-pointers', 'dsa:p5', 'dsa:p6']` — no deep-dive lesson, no retired
    p8, no bonus p7; with `includeBonus` p7 follows p6; with p1 introduced p1 is gone; with
    `dsa:lesson-arrays` set to `draft` (`withItems`) it is gone;
  - `newQueue` (English, nothing introduced) → `['english:e1', 'english:e2', 'english:e3',
    'english:e4', 'english:x1', 'english:x2', 'english:e5', 'english:e6']`; with DSA states for
    `dsa:p2` (introduced and last result `2026-09-29`) and `dsa:p1` (`2026-09-30`), the derived
    cards follow `english:e4` as `…:dsa:p2`, `…:dsa:p1` (unlock order), before `x1` — and stay in
    that order after p2 gets a later result; once all W1 cards are
    introduced they follow `english:e6` (W2's core, before its extended cards — W2 has none); with
    every English card introduced they are the whole queue; a derived card whose source was only skipped (`lastResultOn: null`) stays locked;
  - `recapSource`: p1–p3 introduced (so `roadmapWeek` 2), `done` empty, `currentWeek: 2` → 1 (W2's
    p5 and p6 are not passed; W1 is); `done: {1}` → null; only p1 and p2 introduced,
    `currentWeek: 1` → null (p3 not passed);
  - `recapCandidates` for week 1 with p1, p2 introduced (p4 not): `[{ p2, redo }, { p1,
    explain-aloud }]` then filler up to `count: 3` → p3 if introduced (in its review mode), never
    p4 (not introduced) and never an `exclude`d item; filler spreads topics: with introduced
    arrays items a1 (level 1) and a2 (level 1) and a two-pointers item t1 (level 2), count 2 with
    `week: null` → `[a1, t1]`, not `[a1, a2]`; a Weak problem as filler → mode `redo`;
    `week: null`, nothing introduced → `[]`.
- [ ] **Step 2: Property test** (`__tests__/roadmap.property.test.ts`, fast-check — or the seeded
  generator if Q1 is declined): for arbitrary subsets of introduced items of `CATALOG` (random
  levels / `lastResultOn`) and arbitrary `includeBonus`: (a) every active, not-introduced core item
  of every week appears in `newQueue` exactly once; (b) no introduced, draft or retired item
  appears; (c) the queue has no duplicates; (d) `roadmapWeek` never decreases when one more item is
  introduced (monotonic in the introduced set).
- [ ] **Step 3:** run — fail. **Step 4:** implement. **Step 5:** pass; `pnpm verify`.
- [ ] **Step 6: Commit** `feat(domain): roadmap position, new-item queue and recap source (§5.3,
  §5.6)`.

### Task 4.4b: Due queue, weak topics, practice pickers

**Spec:** §5.4 step 3 (sort), §5.5 (review modes), §5.6 (exercise, weekend prompt, shadowing,
mock interview), §5.7 (weak topics), §5.9 (paused, retired). **Files:**

- Create: `lib/domain/plan/queues.ts`, `lib/domain/plan/practice.ts`,
  `lib/domain/stats/weakTopics.ts` (+ a `*.test.ts` each)

**Interfaces:**

```ts
// lib/domain/stats/weakTopics.ts
/** A topic is weak with at least this many Weak items (§5.7). */
export const WEAK_TOPIC_MIN = 2
export type WeakTopic = { readonly trackId: string; readonly topicId: string; readonly itemIds: readonly string[] }
/** Topics of `trackIds` with ≥ WEAK_TOPIC_MIN items whose status is 'weak' and whose catalog item
 *  is active; items sorted by ID; topics sorted by (itemIds.length desc, trackId, topicId). */
export function weakTopics(
  items: Readonly<Record<string, ItemState>>,
  catalog: PlanCatalog,
  trackIds: ReadonlySet<string>,
): WeakTopic[]

// lib/domain/plan/queues.ts — uses `reviewMode` from `plan/reviewMode.ts` (4.0; tested here)
export type DueEntry = {
  readonly itemId: string
  readonly item: PlanItem
  readonly state: ItemState
  /** daysBetween(state.dueOn, today) — 0 when due today. */
  readonly overdueDays: number
  readonly mode: ItemMode
  /** item.minutes[mode]. */
  readonly minutes: number
}

/** §5.4 step 3: the track's due items — dueOn ≤ today, status not mastered or skipped, catalog
 *  item active with `srs` — sorted Weak first → items of `weakTopicIds` → most overdue → lowest
 *  level → ID. */
export function dueQueue(input: {
  readonly trackId: string
  readonly items: Readonly<Record<string, ItemState>>
  readonly catalog: PlanCatalog
  readonly today: LocalDay
  readonly weakTopicIds: ReadonlySet<string>
}): DueEntry[]

// lib/domain/plan/practice.ts
/** The tag whose block shows example sentences instead of an item (§5.6). */
export const SHADOWING_TAG = 'shadowing'

/** Rank of a last grade for "the worst last grade first" (§5.6): miss, close, pass, anything else. */
export const GRADE_RANK: Readonly<Record<string, number>> // { miss: 0, close: 1, pass: 2 }

/** A `practice` block with `itemType` (§5.6 exercise rule, generic): the first active,
 *  not-introduced item of that type whose `week` is `roadmapWeek` (ID order); else the introduced
 *  one with the worst last grade (GRADE_RANK, unknown grades last), oldest lastResultOn, then ID;
 *  else null. */
export function pickByItemType(input: {
  readonly trackId: string
  readonly itemType: string
  readonly roadmapWeek: number
  readonly items: Readonly<Record<string, ItemState>>
  readonly catalog: PlanCatalog
}): string | null

/** A `practice` block with `tag`: the first active repeatable prompt with that tag (ID order);
 *  else the active, not-introduced one with `week === roadmapWeek`; else the earliest (week, ID)
 *  active, not-introduced one with a lower week; else null. */
export function pickByTag(input: {
  readonly trackId: string
  readonly tag: string
  readonly roadmapWeek: number
  readonly items: Readonly<Record<string, ItemState>>
  readonly catalog: PlanCatalog
}): string | null

/** Shadowing (§5.6): up to `count` of today's new cards that have an example, in plan order; when
 *  none, the track's most recently introduced cards with an example (introducedOn desc, ID). */
export function pickShadowing(input: {
  readonly trackId: string
  readonly todaysNew: readonly string[]
  readonly items: Readonly<Record<string, ItemState>>
  readonly catalog: PlanCatalog
  readonly count?: number // default 3
}): string[]

/** §5.6: the introduced (level ≥ 1) active Medium problem of the track with the oldest
 *  lastResultOn, then ID; null when none. For M5's mock-interview prompt page. */
export function mockInterviewProblem(input: {
  readonly trackId: string
  readonly items: Readonly<Record<string, ItemState>>
  readonly catalog: PlanCatalog
}): string | null
```

- [ ] **Step 1: Write the failing tests** (fixtures + `itemState`/`statesOf`/`withItems`):
  - `weakTopics`: two weak `arrays` problems → `[{ dsa, arrays, [p1, p2] }]`; one → `[]`; a
    retired weak item does not count; a track outside `trackIds` (paused) is excluded; ordering by
    count then IDs;
  - `reviewMode`: weak problem → redo, problem → recall, card → review, weak card → review;
  - `dueQueue` on `2026-10-10` with `weakTopicIds: {'arrays'}`: Weak p1 and p2 (due 10-08 and
    10-10), p3 (arrays, not weak, due today), p5 (5 days overdue), p6 (due today, level 1), p7 (due
    today, level 2) → `[p1, p2, p3, p5, p6, p7]`; items
    due tomorrow, mastered, skipped, retired (`withItems`), of another track, or not in the
    catalog are excluded; `overdueDays`, `mode` and `minutes` (redo 21 for a weak Medium problem,
    recall 5, card review 0.5) are set;
  - `pickByItemType` (English, exercise): week 1, nothing introduced → `english:ex-w1-a`;
    `ex-w1-a` introduced → `ex-w1-b`; both introduced → the introduced one with the worst grade (`miss`
    beats `close` beats `pass`, then older `lastResultOn`); week 3 (no exercises) with none
    introduced → null **[RF-4]**; a draft exercise is never picked;
  - `pickByTag`: DSA `mock-interview` → `dsa:prompt-mock` whatever the week; English
    `weekend-task` week 2 → `english:prompt-w2`; week 2 with w2 introduced and w1 not →
    `english:prompt-w1` (catch-up); week 3 with both introduced → null; unknown tag → null;
  - `pickShadowing`: todaysNew `[e3, e1, e2, e4]` → `[e1, e2]` (only cards with an example, plan
    order, max 3); todaysNew `[]` with introduced x1 (`2026-09-29`) and e1 (`2026-09-30`) →
    `[e1, x1]`; nothing → `[]`;
  - `mockInterviewProblem`: introduced p2 (M, lastResultOn `2026-09-30`) and p3 (M,
    `2026-09-29`) and p1 (E) → p3; none → null.
- [ ] **Step 2:** run — fail. **Step 3:** implement. **Step 4:** pass; `pnpm verify`.
- [ ] **Step 5: Commit** `feat(domain): due queue, weak topics and practice pickers (§5.4–§5.7)`.

### Task 4.5: Budget and throttle

**Spec:** §5.4 steps 2–5, §5.5 throttle, §5.10 (review cap, debt), decision 13. **Files:**

- Create: `lib/domain/plan/budget.ts`, `lib/domain/plan/throttle.ts` (+ a `*.test.ts` each)

**Interfaces:**

```ts
// lib/domain/plan/budget.ts
/** One unit a block may take: an item, or a deep-dive lesson (`lead`) and its problem together. */
export type Candidate = {
  readonly itemId: string
  readonly mode: ItemMode
  readonly minutes: number
  /** A new SRS item: counts toward the new-item cap (§5.5). */
  readonly srs: boolean
  /** Placed right before this item and taken or skipped with it (§5.4 step 3). */
  readonly lead?: Candidate
}

export type Picked = {
  readonly itemId: string
  readonly mode: ItemMode
  readonly minutes: number
  readonly overBudget?: true
}

export type Selection = {
  /** Flattened: a unit's lead comes right before its item. */
  readonly picked: readonly Picked[]
  readonly minutes: number
  /** A forced unit exceeded the remaining budget (the track's one overshoot, decision 13). */
  readonly overshoot: boolean
}

export const EMPTY_SELECTION: Selection // { picked: [], minutes: 0, overshoot: false }

/** A track's budget while its plan is built. `remaining` may go negative after the overshoot. */
export type BudgetState = { readonly remaining: number; readonly overshootUsed: boolean }
export function startBudget(minutes: number): BudgetState
/** remaining − selection.minutes; overshootUsed ||= selection.overshoot || the new remaining < 0
 *  (a half-fit unit that overshoots uses the track's one overshoot too — decision 13). */
export function spend(budget: BudgetState, selection: Selection): BudgetState

/** §5.10 review debt: an item more than `overdueDays` overdue raises the weekday cap to
 *  `capShare` of the track budget. */
export const REVIEW_DEBT = { overdueDays: 7, capShare: 0.4 } as const
export function inReviewDebt(overdueDays: readonly number[]): boolean

/** A review block's cap (§5.4 step 3): min(remaining, limit), never below 0, where limit =
 *  ∞ without maxMinutes; maxMinutes; or max(maxMinutes, capShare × trackBudget) in debt. */
export function reviewCap(input: {
  readonly maxMinutes: number | undefined
  readonly trackBudget: number
  readonly remaining: number
  readonly debt: boolean
}): number

/** A fixed block (§5.4 step 2): taken when it fits; otherwise taken as the overshoot while it is
 *  unused (`overshoot: true`); otherwise dropped. */
export function reserveFixed(
  budget: BudgetState,
  minutes: number,
): { readonly take: boolean; readonly overshoot: boolean }

/** Reviews and recap (§5.4 steps 3–4): in order, a unit is taken when its minutes (lead included)
 *  fit `cap − used`, otherwise skipped; with `forceFirst` the first candidate is taken whatever it
 *  costs (its items flagged `overBudget` and `overshoot: true` when it does not fit). At most
 *  `maxUnits` units (default: no limit). */
export function selectSkipping(
  candidates: readonly Candidate[],
  options: { readonly cap: number; readonly maxUnits?: number; readonly forceFirst?: boolean },
): Selection

/** New items (§5.4 step 5): the first unit is taken whatever it costs when `forceFirst`
 *  (flagged `overBudget` + `overshoot` if it does not fit); each following unit when at least half
 *  of it fits (`remaining − used ≥ minutes / 2`); the first unit that fails stops the selection —
 *  order is never broken. SRS units stop at `newCap` (null = no cap); `newCap` 0 → no SRS unit,
 *  even with `forceFirst`. */
export function selectHalfFit(
  candidates: readonly Candidate[],
  options: { readonly remaining: number; readonly newCap: number | null; readonly forceFirst: boolean },
): Selection

// lib/domain/plan/throttle.ts
/** §5.5: the `newPerDay` of the matching rule with the highest `dueAbove` that `dueCount` exceeds;
 *  otherwise `newPerDay` (null = no cap). */
export function effectiveNewPerDay(
  newPerDay: number | null,
  throttle: readonly ThrottleRule[],
  dueCount: number,
): number | null
```

- [ ] **Step 1: Write the failing tests:**
  - `effectiveNewPerDay(8, english rules, n)`: 40 → 8, 41 → 4, 60 → 4, 61 → 0; rules in any order;
    `(null, [], 500)` → null; `(null, [{ dueAbove: 10, newPerDay: 2 }], 11)` → 2;
  - `reviewCap`: `(15, 60, 60, false)` → 15; `(15, 60, 60, true)` → 24; `(15, 90, 90, true)` → 36;
    `(15, 60, 10, true)` → 10; `(undefined, 60, 45, false)` → 45; `(15, 60, -5, false)` → 0;
    `inReviewDebt([7])` false, `([0, 8])` true;
  - `reserveFixed`: 45 of 60 → take; 45 of 30 unused → take + overshoot; 45 of 30 with the
    overshoot used → dropped;
  - `selectSkipping`: cap 15 with [recall 5, redo 21, recall 5, recall 5, recall 5] → the three
    recalls that fit (5, 5, 5 = 15), the redo skipped; a lead + item pair of 25 + 21 with cap 30 is
    skipped as a whole; `maxUnits: 3`; `forceFirst` with a first unit of 21 and cap 10 → it is
    taken, `overBudget` on it, `overshoot: true`, and nothing else fits after it;
  - `selectHalfFit`: remaining 40 with [20, 35, 20] → 20 (fits), 35 (half 17.5 ≤ 20 → taken, now
    −15), stop; remaining 10, forceFirst, [50] → taken, `overBudget`, `overshoot`; forceFirst false
    and [50] with remaining 10 → nothing; half-fit exactly at the boundary (remaining 15 with
    [5, 20]: 5 fits, then 20 with 10 left → taken); `newCap: 2` with four SRS cards → two; `newCap: 0` with [lesson (srs false), card] →
    the lesson only; order is never broken (a small item after a failing big one is not taken);
  - `spend` and `startBudget` arithmetic; `spend` after a half-fit selection that leaves −15 →
    `overshootUsed: true` although `selection.overshoot` is false.
- [ ] **Step 2:** run — fail. **Step 3:** implement. **Step 4:** pass; `pnpm verify`.
- [ ] **Step 5: Commit** `feat(domain): budget rules and throttle (§5.4, §5.5)`.

### Task 4.6: `buildPlan`, stale-plan resume, property tests

**Spec:** §5.4 (all steps, invariant), §5.5, §5.6, §5.8, §5.9; decisions 13–15, 25, 26. **[RF-4],
[RF-5].** **Files:**

- Create: `lib/domain/plan/template.ts`, `lib/domain/plan/buildPlan.ts`,
  `lib/domain/plan/resume.ts` (+ a `*.test.ts` each),
  `lib/domain/plan/__tests__/buildPlan.property.test.ts`

**Interfaces:**

- Consumes: `roadmapWeek`, `newQueue`, `recapSource`, `recapCandidates` (4.4a); `reviewMode`
  (4.0); `dueQueue`, `pickByItemType`, `pickByTag`, `pickShadowing`, `SHADOWING_TAG`, `weakTopics`
  (4.4b); everything in `budget.ts` and `effectiveNewPerDay` (4.5); `weekdayOf` (4.7);
  `StoredPlan` / `PlanContext` / `DayPlan` / `PlanBlock` (4.0).
- Produces (4.8 and M5):

```ts
// lib/domain/plan/template.ts
/** The day's blocks (§5.4 step 1): the weekday's own key wins over 'mon-fri'; blocks whose
 *  fromWeek > roadmapWeek are left out. [] when the template has nothing for the day. */
export function dayTemplate(
  template: PlanWeeklyTemplate,
  weekday: Weekday,
  roadmapWeek: number,
): PlanTemplateBlock[]
/** `<planDate>:<trackId>:<kind>:<n>` (§5.4 step 8). */
export function planBlockId(planDate: LocalDay, trackId: string, kind: BlockKind, n: number): string

// lib/domain/plan/buildPlan.ts
export function buildPlan(ctx: PlanContext): DayPlan
/** Sum of the track's blocks' estMinutes. */
export function plannedMinutes(plan: Pick<DayPlan, 'blocks'>, trackId: string): number
/** The largest single item of the track: the max over item minutes and practice-block minutes. */
export function largestItemMinutes(plan: Pick<DayPlan, 'blocks'>, trackId: string): number
/** The minutes a one-tap or auto check-in pre-fills (decision 34): Math.ceil(block.estMinutes),
 *  so any non-empty block gives at least 1 (`block.checked_in.minutes` is an integer). */
export function checkInMinutes(block: PlanBlock): number

// lib/domain/plan/resume.ts
/** "Học tiếp hôm nay" (§5.8, decision 25): mode 'resume'. */
export function buildResumePlan(ctx: PlanContext, stale: StoredPlan): DayPlan
```

**`buildPlan` algorithm** — for each enrollment, in `trackId` order, that is `active`, has
`planDate ≥ startDate`, and whose track is in the catalog with status `active`:

1. `roadmap = track.roadmaps[variant] ?? null`; `week = roadmapWeek(roadmap, catalog, items)`;
   `blocks = dayTemplate(e.weeklyTemplate, weekdayOf(planDate), week)`.
2. `weak = weakTopics(items, catalog, {trackId})` → `weakTopicIds`; `due = dueQueue(...)`;
   `debt = inReviewDebt(due.map(d => d.overdueDays))`; `newCap = effectiveNewPerDay(e.newPerDay,
   e.throttle, due.length)`; `budget = startBudget(e.budgetMinutes)`; `planned` = the item IDs
   already placed in this track.
3. **Practice blocks** (template order): `itemType` → `pickByItemType`; `tag` → `pickByTag`, else
   when `tag === SHADOWING_TAG` a shadowing block (cards filled in step 8); nothing → the block is
   dropped. `reserveFixed(budget, minutes)` → take (spend `minutes`, overshoot as returned) or
   drop. A taken practice block with an item has `items: [{ itemId, mode: 'new' | 'review', minutes:
   block minutes }]` (`review` when the item is already introduced) and `estMinutes = minutes`.
4. **Review blocks:** `cap = reviewCap({ maxMinutes, trackBudget: e.budgetMinutes, remaining,
   debt })`; candidates = `due` entries not in `planned`, each `{ itemId, mode, minutes, srs: true }`,
   and — for a Weak entry whose `item.deepDiveId` is an active, not-introduced lesson not in
   `planned` — `lead: { itemId: deepDiveId, mode: 'new', minutes: lesson.minutes.new, srs: false }`;
   `selectSkipping(candidates, { cap })`.
5. **Recap blocks:** `source = recapSource({ …, done: ctx.recapDone[trackId] ?? ∅, currentWeek:
   week })`; picks = `recapCandidates({ week: source, count, exclude: planned })` →
   candidates (minutes = `item.minutes[mode]`); `selectSkipping(candidates, { cap: remaining,
   maxUnits: count, forceFirst: !budget.overshootUsed })`; the block's `recapWeek` = `source`
   (null when only filler).
6. **New blocks:** queue = `newQueue(...)` minus `planned` → candidates `{ mode: 'new', minutes:
   item.minutes.new, srs: item.srs !== null }`; `selectHalfFit(candidates, { remaining, newCap:
   newCap − SRS items already added as new today, forceFirst: first new block &&
   !budget.overshootUsed })`.
7. **Days without a `new` block in the template:** an empty review block falls back to filler recap
   (`recapCandidates` with `week: null`, `count: 3`, `forceFirst: !overshootUsed`, emitted as kind
   `recap` with `recapWeek: null`), then — still empty — to new items (`selectHalfFit` with
   `forceFirst: !overshootUsed`, kind `new`); an empty recap block falls back to new items the same
   way. Then, **when the template has neither a `new` nor a `recap` block** and no fallback
   produced a `new` block, leftover minutes spill into new items: `selectHalfFit({ remaining,
   newCap, forceFirst: false })`, appended as a `new` block after the others (decision 26).
8. **Shadowing blocks** get `shadowing = pickShadowing({ todaysNew: this track's new-block items })`;
   a shadowing block with no card is dropped after planning — its reserved minutes stay unused (at
   most one short block; accepted).
9. Every step updates `planned` and `budget` (`spend`). Emit the track's non-empty blocks in
   template order (fallback blocks take their block's place; the spill block goes last), numbered
   per kind with `planBlockId`; a block's `estMinutes` = the sum of its items' minutes (practice:
   its fixed minutes). The track snapshot: `{ variant, week, dueCount: due.length, newPerDay:
   newCap, throttled: newCap !== e.newPerDay, reviewDebt: debt }`.

Output: `{ planDate, mode: 'baseline', blocks: <all tracks' blocks, in trackId order>, tracks }`.

**`buildResumePlan`** — for each enrollment eligible as above: step 1–2 as `buildPlan`; a `review`
block with `cap = reviewCap({ maxMinutes: <today's template's first review block's maxMinutes>,
… })`; then a `new` block whose candidates are the items of `stale`'s `new` blocks of this track,
in order, that are active and not introduced now (`selectHalfFit` with today's `newCap` and
`forceFirst: !budget.overshootUsed`). No practice, recap, fallback or spill. Mode `'resume'`.

- [ ] **Step 1: Write the failing unit tests** (`template.test.ts`, `buildPlan.test.ts`,
  `resume.test.ts`) with `planContext`, `enrollment`, `itemState`, `statesOf`, `withItems`,
  `MONDAY` / `SATURDAY` / `SUNDAY`:
  - `dayTemplate`: DSA Monday → review 15 + new; Sunday week 2 → recap only (mock `fromWeek: 3`);
    Sunday week 3 → mock + recap; a template with `wed` and `mon-fri` → `wed` wins on Wednesday;
    a day with no key → `[]`; `planBlockId('2026-09-28', 'dsa', 'new', 1)` →
    `'2026-09-28:dsa:new:1'`;
  - **new learner, Monday, DSA 60 min** → one block `2026-09-28:dsa:new:1` with
    `lesson-arrays` (25) and p1 (20) — lesson 25 (35 left), p1 20 (15 left), p2 35 (half 17.5 > 15
    → stop); `estMinutes: 45`; no review block (empty); snapshot `{ variant: '8w',
    week: 1, dueCount: 0, newPerDay: null, throttled: false, reviewDebt: false }`;
  - **English Monday, new learner, 25 min**: exercise block `ex-w1-a` (5), shadowing (3), no
    review block, a new block with `[e1, e2, e3, e4, x1, x2, e5, e6]` (8 = `newPerDay`, 12 minutes;
    derived cards stay locked — no DSA results), shadowing cards `[e1, e2, x1]` (the first three
    new cards with an example) — assert the exact blocks and ids `2026-09-28:english:practice:1`,
    `…:practice:2`, `…:new:1`;
  - review cap and debt: DSA Monday with six due recall items (5 min) → review block of three
    (15); with one of them 8 days overdue → four (24 → cap 24, 4 × 5 = 20, the fifth needs 25);
  - a Weak due problem with a not-completed active deep-dive (p3) → the review block holds
    `lesson-deep-dive-p3` right before p3 when both fit a Saturday budget; on a weekday (cap 15)
    both are skipped together;
  - throttle (a catalog copy with 70 extra English core cards built with `planItem` in the test):
    45 due cards → `newPerDay` 4 in the snapshot, `throttled: true`, at most 4 new SRS cards; 61 due
    → no new card at all, and no first-item overshoot;
  - first-item overshoot: DSA budget 10 on a weekday with nothing due → the first new item
    (lesson, 25) is taken with `overBudget: true`, nothing else;
  - decision 13: DSA on `SUNDAY` with budget 30 and an enrollment template whose mock interview
    has `fromWeek: 1` → the mock interview (45) is taken as the overshoot; the recap and its new
    fallback get nothing (the overshoot is used, the remainder negative) → planned 45 ≤ 30 + 45;
  - Sunday recap: p1–p3 introduced and `recapDone` empty → recap block `recapWeek: 1` with
    `p2 redo` (21), `p1 explain-aloud` (5), then `p3 recall` (5) as filler; with
    `recapDone: { dsa: {1} }` → filler only, `recapWeek: null`;
  - Saturday fallback: new learner on `SATURDAY` → review empty → filler empty → a `new` block
    `[lesson-arrays, p1]` (the lesson forced first, p1 fits, p2 fails half-fit) **[RF-4]**; a
    learner with two recall reviews due on Saturday (60 min) → review block (10), then a spill
    `new` block (half-fit, no forced overshoot);
  - English Sunday: new learner → weekend prompt w1 (15), the empty review falls back to new
    cards (7 cards: six fit, the seventh half-fits); with four due cards → prompt, review block
    (2 minutes), then a spill `new` block (decision 26);
  - **[RF-4]** empty catalog → `{ blocks: [], tracks: {} }`; a track with a future `startDate` is
    skipped; a paused or removed enrollment is skipped; on `MONDAY`, a track whose variant has no
    roadmap file → reviews only (no new, no recap); with a test-local copy of `ENGLISH_10W` that has
    a week 3 (one deck, one core card, no exercises), every W1–W2 core card introduced and no
    exercise introduced → roadmap week 3 → no exercise block;
  - `checkInMinutes`: a block of three 0.5-minute reviews → 2; a 45-minute block → 45;
  - determinism: the same context twice → deep-equal plans; frozen inputs are never modified;
  - **[RF-5]** `buildResumePlan` with a stale plan whose DSA new block held `[lesson-arrays, p1,
    p2]` of which `lesson-arrays` is now introduced → new block `[p1, p2]` (as budget allows),
    never p3 (the pointer does not advance); due reviews in a review block; mode `'resume'`; no
    English new cards when the stale plan had no English new block.
- [ ] **Step 2: Property tests** (`__tests__/buildPlan.property.test.ts`, 300 runs each; fast-check
  or the seeded generator): contexts from arbitrary budgets (10–240, step 5, per track), weekdays
  (`MONDAY` + 0…6), item states for random subsets of `CATALOG` items (level 0…N, weak, due
  offset −20…+20 days, topSuccesses 0…2, status consistent with `srsStatus`), `includeBonus`,
  `newPerDay` (null or 0…10), throttle rules and `recapDone` subsets, and — in half of the runs —
  a random custom weekly template (1–4 valid blocks per day key, any order and kinds, as a learner
  could store one; decision 13). For every generated plan and
  track: **(I1)** `plannedMinutes ≤ budget` or `plannedMinutes ≤ budget + largestItemMinutes`
  (§5.4 invariant); **(I2)** no item ID appears twice in the plan; **(I3)** items in `new` blocks
  are not introduced; items in `review` blocks with a mode other than `new` are due, active and
  neither mastered nor skipped, and a `new`-mode item in a review block is an active,
  not-introduced deep-dive lesson placed directly before its Weak problem; recap items are
  introduced; **(I4)** no block is empty (a practice block has an item or
  shadowing cards), block IDs are unique and match
  `/^\d{4}-\d{2}-\d{2}:[a-z][a-z0-9-]*:(review|new|recap|practice|extra):\d+$/`; **(I5)** no draft
  or retired item appears; **(I6)** SRS items in `new` blocks ≤ the snapshot's `newPerDay` when not
  null; **(I7)** building twice gives deep-equal plans.
- [ ] **Step 3:** run — fail. **Step 4:** implement `template.ts`, `buildPlan.ts` (one function per
  step, a per-track builder returning `{ blocks, snapshot }`), `resume.ts` (reuses the per-track
  helpers). **Step 5:** pass; `pnpm verify`.
- [ ] **Step 6: Commit** `feat(domain): buildPlan, stale-plan resume and plan invariants (§5.4,
  §5.8)`.

### Task 4.7: Stats — streak, weekly summary, weekday; time-zone option cache

**Spec:** §5.1, §5.7 (streak), §5.9 (schedule changes, removed tracks), §2.4 (`/progress` weekly
summary); decisions 22, 23. **[RF-1].** **Files:**

- Create: `lib/domain/time/weekday.ts`, `lib/domain/stats/streak.ts`,
  `lib/domain/stats/weeklySummary.ts` (+ a `*.test.ts` each)
- Modify: `lib/domain/time/timeZones.ts` (+ test) — `isTimeZoneOption` stops rebuilding the option
  list on every call (M3 follow-up): a module-level lazily built `Set`.

**Interfaces:**

```ts
// lib/domain/time/weekday.ts
export const WEEKDAYS: readonly Weekday[] // ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
/** Pure calendar math: daysBetween('1970-01-05' (a Monday), day) mod 7. */
export function weekdayOf(day: LocalDay): Weekday
/** The Monday on or before `day`. */
export function weekStart(day: LocalDay): LocalDay

// lib/domain/stats/streak.ts
/** Dates no local day ever had because a schedule change jumped over them (§5.9 moving east):
 *  for consecutive versions (by effectiveAt) A → B at instant t, every date strictly between
 *  localDay(t − 1 ms, A) and localDay(t, B). Identical consecutive versions skip nothing. */
export function scheduleSkippedDays(versions: readonly ScheduleVersion[]): Set<LocalDay>
/** §5.7: consecutive completed days ending today — or yesterday when today is not completed yet;
 *  a date in `skippedDays` is passed over without counting or breaking. */
export function streak(input: {
  readonly completedDays: ReadonlySet<LocalDay>
  readonly today: LocalDay
  readonly skippedDays?: ReadonlySet<LocalDay>
}): number

// lib/domain/stats/weeklySummary.ts
export type SummaryDay = {
  readonly localDay: LocalDay
  readonly minutesByTrack: Readonly<Record<string, number>>
  readonly minutes: number
  readonly itemsDone: number
  readonly completed: boolean
}
export type WeeklySummary = {
  readonly weekStart: LocalDay
  /** Monday … Sunday; a day without activity has zeros. */
  readonly days: readonly SummaryDay[]
  readonly minutesByTrack: Readonly<Record<string, number>>
  readonly totalMinutes: number
  readonly itemsDone: number
  readonly completedDays: number
}
/** The Monday–Sunday week of `weekOf`; only `trackIds`' minutes count (removed tracks leave the
 *  summaries, §5.9); `itemsDone` and `completed` are the day's own. */
export function weeklySummary(
  days: Readonly<Record<LocalDay, DailyActivity>>,
  weekOf: LocalDay,
  trackIds: ReadonlySet<string>,
): WeeklySummary
```

- [ ] **Step 1: Write the failing tests:**
  - `weekdayOf('2026-09-28')` → `'mon'`, `'2026-10-04'` → `'sun'`, `'2024-02-29'` → `'thu'`,
    `'1969-12-31'` → `'wed'` (negative day numbers); `weekStart('2026-10-04')` → `'2026-09-28'`,
    `weekStart('2026-09-28')` → itself;
  - `streak`: completed 09-26…09-28, today 09-28 → 3; today 09-29 not completed → 3 (from
    yesterday); a gap on 09-27 → 1; nothing → 0;
  - **[RF-1]** `scheduleSkippedDays`: Pacific/Pago_Pago 04:00 → Pacific/Kiritimati 04:00 effective
    at the Pago Pago day start of 2026-10-01 (`2026-10-01T15:00:00Z`; the local day is 09-30 just
    before and 10-02 just after) → exactly `{'2026-10-01'}`; Asia/Ho_Chi_Minh → Pacific/Kiritimati
    at the Ho Chi Minh day start → nothing (a jump under 24 hours skips no date); moving west
    (Asia/Ho_Chi_Minh → America/Los_Angeles) skips nothing; two identical consecutive versions skip nothing; a single version → ∅; and
    `streak` counts across the skipped date without breaking (completed 09-29, 09-30, 10-02 with
    10-01 skipped → 3);
  - `weeklySummary`: Monday–Sunday days even without rows; minutes summed per track and in total;
    a removed track's minutes excluded; `completedDays` and `itemsDone` totals;
  - `isTimeZoneOption`: the same answers as before (`Asia/Ho_Chi_Minh` true, `Mars/Olympus`
    false), and the option list is built at most once across many calls: `vi.resetModules()`, spy
    on `Intl.supportedValuesOf`, then import `timeZones.ts` dynamically and call
    `isTimeZoneOption` 100 times → at most one `supportedValuesOf` call.
- [ ] **Step 2:** run — fail. **Step 3:** implement. **Step 4:** pass; `pnpm verify`.
- [ ] **Step 5: Commit** `feat(domain): streak, weekly summary and weekday helpers (§5.7, RF-1)`.

### Task 4.8: Simulation and projection table — **Writes ADR-0014, ADR-0037**

**Spec:** §5.10 (scenarios, thresholds), §5.11 (projection table, inputs hash), §7.9
(`pnpm sim:projections`); decisions 20, 21. **Files:**

- Create: `lib/domain/random.test.ts`, `lib/domain/plan/simulate.ts` (+ `simulate.test.ts`),
  `lib/domain/plan/simInputs.ts` (+ test), `lib/domain/plan/__tests__/simulation.dsa.test.ts`,
  `lib/domain/plan/__tests__/simulation.english.test.ts`,
  `lib/domain/plan/__tests__/englishModel.ts`, `lib/domain/plan/sim-inputs.generated.json`,
  `lib/domain/plan/projections.generated.json`, `tools/sim/{inputs,cli}.ts`,
  `tools/sim/projections.test.ts`, `docs/adr/0014-simulation-backed-srs-parameters.md`,
  `docs/adr/0037-projection-inputs-hash.md`
- Modify: `lib/domain/plan/projections.ts` (+ test), `package.json` (script), `CLAUDE.md` and
  `README.md` (the command), spec §5.10–§5.11 (a pointer to the generated table and the calibrated
  numbers), and — only if the regenerated table changes the displayed weeks —
  `features/onboarding/components/onboarding-wizard.test.tsx`,
  `features/tracks/components/variant-picker.test.tsx`, `e2e/onboarding.spec.ts`

**Interfaces:**

```ts
// lib/domain/plan/simulate.ts — the seeded PRNG is `mulberry32` from `lib/domain/random.ts` (4.0)
/** Linear interpolation between order statistics (the prototype's `pct`), rounded to 0.1. */
export function percentile(values: readonly number[], q: number): number

export type LearnerProfile = 'ideal' | 'realistic'
export type SimOptions = {
  readonly catalog: PlanCatalog
  readonly enrollment: Enrollment
  readonly profile: LearnerProfile
  readonly seed: number
  readonly days: number
  /** Day 0; the realistic learner's weeks start here. */
  readonly startDate: LocalDay
  /** Items outside the track that gain a result over time (English derived-card sources):
   *  before day d's plan, the first min(⌊(d + 1) × perDay⌋, n) get a success. */
  readonly externalResults?: { readonly itemIds: readonly string[]; readonly perDay: number }
}
export type SimDay = {
  readonly date: LocalDay
  /** The plan created that day; null when none was (gate closed, or resumed today). */
  readonly planDate: LocalDay | null
  /** The learner studied that day (a new plan or the paused one); false on a skipped day. */
  readonly studied: boolean
  /** Due, unmastered items of the track at the start of the day (dueQueue length). */
  readonly due: number
  readonly plannedMinutes: number
  readonly largestItem: number
  /** plannedMinutes ≤ budget or ≤ budget + largestItem. */
  readonly withinBudget: boolean
}
export type SimRun = {
  /** The day index on which the last roadmap item (pattern lessons, core, recap introducers; no
   *  bonus) was introduced; null if not within `days`. */
  readonly finishDay: number | null
  readonly days: readonly SimDay[]
  readonly coreIntroduced: number
  readonly coreTotal: number
}
/** Runs the real engine day by day (§5.10): `gateStatus` (4.3) → `buildPlan` (seen) → the
 *  learner. Ideal: every result a success, no skipped day. Realistic: per result 80 % success,
 *  10 % partial, 10 % fail (drawn from `mulberry32(seed)`); one random day per 7-day block is
 *  skipped — when the gate is open the plan is created and seen, and nothing is done. On a later
 *  day with the gate closed the learner completes the paused plan instead; the gate is then open
 *  with `resumedToday`, so no new plan is built that day (decision 32). Results become events
 *  folded with `project` (4.2): SRS items `item.result` (solved / hint / failed), lessons
 *  `lesson.completed`, exercises `exercise.submitted` (pass / close / miss), prompts
 *  `prompt.completed`; every block is checked in `done` with `checkInMinutes(block)` (4.6).
 *  Deterministic for a seed. */
export function simulate(options: SimOptions): SimRun

// lib/domain/plan/simInputs.ts
/** What the DSA simulation reads (§5.11 projection inputs), extracted from content by tools/sim. */
export type SimInputs = {
  readonly rulesVersion: number
  readonly trackId: string
  readonly srs: SrsParams
  readonly estimates: { readonly lesson: number; readonly problem: Readonly<Record<Difficulty, number>> }
  readonly review: { readonly recallMinutes: number; readonly redoFactor: number }
  readonly weeklyTemplate: PlanWeeklyTemplate
  readonly defaults: PlanTrack['defaults']
  readonly roadmaps: Readonly<Record<string, PlanRoadmap>>
  /** Every problem a roadmap lists → its difficulty and topic. */
  readonly problems: Readonly<Record<string, { readonly difficulty: Difficulty; readonly topic: string }>>
}
/** The planned content (§5.11): one active pattern lesson per topic a roadmap week lists
 *  (`<trackId>:lesson-<topic>`), every listed problem active with its difficulty's minutes
 *  (redo = round(new × redoFactor), recall / review / explain-aloud = recallMinutes), and one
 *  repeatable prompt `<trackId>:prompt-<tag>` per practice `tag` in `weeklyTemplate`, with that
 *  block's minutes — prompt files are not inputs, so they are not hashed (bots may edit them). */
export function simCatalog(inputs: SimInputs): PlanCatalog
export function simEnrollment(inputs: SimInputs, variant: string, budgetMinutes: number): Enrollment
```

`tools/sim/inputs.ts`: `simInputs(catalog: Catalog): SimInputs` (DSA manifest `srs` resolved for
problems, `estimates.lesson`, `estimates.problem.new`, `review`, `weeklyTemplate`, `defaults`;
every roadmap file; each listed problem's difficulty and topic — no prompt file is read) and
`inputsHash(inputs: SimInputs): string` (sha256 hex of the JSON with keys sorted recursively,
`node:crypto`). `tools/sim/cli.ts` (`pnpm sim:projections`): for variants `8w`, `10w` × budgets
45, 60, 75, 90, 120 runs 200 realistic learners (seeds 0…199) for 182 days, and writes
`lib/domain/plan/projections.generated.json` =
`{ inputsHash, rulesVersion, runs: 200, days: 182, table: { dsa: { '8w': [[45, median, p90], …],
'10w': [...] } } }` (weeks = (finishDay + 1) / 7) and `lib/domain/plan/sim-inputs.generated.json`
(the inputs), printing progress per scenario. A run that does not finish within 182 days is rerun
for 364 days; one that still does not finish makes the CLI exit non-zero (the UI must never show
"~99 tuần").

- [ ] **Step 1: `simulate.ts` unit tests first.** `random.test.ts`: `mulberry32(1)` starts
  `0.6270739405881613, 0.002735721180215478, 0.5274470399599522` (pinned); every value is in
  [0, 1). `simulate.test.ts`: `percentile([1, 2, 3, 4], 0.5)` → 2.5,
  `([5], 0.9)` → 5; `simulate` on `CATALOG` / DSA / ideal for 21 days finishes the two-week
  fixture roadmap (finishDay not null — only active roadmap items count, so the retired p8 never
  blocks it), every day `withinBudget`; the same seed twice →
  deep-equal runs; a realistic run has exactly one day per 7-day block with `studied: false`
  (the skip), never two `SimDay`s with the same `planDate`, and a `planDate: null` day right after
  each skip (the resume day). Then implement `percentile` and `simulate`.
- [ ] **Step 2: `simInputs.ts`** tests with a two-week hand-built `SimInputs`: `simCatalog` has one
  lesson per topic, problem minutes `{ new: 35, redo: 21, recall: 5, … }` for an M problem at
  redoFactor 0.6, one repeatable prompt `dsa:prompt-mock-interview` (45 minutes) from the Sunday
  practice block; `simEnrollment` uses the defaults with the given variant and
  budget. Implement.
- [ ] **Step 3: `tools/sim`** — `inputs.ts` (tests: on the real generated catalog, `simInputs`
  lists both DSA roadmaps and a difficulty for every problem they reference; `inputsHash` is
  stable under key order and changes when one difficulty changes), `cli.ts`, the `package.json`
  script `"sim:projections": "pnpm content:build && tsx tools/sim/cli.ts && prettier --write
  lib/domain/plan/*.generated.json"`. Run `pnpm sim:projections` and commit both generated files.
- [ ] **Step 4: `tools/sim/projections.test.ts`** (on the generated catalog, `@/.generated/catalog`):
  `projections.generated.json.inputsHash === inputsHash(simInputs(CATALOG))`, `rulesVersion ===
  RULES_VERSION`, and `sim-inputs.generated.json` deep-equals `simInputs(CATALOG)` — each failing with "run pnpm
  sim:projections". `lib/domain/plan/projections.ts`: `PROJECTION_TABLE` = the generated `table`
  (typed); `projectFinish` keeps its signature and behaviour; `projections.test.ts` stops pinning
  the §5.11 prototype numbers and tests the interpolation against a hand-built table passed to an
  exported `projectFinishIn(table, trackId, variant, budget)`, plus "every generated row is sorted
  by budget and has median ≤ p90".
- [ ] **Step 5: The simulation tests** (`simulation.dsa.test.ts`, `simulation.english.test.ts`,
  `describe` with `{ timeout: 180_000 }`), 200 realistic seeds (0…199) + 1 ideal run per scenario,
  126 days from `2026-09-28`:
  - DSA (from `sim-inputs.generated.json` via `simCatalog`): 8w @ 60 realistic → finish p90 ≤ 12.5
    weeks, max ≤ 13.5; 10w @ 90 realistic → p90 ≤ 11.5; 10w @ 75 realistic → p90 ≤ 14; ideal 8w @
    60 ≤ 8.5; ideal 10w @ 90 ≤ 7.5; for 8w @ 60, 10w @ 75 and 10w @ 90 realistic: p90 of the
    per-run max due ≤ 40 and p90 of the due count at day 125 ≤ 15; snapshot: 10w @ 60 realistic
    median > 12 (documents §5.11);
  - English (`englishModel.ts`: core cards per week `[12, 16, 14, 14, 12, 13, 16, 14, 11, 13]`,
    extended cards `30 − core` for weeks 1–3, six exercises and one weekend prompt per week, 105
    derived cards whose sources gain a result at 0.9 per day through `externalResults`, the real
    English template, 25 min, `newPerDay` 8, throttle `>40 → 4, >60 → 0`): mean due over days
    56–125 (the prototype's `mean(dues[56:])` over 126 days, which §5.10 labels "w8–12") ≤ 25; p90 of the per-run max due ≤ 90; p90 of the due count at day 125 ≤ 25;
    every core card introduced by day 125 in every run;
  - every simulated day of every run: `withinBudget` (the §5.4 invariant).
  Run them; record every observed value (median, p90, max) next to its threshold in the report.
  **If any threshold fails, stop and report `BLOCKED` with the numbers and your diagnosis**
  (decision 21) — do not change a threshold.
- [ ] **Step 6: Displayed projections** — if the regenerated 8w/10w numbers change the text the
  onboarding wizard and variant picker show, update their component tests and
  `e2e/onboarding.spec.ts` to the new values. Do not run e2e (the wave's stack holder is 4.12); the
  controller runs `pnpm test:e2e --grep onboarding` after the wave.
- [ ] **Step 7: Docs** — ADR-0014 (`[7, 21, 60]` for DSA problems, `[1, 3, 7, 14]` for English and
  DSA cards, mastery after 2, relearn 3 / 1; the §5.10 prototype; the TypeScript calibration run
  and its numbers; thresholds frozen), ADR-0037 (the projection table is generated and keyed by the
  inputs hash; the stale-hash test; the inputs are only what bots cannot edit — manifests,
  roadmaps, `problem.yaml` — and prompt files are deliberately not hashed (the simulation derives
  its prompts from the template's practice blocks), so content-only PRs stay green); spec §5.10 and §5.11 gain a line "Regenerated in M4 by `pnpm
  sim:projections` → `lib/domain/plan/projections.generated.json` (authoritative from then on);
  calibrated TypeScript numbers: …"; `CLAUDE.md` and `README.md` list `pnpm sim:projections`
  ("regenerate the simulated finish table after changing DSA roadmaps, difficulties or the
  manifest's srs / review / estimates / weeklyTemplate / defaults").
- [ ] **Step 8:** `pnpm verify` (note the test duration in the report). **Commits:**
  `feat(domain): plan simulation (§5.10)`, `feat(sim): projection table from the TypeScript
  simulation (ADR-0014, ADR-0037)`.

### Task 4.9a: Migration — `day_plans` and the derived tables

**Spec:** §4.1, §4.3, §4.5, §5.2 (`mark_plan_seen`); decisions 6, 11, 18. **Files:**

- Create: `supabase/migrations/20260926000100_day_plans_and_derived_tables.sql`,
  `supabase/tests/database/070-derived-tables.test.sql`
- Modify: `lib/domain/rules.ts` (`RULES_VERSION = 2`), `tools/db/sql-sync.test.ts` (decision 18:
  a case reading `supabase/tests/database/070-derived-tables.test.sql` with
  `/select is\(\s*public\.rules_version\(\),\s*(\d+)/` and expecting `String(RULES_VERSION)`),
  `lib/supabase/database.types.ts` (`pnpm db:types`), `supabase/tests/database/{001,012,030,040,060}-*.sql` (the allowlist, and
  every expectation of `rules_version` 1 on a row a learner writes → 2; 041's system events keep the
  `rules_version` they send, so 041 is unchanged), `docs/adr/0007-*.md` (one line: derived tables
  are bounded like the state tables, decision 11)

**The migration** (every function revokes PUBLIC and grants exactly its callers — the 001
invariants):

```sql
-- §4.7 / decision 18: the first rules with plan and SRS behaviour (lib/domain/rules.ts).
create or replace function public.rules_version() returns integer
language sql immutable set search_path = '' as $$
  select 2
$$;

create table public.day_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  plan_date date not null,
  source text not null default 'baseline' check (source in ('baseline', 'ai')),
  version integer not null default 1 check (version >= 1),
  blocks jsonb not null check (jsonb_typeof(blocks) = 'array' and octet_length(blocks::text) <= 131072),
  roadmap_weeks jsonb not null default '{}'::jsonb
    check (jsonb_typeof(roadmap_weeks) = 'object' and octet_length(roadmap_weeks::text) <= 8192),
  rules_version integer not null default public.rules_version() check (rules_version >= 1),
  seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, plan_date)
);
create trigger set_updated_at before update on public.day_plans
  for each row execute function public.set_updated_at();

create table public.plan_block_state (
  plan_id uuid not null references public.day_plans (id) on delete cascade,
  block_id text not null check (octet_length(block_id) <= 128),
  user_id uuid not null references public.profiles (id) on delete cascade,
  track_id text not null check (track_id ~ '^[a-z][a-z0-9-]{0,31}$'),
  status text not null check (status in ('done', 'partial', 'skipped')),
  minutes integer not null check (minutes between 0 and 600),
  note text check (char_length(note) <= 1000),
  auto boolean not null default false,
  checked_in_on date not null,
  checked_in_at timestamptz not null default now(),
  version integer not null default 1 check (version >= 1),
  rules_version integer not null default public.rules_version() check (rules_version >= 1),
  primary key (plan_id, block_id)
);

create table public.item_state (
  user_id uuid not null references public.profiles (id) on delete cascade,
  item_id text not null check (octet_length(item_id) <= 128),
  track_id text not null check (track_id ~ '^[a-z][a-z0-9-]{0,31}$'),
  topic_id text check (octet_length(topic_id) <= 32),
  item_type text not null check (item_type in ('problem', 'flashcard', 'lesson', 'exercise', 'prompt')),
  level integer not null default 0 check (level between 0 and 32),
  weak boolean not null default false,
  top_successes integer not null default 0 check (top_successes >= 0),
  status text not null check (status in ('weak', 'ok', 'strong', 'mastered', 'skipped')),
  due_on date,
  last_result text check (octet_length(last_result) <= 32),
  last_result_on date,
  introduced_on date not null,
  lapses integer not null default 0 check (lapses >= 0),
  reps integer not null default 0 check (reps >= 0),
  version integer not null default 1 check (version >= 1),
  rules_version integer not null default public.rules_version() check (rules_version >= 1),
  primary key (user_id, item_id)
);
create index item_state_user_due_idx on public.item_state (user_id, due_on);

create table public.daily_activity (
  user_id uuid not null references public.profiles (id) on delete cascade,
  local_day date not null,
  minutes_by_track jsonb not null default '{}'::jsonb
    check (jsonb_typeof(minutes_by_track) = 'object' and octet_length(minutes_by_track::text) <= 2048),
  items_done integer not null default 0 check (items_done >= 0),
  completed boolean not null default false,
  version integer not null default 1 check (version >= 1),
  rules_version integer not null default public.rules_version() check (rules_version >= 1),
  primary key (user_id, local_day)
);

alter table public.user_tracks add column reset_on date;  -- decision 9: set by track.reset (4.9b)

-- Events that name a plan (§4.1). Cascade, never set null: the account-deletion cascade deletes
-- plans and events together, and a SET NULL would UPDATE an event (events_append_only raises).
alter table public.events add constraint events_plan_id_fkey
  foreign key (plan_id) references public.day_plans (id) on delete cascade;
```

Plus, in the same migration:

- **`public.plan_lock_key(p_user_id uuid, p_plan_date date) returns bigint`** — `language sql
  immutable`, `search_path ''`: `pg_catalog.hashtextextended('day_plan:' || p_user_id || ':' ||
  p_plan_date, 0)`. The one key of the `(user, plan_date)` advisory lock (decision 33), used by
  `apply_event` (4.9b) and `apply_system_event` (4.9c). Revoke PUBLIC; grant `authenticated`,
  `service_role` (the invoker `apply_event` calls it as the learner); 001 allowlist.
- **`events_prepare`** (`create or replace`, the 000200 body unchanged plus): for `authenticated`,
  a non-null `plan_id` must be one of the user's own plans (`exists (select 1 from
  public.day_plans d where d.id = new.plan_id and d.user_id = new.user_id)`, RLS applies) else
  `raise exception 'forbidden_plan_id' using errcode = '42501'` — a learner can never mark another
  user's plan as touched.
- **Bounds (decision 11)** — `BEFORE INSERT` triggers, applied only when `current_user =
  'authenticated'` (the secret-key role and definer functions are trusted); a row whose `user_id`
  is not `auth.uid()` is left to RLS (a learner never takes another user's lock — the 000100
  pattern); a per-user advisory lock where one counts rows. `item_state_limit_rows` →
  `too_many_items` above 5000 rows per user (the count leaves out `new.item_id`, so the insert half
  of an upsert of an existing row is free — the 000100 pattern); `daily_activity_window` →
  `invalid_local_day` unless `local_day` is within one day of `public.user_local_day(new.user_id,
  now())`; `plan_block_state_known_block` → `unknown_block` unless the plan belongs to
  `new.user_id` and `exists (select 1 from jsonb_array_elements(d.blocks) b where b ->> 'id' =
  new.block_id)`.
- **`mark_plan_seen(p_plan_id uuid) returns boolean`** — `SECURITY DEFINER`, `search_path ''`:
  `auth.uid()` null → `not_authenticated`; `not public.is_active()` → `inactive`; `update
  public.day_plans set seen_at = now() where id = p_plan_id and user_id = auth.uid() and seen_at
  is null` (so a second call changes nothing, not even `updated_at`); returns whether the plan is
  the caller's (`exists (…)`), never another user's information. `grant execute … to
  authenticated`.
- **Grants and RLS** (deny by default, §4.5): `day_plans` — `select` own only (plans are written
  by `apply_system_event` in 4.9c; `seen_at` by `mark_plan_seen`); `plan_block_state`,
  `item_state`, `daily_activity` — `select` own; `insert` own with `is_active()`; `update` own with
  `is_active()` **on non-key columns only** (decision 11): `item_state` — every column except
  `user_id` and `item_id`; `daily_activity` — `minutes_by_track`, `items_done`, `completed`,
  `version`, `rules_version`; `plan_block_state` — `status`, `minutes`, `note`, `auto`,
  `checked_in_at`, `version`, `rules_version`; `item_state` also `delete` own with `is_active()`
  (`track.reset` inside the invoker `apply_event`, 4.9b). No `anon` access. Policies use `(select auth.uid())` and
  `(select public.is_active())` as in 000100.

- [ ] **Step 1: Write the failing pgTAP** `070-derived-tables.test.sql` (`select plan(n)`, helpers
  from `_helpers.psql`; plans are inserted as `postgres` with `tests.clear_authentication()`):
  1. the four tables exist with RLS on (and 001's invariants still pass);
  2. `select is(public.rules_version(), 2, 'the running rules_version() equals lib/domain/rules.ts
     RULES_VERSION');` — this exact shape, which the new sql-sync case reads (decision 18); a
     learner event's stored `rules_version` = 2;
  3. a learner sees only their own plans, block states, item states and daily activity; cannot
     insert or update `day_plans` (42501);
  4. `mark_plan_seen`: own unseen plan → true and `seen_at` set; a second call → true and
     `seen_at`, `updated_at` unchanged; another user's plan → false and that plan unchanged; a
     pending user → `inactive`; anon cannot execute;
  5. a learner's direct event insert with another user's `plan_id` → `forbidden_plan_id`; with
     their own → ok; with a nonexistent one → `forbidden_plan_id` too (the BEFORE trigger runs
     before the foreign key); inserted as `postgres` with a nonexistent `plan_id` → `23503`;
  6. bounds: the 5001st `item_state` insert → `too_many_items` (insert 5000 with
     `generate_series`); a `daily_activity` insert two days back → `invalid_local_day`, today
     and yesterday → ok; a `plan_block_state` insert for a block id the plan does not list →
     `unknown_block`; `service_role` is not bounded; a learner `UPDATE` of
     `daily_activity.local_day`, `plan_block_state.block_id` / `plan_id` or `item_state.item_id`
     → 42501 (column grants), of `item_state.due_on` → ok;
  6b. `plan_lock_key(u, d)` is deterministic and differs for another day;
  7. account deletion (`delete from auth.users`) removes the user's plans, block states, item
     states, daily activity and events that name a plan, with no `events_are_append_only` error;
  8. `user_tracks.reset_on` exists and defaults to null; `item_state_user_due_idx` exists.
- [ ] **Step 2:** `pnpm db:reset && pnpm test:db` — 070 fails (no tables).
- [ ] **Step 3: Write the migration**; bump `RULES_VERSION` to 2 in `lib/domain/rules.ts`; update
  the 001 allowlist (`mark_plan_seen`, `plan_lock_key`) and the `rules_version` expectations in
  012, 030, 040 and 060 where they assert a value a learner wrote (a test that *sends* `rules_version: 1` may keep
  sending it — the trigger forces the current version for learners; assert 2).
- [ ] **Step 4:** `pnpm db:reset && pnpm test:db` — all green; `pnpm db:types`; `pnpm verify`
  (the sql-sync test checks `RULES_VERSION` = `rules_version()`).
- [ ] **Step 5: Commit** `feat(db): day_plans and the derived tables, mark_plan_seen, rules
  version 2`.

### Task 4.9b: `apply_event` with derived changes, versions and locks

**Spec:** §4.3 (`apply_event`), §4.4 (atomicity, locking), §4.5, §5.9 (pause, reset); decisions
9, 10, 27, 33. **[RF-2].** **Files:**

- Create: `supabase/migrations/20260926000200_apply_event_derived.sql`,
  `supabase/tests/database/071-apply-event-derived.test.sql`, `lib/events/derived.ts`
  (+ `derived.test.ts`)
- Modify: `lib/events/apply.ts` (+ `apply.test.ts`), `lib/supabase/database.types.ts` (the new
  public function `apply_derived_changes` appears), `supabase/tests/database/001-schema-invariants.test.sql`
  (allowlist: `apply_derived_changes`), `supabase/tests/database/040-apply-event.test.sql` (its four
  `not_implemented` expectations become: `item.result` without `item_id` → `invalid_event`;
  `track.reset` on an unenrolled track → `track_not_enrolled`; `track.paused` with `p_changes`
  `[{"table":"item_state"}]` → `invalid_event`; `track.paused` with `p_expected`
  `{"item_state:x":1}` → `invalid_event`)

**SQL** — `create or replace function public.apply_event(p_event jsonb, p_changes jsonb default
'[]', p_expected jsonb default '{}')` (same signature, `SECURITY INVOKER`):

1. Signed in, own user only (unchanged).
2. Every learner type is implemented (no more `not_implemented`). Validation (`invalid_event`):
   the M2 checks, plus `item_id` required for `item.result`, `lesson.completed`,
   `exercise.submitted`, `prompt.completed`, `item.skipped`, `item.readded`; `plan_id`,
   `block_id` and `track_id` required for `block.checked_in`; `p_changes` a JSON array (≤ 16
   elements) and `p_expected` an object; `local_day`, when present, a valid date.
3. Active users only (unchanged).
4. **Plan lock** (§4.4): when `plan_id` is set, `select plan_date … from public.day_plans where id
   = plan_id and user_id = v_uid` (not found → `invalid_event`), then
   `pg_advisory_xact_lock(public.plan_lock_key(v_uid, plan_date))` — before any row lock, and the
   same key 4.9c takes first, so a result, an auto check-in and a plan rebuild never interleave or
   deadlock (decision 33).
5. Duplicate id → `{ outcome: 'duplicate', versions: {} }` before any change (unchanged).
6. The event insert (unchanged), then `select local_day` of the new row; when `p_event ?
   'local_day'` and it differs → `raise exception 'day_changed'` (decision 10).
7. State changes: the M2 cases, with `track.enrolled`'s upsert also resetting `new_per_day`,
   `throttle`, `weekly_template` to null and `include_bonus` to false; `track.updated` matching
   `status <> 'removed'` only (a removed track → `track_not_enrolled`); plus
   - `track.reset`: the track must be enrolled with status `active` or `paused` (removed →
     `invalid_transition`, none → `track_not_enrolled`); `delete from public.item_state where
     user_id = v_uid and track_id = v_track`; `update public.user_tracks set reset_on =
     <event local_day>`;
   - `track.resumed`: after the status update, `update public.item_state set due_on = due_on +
     (v_payload ->> 'pausedDays')::integer, version = version + 1 where user_id = v_uid and
     track_id = v_track and due_on is not null`.
8. Derived rows: `v_versions := public.apply_derived_changes(v_uid, p_event, v_local_day,
   p_changes, p_expected)`; return `{ outcome: 'applied', versions: v_versions }`.

`public.apply_derived_changes(p_user_id uuid, p_event jsonb, p_local_day date, p_changes jsonb,
p_expected jsonb) returns jsonb` — `SECURITY INVOKER` (as its caller: RLS for learners, the owner
inside `apply_system_event`), `search_path ''`, executable by `authenticated` and `service_role`
(001 allowlist; calling it directly gives a learner nothing a direct write would not):

| Event type | Allowed tables and keys |
| --- | --- |
| `item.result`, `lesson.completed`, `exercise.submitted`, `prompt.completed` | `item_state` (row `item_id` = the event's), `daily_activity` |
| `item.skipped`, `item.readded`, `item.snapshot` | `item_state` (the event's item) |
| `block.checked_in` | `plan_block_state` (row `plan_id` / `block_id` = the event's), `daily_activity` |
| anything else | none — `p_changes` must be `[]` |

For each change `{ table, row }`: the key is `item_state:<item_id>`,
`plan_block_state:<plan_id>/<block_id>` or `daily_activity:<local_day>`; `p_expected` must hold
it (else `invalid_event`), and every `p_expected` key must belong to a change (else
`invalid_event`); expected `0` → `insert … on conflict do nothing` with `version 1` (no row
inserted → `version_conflict`); expected `n` → `update … set <columns>, version = version + 1 where
<key> and user_id = p_user_id and version = n` (no row → `version_conflict`). `user_id` is always
`p_user_id` (never from the row); `rules_version` is the event's; `plan_block_state.checked_in_on`
is `p_local_day` on insert and never changes on update, `checked_in_at` is `now()`. Returns `{
"<key>": <new version>, … }`.

**TypeScript** — `lib/events/derived.ts` (server code, not `server-only`: pure mapping):

```ts
export type VersionMap = {
  readonly items: Readonly<Record<string, number>>
  readonly blocks: Readonly<Record<string, number>> // blockKey(planId, blockId)
  readonly days: Readonly<Record<LocalDay, number>>
}
export const NO_VERSIONS: VersionMap // all three empty
export type DerivedWrite = { readonly changes: Json[]; readonly expected: Record<string, number> }
/** The rows that differ between `before` and `after` (deep equality) as p_changes, each with its
 *  version from `versions` (0 when absent) in p_expected. Used only for the event types of the
 *  `apply_derived_changes` table above; every other type — `track.reset` and `track.resumed`
 *  included, whose derived effects SQL applies itself — sends no derived write. A row missing
 *  from `after` throws (deletions happen only in SQL). */
export function derivedWrite(before: DerivedState, after: DerivedState, versions: VersionMap): DerivedWrite
/** Row mappers: snake_case database rows ↔ domain state (version columns dropped / collected). */
export function itemStateFromRow(row: ItemStateRow): ItemState
export function blockStateFromRow(row: BlockStateRow): BlockState
export function dailyActivityFromRow(row: DailyActivityRow): DailyActivity
export function derivedStateFromRows(rows: {
  items: readonly ItemStateRow[]; blocks: readonly BlockStateRow[]; days: readonly DailyActivityRow[]
}): { readonly state: DerivedState; readonly versions: VersionMap }
```

(`ItemStateRow` etc. = `Database['public']['Tables'][…]['Row']`; `minutes_by_track` is Zod-checked
as `Record<string, number>` and read as `{}` when malformed.) `lib/events/apply.ts`:
`EventInput` gains `localDay?: LocalDay` (sent as `p_event.local_day`); `applyLearnerEvent(supabase,
event, derived?: DerivedWrite)` passes `p_changes` / `p_expected`; `EventErrorCode` gains
`version_conflict` and `day_changed` (user message `vi.errors.saveFailed` — no new copy);
`export function isRetryable(error: unknown): boolean` (those two codes) and `export async function
withRetry<T>(attempt: () => Promise<T>, attempts = 3): Promise<T>` (re-runs `attempt` — which
reloads and recomputes — only on a retryable error, at most `attempts` times, then rethrows).

- [ ] **Step 1: Failing pgTAP** `071-apply-event-derived.test.sql` (a local `tests.event` helper
  with `item_id` / `plan_id` / `block_id` / `local_day`, plans inserted as `postgres`):
  1. `item.result` with `item_state` (expected 0) and `daily_activity` (expected 0) → applied,
     versions `{ "item_state:dsa:lc-0001": 1, "daily_activity:<day>": 1 }`, the rows stored with
     `user_id` = the caller whatever the row said, `rules_version` 2;
  2. **[RF-2]** the same event id again (even with different changes) → `duplicate`, rows and
     event count unchanged, quota unchanged;
  3. **[RF-2]** a new event with expected 0 for an existing row → `version_conflict`, and **no
     event row** and no quota increment remain; expected 1 when the row is at 2 → the same;
  4. a change without its `p_expected` key, an extra `p_expected` key, a change for another item
     than the event's, `plan_block_state` on an `item.result`, any change on `track.updated` →
     `invalid_event`;
  5. `block.checked_in` insert → `checked_in_on` = the event's local day; an update from a later
     transaction keeps `checked_in_on` and bumps `version`;
  6. a `block.checked_in` naming another user's plan → `invalid_event`; the advisory lock is held
     (in the same transaction, `pg_locks` has an `advisory` row whose `(classid, objid)` are the
     high and low 32 bits of `plan_lock_key(<user>, <plan_date>)`);
  7. `local_day` mismatch → `day_changed`, nothing stored;
  8. `track.reset` deletes only that track's `item_state` rows, sets `reset_on`; on a removed track
     → `invalid_transition`; on no enrollment → `track_not_enrolled`;
  9. `track.paused` then `track.resumed { pausedDays: 5 }` shifts that track's `due_on` by 5 (null
     ones stay null, other tracks untouched) — the same fixture as 4.2's resume test;
  10. re-enrolling (`track.enrolled`) after setting `newPerDay`, `throttle`, `weeklyTemplate`,
      `includeBonus` resets them; `track.updated` on a removed track → `track_not_enrolled`;
  11. every M2 case of 040 still passes with its four updated expectations (Files); run the whole
      suite.
- [ ] **Step 2: Failing Vitest** `derived.test.ts` / `apply.test.ts`: `derivedWrite` emits only
  changed rows, snake_case, expected from the version map (0 for new rows), keys as above, throws on
  a deleted row; `derivedStateFromRows` round-trips; `applyLearnerEvent` sends `p_changes`,
  `p_expected` and `local_day`; `version_conflict` / `day_changed` map to `EventError` with
  `vi.errors.saveFailed`; `withRetry` retries retryable errors up to 3 attempts and rethrows others
  at once.
- [ ] **Step 3:** `pnpm db:reset && pnpm test:db`, `pnpm vitest run lib/events` — fail.
  **Step 4:** write the migration and the TypeScript. **Step 5:** both green; `pnpm db:types` and
  commit its diff (it adds `apply_derived_changes`); `pnpm verify`.
- [ ] **Step 6: Commit** `feat(db): apply_event writes derived rows with versions, plan locks,
  track reset and resume`.

### Task 4.9c: `apply_system_event` — plan generation and the auto check-in

**Spec:** §2.3 (untouched plans), §4.3, §4.4 (`plan.generated`, auto `block.checked_in`), §5.4
steps 1, 4 and "settings changes", §5.5 (auto check-in); decisions 10, 12, 30, 33. **Files:**

- Create: `supabase/migrations/20260926000300_plan_system_events.sql`,
  `supabase/tests/database/072-plan-events.test.sql`, `lib/events/plans.ts` (+ `plans.test.ts`)
- Modify: `lib/events/apply.ts` (+ test), `lib/supabase/database.types.ts`,
  `supabase/tests/database/{001,041}-*.sql` (041: a non-empty `p_changes` on
  `onboarding.completed` → `invalid_event` instead of `not_implemented`; a case that expects
  `not_implemented` uses a type that stays unimplemented, e.g. `plan.extra_added`)

**SQL** — `create or replace function public.apply_system_event(p_user_id uuid, p_event jsonb,
p_changes jsonb default '[]', p_expected jsonb default '{}')` (`SECURITY DEFINER`, secret key only,
unchanged grants). It implements `onboarding.completed` (as M2), plus:

- **`plan.generated`** — `p_changes` = `[{ "table": "day_plans", "row": { "plan_date", "blocks",
  "roadmap_weeks" } }]`, `p_expected` = `{ "day_plans:<plan_date>": 0 | n }`, payload `{ mode,
  planVersion }`. Take the `(user, plan_date)` advisory lock **first**
  (`pg_advisory_xact_lock(public.plan_lock_key(p_user_id, <row plan_date>))`), then the profile
  row lock (M2), then the duplicate-id check (decision 33 — the reverse order deadlocks with
  `apply_event`).
  - `baseline` / `resume`: expected must be 0 and `planVersion` 1. A plan already exists for the
    date → return `{ outcome: 'plan_exists', plan_id: <its id>, versions: {} }`, **no event**.
    Otherwise insert the plan (`version 1`, `source 'baseline'`, `rules_version` the event's),
    then the event with `plan_id` = the new id; return `{ outcome: 'applied', plan_id, versions: {
    "day_plans:<date>": 1 } }`.
  - `rebuild`: expected n ≥ 1 and `planVersion` = n + 1. No plan with version n for the date →
    `version_conflict`. Touched (decision 12: a `plan_block_state` row, or an event with this
    `plan_id` whose type is not `plan.generated` / `plan.ai_proposed` / `plan.ai_applied` /
    `plan.ai_skipped`) → `{ outcome: 'plan_in_use', plan_id, versions: {} }`, no event.
    Otherwise update `blocks`, `roadmap_weeks`, `version = n + 1`, `source = 'baseline'`,
    `rules_version`; **keep `seen_at`**; insert the event; return `applied`.
- **`block.checked_in`** (the auto check-in, §5.5): payload `auto` must be `true` (else
  `invalid_event`); the plan lock first (`plan_date` from the user's plan named by `plan_id`; not
  theirs → `invalid_event`), then the profile lock and the duplicate check; after the event insert
  the same `local_day` check as 4.9b (`p_event.local_day` differs → `day_changed`); then the same
  derived writes as the learner path through `public.apply_derived_changes(p_user_id, …)`;
  `source` defaults to `system`. `onboarding.completed` keeps M2's order (no plan lock) and now
  rejects a non-empty `p_changes` / `p_expected` with `invalid_event`.
- Every other system type stays `not_implemented`, each with its owning task: `plan.extra_added`
  → 5.4; `plan.ai_proposed` / `ai_applied` / `ai_skipped` → 6.5; `user_item.*` and
  `roadmap.override_*` → 6.6; `admin.bot_token_rotated` → 6.3; `item.snapshot` → the compaction job
  (release table "later"; ADR-0031 names its trigger, the 350 MB warning). The other admin events
  have their own functions (M2).

**TypeScript** — `lib/events/plans.ts` (`server-only`):

```ts
export type PlanWriteMode = 'baseline' | 'resume' | 'rebuild'
export type PlanWriteOutcome = 'applied' | 'duplicate' | 'plan_exists' | 'plan_in_use'
/** plan.generated through apply_system_event (secret-key client, after requireActive). */
export async function storePlan(
  admin: SupabaseClient<Database>,
  userId: string,
  input: {
    readonly eventId: string
    readonly plan: DayPlan
    readonly mode: PlanWriteMode
    /** 0 for baseline / resume; the current version for rebuild. */
    readonly expectedVersion: number
  },
): Promise<{ readonly outcome: PlanWriteOutcome; readonly planId: string | null }>
/** A day_plans row → StoredPlan; blocks and roadmap_weeks Zod-validated (planBlockSchema,
 *  trackSnapshotSchema); a malformed row → null (M5 treats it as no plan and rebuilds). */
export function storedPlanFromRow(row: DayPlanRow): StoredPlan | null
```

`lib/events/apply.ts`: `applySystemEvent(admin, userId, event, derived?: DerivedWrite)` passes the
derived write (the auto check-in); its outcome type is unchanged.

- [ ] **Step 1: Failing pgTAP** `072-plan-events.test.sql` (as `service_role` via
  `tests.authenticate_as_service_role()`):
  1. baseline → `applied` with a `plan_id`, one plan (version 1, `seen_at` null) and one
     `plan.generated` event carrying that `plan_id`, source `system`;
  2. a second baseline for the same date (new event id) → `plan_exists` with the first plan's id,
     no second event; the same event id again → `duplicate`;
  3. rebuild of an untouched plan (expected 1, `planVersion` 2) → version 2, new blocks,
     `seen_at` kept (set it first with `mark_plan_seen` as the learner), `source` `baseline`; the
     generation events alone do not make it touched;
  4. rebuild after a learner check-in on it → `plan_in_use`, plan unchanged; after a learner
     `item.result` carrying its `plan_id` → `plan_in_use`;
  5. rebuild with a stale expected version → `version_conflict`; `planVersion` ≠ n + 1 →
     `invalid_event`;
  6. auto check-in (`block.checked_in`, `auto: true`) with `plan_block_state` and
     `daily_activity` changes → rows written, `auto` true, event source `system`; `auto: false` →
     `invalid_event`; a `local_day` that is not the database's → `day_changed`, nothing stored;
  7. a plan whose `blocks` JSON exceeds 128 KB → the check constraint error; an inactive user →
     `inactive`; `authenticated` cannot execute `apply_system_event` (041 still passes; its
     `not_implemented` case uses a type that is still not implemented, e.g. `plan.extra_added`).
- [ ] **Step 2: Failing Vitest** `plans.test.ts` (Supabase client mocked as in `apply.test.ts`):
  `storePlan` sends the row (`plan_date`, `blocks`, `roadmap_weeks` from `plan.tracks`), payload
  `{ mode, planVersion }`, `p_expected`; maps each outcome and `plan_id`; maps RPC errors to
  `EventError`; `storedPlanFromRow` parses a valid row and returns null for bad blocks JSON.
- [ ] **Step 3:** run both — fail. **Step 4:** implement. **Step 5:** `pnpm db:reset && pnpm
  test:db`, `pnpm db:types`, `pnpm verify` — green.
- [ ] **Step 6: Commit** `feat(db): plan generation and auto check-in through apply_system_event`.

### Task 4.10: Plan catalog adapter (content → domain)

**Spec:** §3.2–§3.5 (item types, manifests), §5.4 estimates, §5.7 `srs.byType`; decision 4; M2
ruling R14 (readers validate the learner-writable JSON columns). **Files:**

- Create: `lib/content/plan-catalog.ts`, `lib/content/plan-catalog.test.ts`

**Interfaces:**

```ts
// lib/content/plan-catalog.ts (not server-only: pure; M5 loaders and tools/sim import it)
/** The engine's view of `catalog` (decision 4): every item, drafts and retired included (the
 *  engine filters by status), authored decks only. */
export function toPlanCatalog(catalog: Catalog): PlanCatalog

/** A user_tracks row as M5's loader reads it (camelCase; JSON columns unvalidated). */
export type EnrollmentInput = {
  readonly trackId: string
  readonly roadmapVariant: string
  readonly status: string
  readonly startDate: string
  readonly budgetMinutes: number
  readonly newPerDay: number | null
  readonly throttle: unknown
  readonly weeklyTemplate: unknown
  readonly includeBonus: boolean
  readonly resetOn: string | null
}
/** Resolves every null / invalid setting to the track default (R14 reader rule): newPerDay null →
 *  defaults.newPerDay; throttle / weeklyTemplate invalid or null → the track's; unknown track or
 *  status → null (the row is ignored). */
export function toEnrollment(input: EnrollmentInput, catalog: PlanCatalog): Enrollment | null
```

Mapping per item (`ITEM_TYPE_CORES[item.type]`, the item's track manifest): `srs` = `core.srs ?
{ ...manifest.srs without byType, ...manifest.srs.byType?.[type] } : null`; `minutes[mode] =
core.estimateMinutes(item.content, manifest, mode)` for every `ITEM_MODES` member (derived cards
use their own track's manifest); `reviewModes` = problem; `difficulty` (problem);
`tier`, `deckId`, `derivedFrom`, `hasExample` (flashcard); `about` (lesson); `deepDiveId`
(problem: the ID of the lesson whose `about` is this problem, whatever its status and whether or
not the problem has a note — not `note.deepDiveId`, which is null without a note); `tag`,
`repeatable` (prompt); `week`, `topicId`, `status` as in the catalog. Tracks:
`status`, `weeklyTemplate`, `defaults`, and `catalog.roadmaps[trackId]` copied into `PlanRoadmap`s.

- [ ] **Step 1: Write the failing tests:**
  - on the real generated catalog (`@/.generated/catalog`): every catalog item is mapped; every
    `minutes` value is a positive number; `dsa:lc-0001` (Easy) → `{ new: 20, recall: 5, redo: 12,
    review: 5, 'explain-aloud': 5 }`, `srs` `[7, 21, 60]` / 3 / 2, `reviewModes: true`; an English
    card → `srs` `[1, 3, 7, 14]` / 1 / 2, `minutes.new` 1.5; a derived card → `tier: 'derived'`,
    `derivedFrom` its source; `dsa:lesson-arrays-hashing` → `about: null`, minutes 25; the mock
    interview prompt → `tag: 'mock-interview'`, `repeatable: true`, minutes 45; both tracks'
    roadmaps present; `english:deck-w01-standup`'s `cardIds` start with the deck file's first card;
  - a hand-built DSA manifest with `srs.byType.flashcard` → a DSA card gets `[1, 3, 7, 14]` /
    relearn 1 / `masteredAfter` 2 (inherited);
  - a hand-built catalog with a deep-dive lesson `about` a problem that has **no note** → that
    problem's `deepDiveId` is the lesson (a draft lesson too; the engine checks the status);
  - **outcome sync:** for every item-type core with `srs: true`, each `outcomes` entry equals
    `RESULT_OUTCOMES[name]`, and every `RESULT_OUTCOMES` name belongs to such a core; a type-level
    check that `ItemMode` and content `Mode` have the same members;
  - `toEnrollment`: defaults resolved (`newPerDay: null` on English → 8; DSA → null); a malformed
    `throttle` (`[{ dueAbove: 'x' }]`) or `weeklyTemplate` (`{ mon: [{ kind: 'nap' }] }`) → the
    track's; a valid custom template is kept; unknown track → null; status `'archived'` → null.
- [ ] **Step 2:** run — fail. **Step 3:** implement (`lib/content` may branch on item type).
  **Step 4:** pass; `pnpm verify`.
- [ ] **Step 5: Commit** `feat(content): plan catalog adapter for the engine`.

### Task 4.11: Settings pause / resume — the real `pausedDays` query (e2e)

**Source:** M2 deferred minor (task 2.11): `readLastPausedDay` in `features/settings/reads.ts` is
mocked in every unit test, and the e2e never checks the stored payload. From 4.9b on,
`track.resumed.pausedDays` shifts the track's due dates, so the real query must be pinned before M4
merges (decision 27). **Spec:** §5.9 (pause shifts due dates). **Files:**

- Modify: `e2e/support/users.ts` (two service-role helpers), `e2e/settings.spec.ts` (one test)

**Interfaces** (`e2e/support/users.ts`, secret key of the local stack like the existing helpers):

```ts
/** Sets the enrollment to paused and records a `track.paused` event `daysAgo` days in the past
 *  (inserted with the secret key, so `occurred_at` is not forced; the trigger computes local_day). */
export async function seedPausedTrack(userId: string, trackId: string, daysAgo: number): Promise<void>
/** The payload of the user's latest event of `type` for `trackId`, or null. */
export async function latestEventPayload(
  userId: string,
  type: string,
  trackId: string,
): Promise<Record<string, unknown> | null>
```

- [ ] **Step 1: Write the failing test** in `e2e/settings.spec.ts`: an onboarded learner enrolled
  in English (`seedLearnerSetup`), `seedPausedTrack(id, 'english', 5)`; in `/settings` the English
  row shows the paused state; click "Tiếp tục" (the resume button); then
  `latestEventPayload(id, 'track.resumed', 'english')` → `{ pausedDays: 5 }` and the enrollment is
  active again. A second case: paused **today** (`daysAgo: 0`) → `{ pausedDays: 0 }`.
- [ ] **Step 2:** with the stack lock (`E2E_LOCK`), `pnpm test:e2e --grep pausedDays` — fails
  (helpers missing). **Step 3:** add the helpers. **Step 4:** passes on both projects (desktop,
  mobile); if it fails on the real query, fix `readLastPausedDay` (the query must pick the latest
  `track.paused` of that track by `occurred_at`) and say so in the report.
- [ ] **Step 5:** `pnpm verify`. **Commit** `test(settings): pin the real pausedDays query of
  resume (e2e)`.

### Task 4.12: Schedule-history floor and first-version lock

**Source:** M2 deferred minor (task 2.4, triaged to M4): the history guard lets a non-first
schedule version take effect at `now()` instead of at the next day start, so a direct `apply_event`
call can move the user's own local day back; the first-version exemption is unbounded and
concurrent first inserts are unlocked. **Spec:** §4.1 (`schedule_versions`), §5.9 (changes take
effect at the next day start), ADR-0017; decision 27. **Files:**

- Create: `supabase/migrations/20260926000400_schedule_history_floor.sql`,
  `supabase/tests/database/013-schedule-history-floor.test.sql`
- Modify: `supabase/tests/database/{011,012}-*.sql` (cases that insert non-first versions at
  arbitrary near-future times move them to the next day start), `docs/adr/0017-*.md` (one
  paragraph)

**The migration** — `create or replace function public.schedule_versions_guard_history()` (the
000100 body, with its update and delete rules unchanged; insert rules):

- The **first** version of a user (no row yet) is allowed at any time only while the profile's
  `onboarded_at` is null, and is checked under the per-user advisory lock the R14 cap already uses
  (`hashtextextended('schedule_versions:' || user_id, 0)`), so two concurrent first inserts cannot
  both count as first.
- Every **later** version inserted by `authenticated` needs `effective_at >=` the next day start
  of the version in force at `now()`, minus 65 minutes: `((public.user_local_day(new.user_id,
  now()) + 1) + <in-force day_starts_at>) at time zone <in-force timezone>` — 5 minutes of clock
  skew (the existing allowance) plus one hour for a day start inside a DST gap or overlap, where
  Postgres and `nextDayStart` may pick different instants. Otherwise `schedule_backdated`.
- The secret-key role and definer functions are not restricted (as before).

- [ ] **Step 1: Failing pgTAP** `013-schedule-history-floor.test.sql`: a second version effective
  `now()` → `schedule_backdated`; effective at the next day start (computed in the test with the
  same expression) → ok; 60 minutes before it → ok (tolerance); 2 hours before it →
  `schedule_backdated`; a first version for a profile with `onboarded_at` set → `schedule_backdated`;
  a first version during onboarding (`onboarded_at` null) effective `now() − 1 minute` (what
  onboarding sends) → ok; an upsert of an existing pending version still works; the settings flow's
  own values (TypeScript `nextDayStart` for `Asia/Ho_Chi_Minh` 04:00 and for `America/New_York`
  02:30, a DST-gap day start) pass.
- [ ] **Step 2:** `pnpm db:reset && pnpm test:db` — 013 fails; **Step 3:** write the migration and
  move the 011 / 012 cases that now fail to valid times (never weaken their intent); **Step 4:**
  all green; `pnpm db:types` (no diff expected); then, still the wave's stack holder, `pnpm
  test:e2e --grep "onboarding|settings"` (onboarding and settings write schedule versions).
- [ ] **Step 5:** ADR-0017 gains a paragraph: the database now enforces the next-day-start rule
  for later versions (with the 65-minute tolerance) and bounds the first-version exemption.
  `pnpm verify`. **Commit** `fix(db): schedule versions take effect no earlier than the next day
  start`.

### Task F1: M3 follow-ups — separate PR `fix/m3-followups`

**Source:** the M3 PR A re-review residuals m1–m4 (ruling M3-R16). Branch `fix/m3-followups` from
`origin/main` in `wt-f1`; PR "fix: M3 follow-ups"; merged by the controller once CI and its review
are green (like #6). **Files:**

- Modify: `tools/content/derived.ts` (+ its test), the fence-parity test (the M3 PR A fix-pass
  test that pins "the build key = the fence text as the renderer receives it" — find it with
  `rg -n "fence" tools/content features/items --glob '*.test.*'`), `vitest.config.ts` (+ a guard
  test), `tools/content-verify/workflow.test.ts`

- [ ] **m1:** the retired-card draft check in `derived.ts` (`reviewedSource` / the `draftTrack`
  flag around lines 104–143) reads the **locked card's own source track** (the track of
  `parsed.sourceId`), not `deck.from.track`. Failing test first: a derived deck whose `from.track`
  is active while a locked card's source item belongs to a draft track → the retired card shows the
  source ID, never the draft problem's text.
- [ ] **m2:** the fence-parity test gains a CRLF case and a "no newline at end of file" case, both
  asserting the same parity as the LF case.
- [ ] **m3:** `vitest.config.ts` imports the shared remark plugins with an explicit extension (or
  whatever removes Vite's config-loader warning — reproduce the warning first with `pnpm vitest run
  tools/guards 2>&1 | grep -i warn`), and a guard test pins that the `.mdx` transform uses
  `remarkPlugins` from `tools/content/mdx/plugins` (import both and compare, or parse the config
  source).
- [ ] **m4:** `workflow.test.ts` pins the ACL post-check's `left` computation
  (`.github/workflows/content-verify.yml` ~line 210: `awk '/^default:user::/ { n++ } END { print
  n + 0 }'`) — assert the exact awk program and that its result feeds the `-ne 0` check.
- [ ] `pnpm verify`; commits `fix(content): …`, `test(content): …`, `build: …`, `test(ci): …` (one
  per item); push, PR, CI green, review, controller merges; then rebase nothing (M4 touches none
  of these files).

### M4 finish

- [ ] Whole-branch review (`scripts/review-package` over `86b637b..HEAD`) on the most capable
  model, against this section and spec §4–§5; one fix pass; one re-review (M2/M3 pattern).
- [ ] `pnpm db:reset && pnpm verify:full` in the integration worktree (`verify` + `test:db` +
  `test:e2e`, e2e lock held).
- [ ] Push `feat/m4-plan-engine`, open the PR "M4: plan engine + spaced repetition" (summary,
  decisions, owner question answers, the calibrated simulation numbers, the post-merge `db push`
  step); CI green: verify, e2e, db, content-build, content-verify, CodeQL.
- [ ] **Ask the owner who merges.** After the merge: on the production project, check `select
  count(*) from public.events where plan_id is not null` = 0 (decision 30; Management API query
  endpoint), then `supabase db push` of the four M4 migrations (docs/ops/staging.md; linked CLI via
  the pooler, `.env.local` loaded into the shell, nothing printed), migration list local = remote; archive the ledger; update the
  memory file; write the M5 hand-off.
