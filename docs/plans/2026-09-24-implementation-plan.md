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
- **Execution now:** M0 only, then stop for the owner's review.

## Global Constraints

Every task implicitly includes these (values copied from the spec).

- **Versions:** Node ≥ 22.12 (`.nvmrc` `22`); pnpm `11.1.1` (`packageManager`); Next `16.3.6`;
  React `19.3.0`; **TypeScript `6.0.x` — not 7** (typescript-eslint supports < 6.1); **ESLint
  `9.39.x` — not 10**; Tailwind `4.3.x`. Install with exact versions (`--save-exact`).
- **Dependencies:** only those in platform design §7.10. Anything else → ask the owner first
  (known upcoming ask: `sonner` for toasts in M1).
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

## Review Focus

Inputs and conditions the spec implies but no happy-path test exercises — most likely to bite a
real learner first. Each line's test is added to the owning task below (marked **[RF-n]**).

1. **[RF-1] Studying around the day boundary and across time zones** — a result at 01:30 local
   with `day_starts_at` 04:00 counts for the *previous* day; moving east/west never creates two
   plans for one date or loses the streak (owner: M4-1, M4-10).
2. **[RF-2] Double taps and retries** — the same check-in or grade sent twice (double tap, flaky
   network, two tabs) records one event and one state change; a version conflict retries cleanly
   (owner: M5-2, M4-10).
3. **[RF-3] Vietnamese text in every form** — decomposed (NFD) input from macOS/iOS keyboards is
   stored as NFC; content IDs and slugs stay ASCII; diacritics never break search, sorting or
   length limits (owner: M3-2, M5-2).
4. **[RF-4] Nothing to show yet** — a brand-new learner, a start date in the future, a week without
   notes or lessons, an empty review queue: every screen shows a meaningful state, never a crash
   or a blank page (owner: M4-7, M5-1, M5-3).
5. **[RF-5] Coming back after days away on another device** — the gate is closed, the paused banner
   and "Học tiếp hôm nay" appear, exactly one plan is created, the review backlog is throttled
   (owner: M4-4, M5-1).

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
| 0.10 | GitHub security settings, PR, CI green on GitHub | `gh pr checks --watch` |

### M1 — Component library + `/dev/components` (v1.0)

| Task | Files | Tests that must exist | Verify |
| --- | --- | --- | --- |
| 1.1 shadcn init + React test setup | `components.json` (new-york, `stone`, `radix`, cssVariables), merge `shadcn eject` CSS into `app/globals.css` without changing tokens; add `class-variance-authority`, `lucide-react`, `radix-ui`, `@vitejs/plugin-react`, `jsdom`, `@testing-library/react`, `@testing-library/user-event`; `vitest.config.ts` react plugin | tokens-sync test still green; a jsdom render smoke test | `pnpm verify` |
| 1.2 `lib/i18n/vi.ts` | UI strings (Đóng, Mở menu, …) typed as `const` | key-presence test | `pnpm test` |
| 1.3 ui: Button, Input, Label, Textarea | `components/ui/*` with cva variants/sizes from DESIGN_SYSTEM §9 | render each variant; disabled/loading; focus ring class; 44 px default size class | `pnpm verify` |
| 1.4 ui: Card, Badge, Separator, Skeleton, Progress, Tooltip | `components/ui/*` | variants render; Progress `aria-valuenow` | `pnpm verify` |
| 1.5 ui: Dialog, Sheet, DropdownMenu, Tabs, ToggleGroup, Toast | `components/ui/*` — **ask owner before adding `sonner`** | focus trap + restore; `Esc` closes; labels from `vi.ts` | `pnpm verify` |
| 1.6 patterns: PageHeader, Section, StatCard, StatusPill, StreakBadge, ProgressRing | `components/patterns/*` | StatusPill renders icon + label for every status (§3.3); ProgressRing value/aria | `pnpm verify` |
| 1.7 patterns: EmptyState, ErrorState, LoadingState, DataState, ConfirmDialog, DataList, Banner | `components/patterns/*` | DataState renders all 4 states | `pnpm verify` |
| 1.8 pattern: CalendarHeatmap | `components/patterns/calendar-heatmap/*` | year view ≥ 768 px, month view < 768 px with 44 px cells; dots on active days; arrow-key navigation; table view; legend | `pnpm verify` |
| 1.9 pattern: AppShell | sidebar ≥ 1024 px, bottom nav < 1024 px, account menu with admin entry (admins), ThemeToggle | nav `aria-current`; admin entry only when `isAdmin` | `pnpm verify` |
| 1.10 `/dev/components` + catalog guard | `app/dev/components/*`, catalog registry, `docs/design/COMPONENTS.md` entries | Playwright + axe over the catalog in both themes; architecture test: every component file has a COMPONENTS.md entry and a catalog entry | `pnpm verify && pnpm test:e2e` |

### M2 — Auth, onboarding, settings (v1.0)

| Task | Files | Tests that must exist | Verify |
| --- | --- | --- | --- |
| 2.1 Supabase local + env | `supabase` CLI dev dep, `supabase/config.toml` (Google/GitHub from env; email only when `AUTH_TEST_LOGIN`), `lib/env.ts` (Zod server/client schemas, §2.5 v1.0 vars) | env: missing var fails; `AUTH_TEST_LOGIN=true` + `VERCEL_ENV=production` throws | `pnpm verify` |
| 2.2 Migration: profiles, schedule_versions, user_tracks | `supabase/migrations/*`, `supabase/tests/database/*.sql` | pgTAP: profile created `pending` on sign-up; column grants; `is_admin`/`is_active`; `admin_*` functions check admin and write audit events; `admin_bootstrap` | `pnpm test:db` |
| 2.3 Events core | migration: `events`, `event_quota` + `SECURITY DEFINER` quota trigger, `local_day` SQL function, `apply_event` / `apply_system_event` (state-table events only; derived tables in M4); `lib/domain/events.ts` — Zod payload schemas for every event type (§4.4 table) | pgTAP: forced `actor_id`/`source`; `local_day` computed in DB; 501st learner event → `quota_exceeded`; learners cannot read/write `event_quota` | `pnpm test:db` |
| 2.4 Supabase clients, proxy, DAL, guards | `lib/supabase/{client,server,proxy,admin}.ts`, `proxy.ts` (matcher: pages only), `lib/auth/dal.ts`, `lib/auth/guards.ts` | DAL returns cached profile; `requireActive` redirects pending; architecture test: every `'use server'` module and route handler calls a guard | `pnpm verify` |
| 2.5 Sign-in, callback, pending | `app/(public)/sign-in`, `app/(public)/auth/callback/route.ts` (admin bootstrap), `app/(account)/pending`, `supabase/seed.sql` (synthetic test users only) | e2e with test login: pending user sees `/pending`; admin email becomes active admin | `pnpm verify && pnpm test:e2e` |
| 2.6 Admin approval queue | `features/admin/*`, `app/(admin)/admin/users` | e2e: approve/reject/suspend; non-admin gets 404/redirect | `pnpm verify && pnpm test:e2e` |
| 2.7 Minimal track manifests + projection table | `content/tracks/{dsa,english}/track.yaml` (manifest fields only), tiny loader `lib/content/tracks.ts`, `lib/domain/plan/projections.ts` seeded with the §5.11 prototype table | loader parses both manifests; projection lookup interpolates and clamps | `pnpm verify` |
| 2.8 Onboarding | `features/onboarding/*`, `app/(onboarding)/onboarding` — tracks → minutes → DSA variant (default by budget, simulated finish) → start date/timezone/day start → code language → template preview; events `track.enrolled`, `schedule.changed`, `settings.changed`, `onboarding.completed` | 60 min → 8w default, 75 → 10w; finish text uses vi-VN decimal comma; e2e completes onboarding | `pnpm verify && pnpm test:e2e` |
| 2.9 Settings + account deletion | `features/settings/*`, `app/(app)/settings` (template/throttle read-only), delete account + privacy text (90-day backup note) | e2e: change timezone takes effect next day start; deletion cascades (pgTAP) | `pnpm verify && pnpm test:e2e && pnpm test:db` |

### M3 — Track manifests, content loading and validation (v1.0)

| Task | Files | Tests that must exist | Verify |
| --- | --- | --- | --- |
| 3.1 Content schemas | `lib/content/item-types/{problem,flashcard,lesson,exercise,prompt}.ts`, `lib/content/schemas/{manifest,roadmap}.ts` | valid/invalid fixtures per schema; exercise kinds; premium needs alternative | `pnpm test` |
| 3.2 `content:build` | `tools/content/build.ts`, `tools/content/allowlist.ts`, MDX safety check, `ids.lock`, `.generated/catalog.json`, MDX import map, report | cross-refs; `requires` cycles and order; anchor ≠ practice; solutions/tests required only with a note; reserved `user:` prefix; MDX: `import`/`export`/expressions/`javascript:` rejected; **[RF-3]** IDs/slugs ASCII, titles NFC | `pnpm content:build && pnpm test` |
| 3.3 MDX pipeline | `next.config.ts` (`@next/mdx`, remark plugins as strings), `mdx-components.tsx` (allow-listed components), shiki at build | lesson renders sections in order; `<Term>` sets `lang="en"`; quiz score | `pnpm verify` |
| 3.4 Item registry + track pages | `features/items/{registry.ts,<type>/Page.tsx,<type>/Row.tsx}`, `app/(app)/tracks`, `app/(app)/t/[trackId]`, `app/(app)/t/[trackId]/items/[itemId]` | no `switch` on item type outside registry (architecture test); each type renders page and row | `pnpm verify && pnpm test:e2e` |
| 3.5 `content-verify` M3a | `tools/content-verify/{orchestrator.ts,comparators.ts,validators/,runners/{python,java,go}}`, `.github/workflows/content-verify.yml` (no secrets, no network, in-job path check) | every comparator; timeout; `function` signatures pass; unsupported kinds → `compile-only` | `pnpm content:verify` |
| 3.6 DSA metadata + roadmaps | all ~110 `problem.yaml`, `roadmaps/{10w,8w}.yaml`, prompts (mock interview) | build passes; week sizes; prerequisites order | `pnpm content:build` |
| 3.7–3.9 DSA W1, W2, W3 content | notes + Python/Java/Go solutions + `tests.yaml` per problem; pattern lessons (arrays-hashing, two-pointers, sliding-window, stack, binary-search) — one task per week | content-verify: `tested` for `function` problems, `compile-only` for 271/155/981 | `pnpm content:build && pnpm content:verify` |
| 3.10 English manifest, roadmap, core decks W1–W10 | `content/tracks/english/**` | build passes; derived deck mapping | `pnpm content:build` |
| 3.11 English W1–W3 extended cards, exercises, weekend prompts | decks, `exercises/*.yaml`, `prompts/*.yaml` | build passes; exercise `week` set | `pnpm content:build` |

### M4 — Plan engine + spaced repetition, pure functions, TDD (v1.0)

| Task | Files (`lib/domain/…`) | Tests that must exist |
| --- | --- | --- |
| 4.1 Local day | `time/localDay.ts` | **[RF-1]** 01:30 with day start 04:00 → previous date; version lookup by `effective_at`; shared fixtures for the SQL parity test |
| 4.2 SRS | `srs/applyResult.ts` | every row of §5.7 table; `byType`; relearn; mastery + `item.readded`; first result per day only |
| 4.3 Projection + replay | `projection/{project,replay}.ts`, `rules.ts` | replay rebuilds all derived tables; `item.snapshot` handled; `track.reset`; pause shifts due dates |
| 4.4 Gate + resume | `plan/{gate,resume}.ts` | last *seen* plan only; unseen AI plans ignored; **[RF-5]** > 2 days + closed gate → resume plan without pointer advance |
| 4.5 Queues | `plan/queues.ts` | roadmap order; core → recap → derived → extended → bonus; drafts/retired excluded; progress-based week; recap-done derivation; exercise picker |
| 4.6 Budget + throttle | `plan/{budget,throttle}.ts` | fixed blocks reserved; review skip rule + debt cap; first-item vs throttle 0; half-fit; spill; fallback |
| 4.7 buildPlan + invariants | `plan/buildPlan.ts` + fast-check property tests | planned minutes ≤ budget or budget + largest item; every core item queued once; **[RF-4]** empty catalog/new user/future start → valid empty state |
| 4.8 Stats | `stats/{streak,weeklySummary,weakTopics}.ts` | streak across schedule change; weak topics ≥ 2 Weak |
| 4.9 Simulation + projections | `plan/__tests__/simulation.test.ts`, `tools/sim/projections.ts` (`pnpm sim:projections`) | §5.10 thresholds (recalibrated once); projection inputs hash |
| 4.10 Derived tables + SQL | migrations: `item_state`, `plan_block_state`, `daily_activity`, `day_plans` (+ `seen_at`, `updated_at`), full `apply_event`, `mark_plan_seen` | pgTAP: **[RF-1]** SQL/TS `localDay` parity on shared fixtures; **[RF-2]** duplicate event id → one row; version mismatch aborts; RLS |

Verify for every M4 task: `pnpm verify` (and `pnpm test:db` for 4.10).

### M5 — Dashboard, check-in, review (v1.0) → v1.0 launch

| Task | Files | Tests that must exist | Verify |
| --- | --- | --- | --- |
| 5.1 `/today` | `features/today/*` (queries, `ensurePlan` action, `<MarkPlanSeen>`), `app/(app)/today` | **[RF-4]** new learner / future start / missing notes states; **[RF-5]** paused banner + "Học tiếp hôm nay" after 3 days, one plan only; prefetch never sets `seen_at` | `pnpm verify && pnpm test:e2e` |
| 5.2 Check-in + results | `features/checkin/*` (sheet, one-tap, auto check-in), result actions per item type (recall/redo, flashcard grades, exercise, prompt, quiz), solution-reveal nudge | **[RF-2]** double tap → one event; retry after version conflict; **[RF-3]** NFD note stored NFC, 280-char limit counts graphemes | `pnpm verify && pnpm test:e2e && pnpm test:db` |
| 5.3 `/review` | `features/review/*` | Weak first; **[RF-4]** empty queue state | `pnpm verify && pnpm test:e2e` |
| 5.4 "Học thêm" + off-plan study | `features/today/*` | extra block auto-checked-in; reopens a closed gate | `pnpm verify` |
| 5.5 `/progress` | `features/progress/*` | heatmap year/month views; weekly summary bars with values | `pnpm verify && pnpm test:e2e` |
| 5.6 Admin overview + content | `features/admin/*` (`/admin`, `/admin/content`) | red warning for weeks reached within 14 days without notes/lessons; DB-size warnings from `ops_metrics` | `pnpm verify` |
| 5.7 Ops | migration `ops_metrics`; `.github/workflows/{backup,restore-test}.yml` (v1.0 simple daily full dump, `age`, weekly restore test), `app/api/cron/maintenance/route.ts`, `vercel.json` cron, `app/api/health/route.ts` | cron idempotent + `CRON_SECRET`; health ok/fail only | `pnpm verify` + manual workflow run |
| 5.8 Launch **[owner]** | Supabase prod + staging projects, Google/GitHub OAuth apps, Vercel project + env vars, first deploy; dogfooding checklist | full e2e against staging | `pnpm verify:full` + checklist |

**Before any learner reaches week 4 (§0 constraint):** `content-verify` M3b (linked lists, trees,
graph nodes, random-pointer lists) and M3c (design classes) — tasks written just-in-time — and
either W4–W5 notes/lessons written or v1.1 shipped.

### M6 — Admin AI controls + bot API (v1.1)

| Task | Deliverable |
| --- | --- |
| 6.1 | Upstash rate limits (`lib/rate-limit.ts`, fail-open counter in `ops_metrics`) |
| 6.2 | Migrations: `bot_settings`, `bot_runs`, `bot_run_users`, `user_items`, `roadmap_overrides`, `content_publish_requests` + RLS + pgTAP |
| 6.3 | Bot token (hash in DB, rotation UI in `/admin/bot`), `requireBotToken`, kill switch, dry-run |
| 6.4 | `POST /runs` (plan + publish kinds, cap + `deferredUsers`, lazy timeout, resume mode rule), context endpoint (pseudonyms, sanitisation), `PATCH /runs/{runId}` |
| 6.5 | `PUT …/plan` (validation + untouched-plan precedence), AI plan rendering, mode badge, AI flag toggle in `/admin/users` |
| 6.6 | `PUT …/custom-items` + "Mục riêng" tab; `PUT …/overrides` + `effectiveRoadmap` + revoke UI |
| 6.7 | `GET …/content-signals`, publish requests (admin "Xuất bản", public endpoint), `share_notes_with_ai` |
| 6.8 | Contract test suite (§6.10) |

### M7 — Claude Code Routine in dry-run (v1.1)

| Task | Deliverable |
| --- | --- |
| 7.1 | `pnpm bot` CLI (`tools/bot/cli.ts`) sharing `lib/bot/contract.ts` |
| 7.2 | `bot/ROUTINE_PROMPT.md`, `.claude/settings.json` deny rules |
| 7.3 | Bot PR workflows: `path-guard`, `bot-content-policy`, `bot-automerge`, stale-PR closer + fixture PR tests; required checks on `main` |
| 7.4 **[owner]** | Routine environment (Custom network, API credential, no connectors, schedule 22:30 UTC); fallback workflow (dry-run) |
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
npm pkg set scripts.verify:full="pnpm verify && pnpm test:e2e"
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
  scanning with push protection and Dependabot alerts enabled.

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

- [ ] **Step 5: Request review and stop**

Run superpowers:requesting-code-review for the branch, address findings, then **stop and hand the
PR to the owner**. Do not merge; do not start M1.
