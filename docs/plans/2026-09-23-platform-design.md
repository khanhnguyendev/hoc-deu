# Học Đều — Platform Design

| | |
|---|---|
| Date | 2026-09-23 |
| Gate | 1 of 3 (design doc → design system → implementation plan) |
| Status | Sections 1–4 **approved** · Section 5 **in review** · Sections 6–9 **not yet written** |
| Owner | khanhnguyendev |
| Repo (planned) | `github.com/khanhnguyendev/hoc-deu` (public) |

---

## 0. Summary

**Học Đều** is an AI-driven learning platform ("Nền tảng học tập dẫn dắt bởi AI") for Vietnamese
IT learners. A learner opens the app, sees today's plan, studies, and checks in. The roadmap only
moves forward on days the learner actually studies. The first two tracks are **DSA** (NeetCode 150
by pattern, 10 weeks) and **English for IT workplaces** (10 weeks, runs in parallel).

- **Tracks are data, not code.** A track is a manifest plus content files, validated at build time.
- **Zero AI cost by default.** Every user gets a deterministic baseline plan. Per-user AI
  personalization is an admin-only flag, default OFF. The bot writes plans only through one
  validated, idempotent endpoint.
- **All learning results are self-reported**, so the trust boundary is isolating each user's data,
  not proving a user's own records are honest. Role, status and the AI flag are the fields users
  must never write.

**Success criteria**

1. Every milestone ends with a green `pnpm verify` (typecheck, lint, test, build).
2. A new track ships as a content-only PR (no app code changes) and passes build-time validation.
3. WCAG 2.1 AA; keyboard navigable; respects `prefers-reduced-motion`.
4. Fits the free tiers (Vercel Hobby, Supabase Free, Upstash Free, GitHub Actions) at 100 users.
5. Derived state can be rebuilt from the event log at any time.

**Non-goals (v1):** payments or any commercial use (Vercel Hobby is non-commercial only), native
mobile apps, offline mode beyond safe retries, email notifications, multiple UI languages, streak
freezes.

### 0.1 Decisions log

| # | Decision | Detail |
|---|---|---|
| Q1 | Open sign-up + admin approval | Account status `pending → active` (or `rejected` / `suspended`). First admin(s) bootstrapped from a server-side env list of emails. Non-commercial. |
| Q2 | Google + GitHub OAuth only | No email provider needed (Supabase built-in SMTP is limited to 2 emails/hour, team addresses only). A test-only email/password login exists in local and CI. Approval is surfaced in-app only. |
| Q3 | DSA solutions in Python, Java and Go | Code tabs; each user picks a default language (onboarding, settings). |
| Q4 | One lesson per **pattern** (~14 + optional Tries) | Anchor problem ≠ practice problem, both in the lesson's pattern. Every problem has a compact note. Notes are upgradeable to an optional deep-dive lesson without schema or route changes. |
| Q5 | English decks ~30 cards/week | `tier: core \| extended`, core first. Review-load throttle. Extended cards for W1–W3 now; W4–W10 later via content PRs. DSA: metadata for all ~110 problems; notes and lessons for W1–W3 now. |
| Q6 | Solutions run in CI | Harness phased M3a/b/c; `verification: tested \| compile-only`; comparators; validators live outside `content/**`; sandboxed job. |
| Q7 | Public GitHub repo | Encrypted backups; secret scanning, Dependabot, CodeQL; never copy LeetCode problem statements. No LICENSE file yet (all rights reserved) — **open item for you to decide**. |
| Approach | TypeScript domain core + atomic DB writes | See §4 and §5. Rules live once, in pure TypeScript; Postgres functions apply events atomically. |

---

## 1. Naming — APPROVED

**Final:** slug `hoc-deu`, display name **Học Đều**.

- **Category line:** EN "AI-Driven Learning Platform" · VI "Nền tảng học tập dẫn dắt bởi AI"
- **Tagline:** EN "Study a little every day. AI keeps your learning moving." ·
  VI "Mỗi ngày một chút — AI giúp bạn tiến đều."
- **Accuracy constraint:** "AI-driven" is true platform-wide (AI-authored content that CI tests and
  a human reviews, the content bot, weak-area analysis). Per-user personalization stays admin-only
  and default OFF; the UI says "AI-personalized" only where true, via the mode badge
  (Sample / AI-personalized).
- Slug is used for: repo name, package name, Vercel subdomain `hoc-deu.vercel.app` (availability
  checked in M0), trademark/domain check in M0.

### 1.1 Candidates

Scores are 1–5 for Clarity, Memorability, Slug-friendliness, Uniqueness. Uniqueness comes from
quick web searches only (2026-09-23), not a trademark or domain check.

| # | Name | Slug | Kind | Meaning | C | M | S | U | Total | Note |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | **Học Đều** | hoc-deu | descriptive | study steadily | 5 | 4 | 4 | 4 | **17** | no app conflict found |
| 2 | Tấn Tới | tantoi | descriptive | "học hành tấn tới" — making progress | 4 | 4 | 4 | 4 | 16 | no conflict found |
| 3 | Nhịp | nhip | metaphor | rhythm, beat | 3 | 4 | 4 | 4 | 15 | hard for non-Vietnamese speakers |
| 4 | Evenstep | evenstep | brandable | even, steady steps | 4 | 4 | 5 | 2 | 15 | EvenSteps (tutoring SaaS); EVSTEP (Vietnamese English-exam app) |
| 5 | Trackday | trackday | descriptive pun | tracks + day | 3 | 4 | 5 | 2 | 14 | motorsport term |
| 6 | StudyDays | studydays | descriptive | roadmap moves by study days | 4 | 2 | 5 | 2 | 13 | generic |
| 7 | Evenpace | evenpace | brandable | steady pace | 3 | 3 | 5 | 2 | 13 | existing habit/self-care site |
| 8 | Stepwell | stepwell | metaphor | steps down to water | 2 | 4 | 5 | 1 | 12 | several education products |
| 9 | Paceline | paceline | metaphor | cycling formation at steady pace | 2 | 3 | 5 | 2 | 12 | fitness/fintech app |
| 10 | Tend | tend | metaphor | tending a garden (spaced repetition) | 2 | 4 | 5 | 1 | 12 | common word |
| 11 | Lộ Trình | lotrinh | descriptive | roadmap | 4 | 2 | 4 | 1 | 11 | common noun |
| 12 | Hành Trang | hanhtrang | metaphor | the knowledge you carry | 3 | 3 | 3 | 2 | 11 | long slug |
| 13 | Cairn | cairn | metaphor | stone pile growing each study day | 2 | 3 | 5 | 1 | 11 | several habit trackers |
| 14 | Nexday | nexday | brandable | the next study day | 3 | 3 | 4 | 1 | 11 | several planners |

Dropped: "Gieo" (to sow) — associated with I Ching divination apps in Vietnam.

### 1.2 Top 3 (as presented)

| Rank | Slug | Display | Tagline EN | Tagline VI |
|---|---|---|---|---|
| 1 | `hoc-deu` | Học Đều | Study a little, every day, and it adds up. | Mỗi ngày một chút, đều đặn thành thói quen. |
| 2 | `tantoi` | Tấn Tới | Steady progress, one study day at a time. | Học hành tấn tới, từng ngày một. |
| 3 | `nhip` | Nhịp | Find your rhythm. Keep it. | Giữ nhịp học mỗi ngày. |

---

## 2. Architecture and route map — APPROVED

### 2.1 Overview

```
Browser ──► proxy.ts  (Supabase session refresh; signed-out → /sign-in. No DB queries.)
   │
   ├──► Route-group layouts + DAL (lib/auth/dal.ts: requireUser / requireActive / requireAdmin)
   │       ├──► Server Components  (read with the user's JWT; RLS applies) ──► Supabase Postgres
   │       └──► Server actions: DAL → Zod → lib/domain (pure TS) → rpc apply_event ──┘
   │                               └─ Upstash rate limit (writes only, fails open)
   │
content/** ──► pnpm content:build (Zod + cross-reference + MDX safety) ──► generated catalog (bundled)

Claude Code Routine ──► HTTPS /api/bot/v1/* (bearer) ──► server-only secret key ──► rpc apply_system_event

GitHub Actions: CI · content-verify (sandboxed) · daily encrypted pg_dump · weekly restore test
```

- **Stack:** Next.js 16 App Router on Vercel Hobby (Node runtime, Fluid compute), TypeScript strict,
  pnpm, Tailwind CSS v4, shadcn/ui, MDX via `@next/mdx`, Zod, Supabase (Postgres + Auth + RLS) via
  `@supabase/ssr`, Upstash Redis (rate limits only), Vitest, Playwright + axe, GitHub Actions.
- **Version pins (from research, 2026-09-23):** TypeScript 6.0.x (typescript-eslint does not
  support TS 7), ESLint 9.39.x (Next's ESLint plugins declare ≤ 9), Node 22.12+ (Vitest 5 and
  supabase-js require it). `next-mdx-remote` is archived — not used.
- **Supabase keys:** new publishable (`sb_publishable_…`, browser-safe, RLS applies) and secret
  (`sb_secret_…`, server-only, bypasses RLS) keys. The legacy anon/service_role keys are deprecated
  by the end of 2026 and are not used. Server code protects pages with `getClaims()`, never
  `getSession()`.

### 2.2 Auth layering

1. **`proxy.ts`** only refreshes the Supabase session (`updateSession`) and redirects signed-out
   users to `/sign-in`. It never queries the database.
2. **Route-group layouts** check access for pages:

   | Group | Guard | Contains |
   |---|---|---|
   | `(public)` | none | `/`, `/sign-in`, `/auth/callback` |
   | `(account)` | `requireUser` | `/pending` |
   | `(onboarding)` | `requireActive` (not yet onboarded) | `/onboarding` |
   | `(app)` | `requireActive` + onboarded | `/today`, `/review`, `/tracks`, `/t/…`, `/progress`, `/settings` |
   | `(admin)` | `requireAdmin` | `/admin/…` |

3. **DAL (`lib/auth/dal.ts`)** exposes `requireUser()`, `requireActive()`, `requireAdmin()`. They are
   wrapped in React `cache()` so the profile is read once per request. **Every page, server action
   and route handler calls one of them** — layouts alone do not protect server actions.
   An architecture test (Vitest) scans `app/**` server-action files and route handlers and fails if
   one does not call a `require*` function (bot routes use the bot-token guard instead).
4. **RLS remains the data backstop** (§4.5).

### 2.3 Other rules

- **Rendering:** Server Components by default. `'use client'` only on interactive leaf components
  (state, effects, event handlers, browser APIs) — e.g. code tabs, reveal toggles, quizzes, the
  check-in sheet, flashcard viewer, onboarding steps, admin toggles, theme toggle. Never on pages or
  layouts. Data is fetched in server components and passed down as props.
- **Env vars** are validated with Zod at startup (`lib/env.ts`, separate server and client
  schemas). Only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are public.
  The secret-key client lives in `lib/supabase/admin.ts` behind `import 'server-only'`.
- **Test login:** `AUTH_TEST_LOGIN=true` enables email/password sign-in against seeded synthetic
  users (local Supabase's Mailpit catches any mail). `lib/env.ts` throws at startup when
  `AUTH_TEST_LOGIN=true` and `VERCEL_ENV=production`. (`NODE_ENV` is not used for this check
  because CI's E2E tests run a production build.) Second lock: the production Supabase project has
  the email provider disabled.
- **Today's plan** is created on first visit by an idempotent `ensurePlan` (§5.4). No cron job for
  baseline plans.
- **Cache Components** stay off in v1 (every screen is per-user and dynamic). Recorded as an ADR.
- **URLs are English; all UI text is Vietnamese** (technical terms stay English). Strings live in
  `lib/i18n/vi.ts` — no i18n library.
- **Backups:**
  - Daily GitHub Actions job at 22:00 UTC (05:00 Asia/Ho_Chi_Minh) runs `pg_dump` as a dedicated
    read-only role `backup_reader`.
  - The dump is encrypted with `age` for two recipients: the owner's offline key and a separate
    restore-test key.
  - Stored as the Actions artifact `db-backup-<date>`, retention **30 days**; Sunday dumps are also
    kept as `db-backup-weekly-<date>` with retention **90 days**.
  - The DB URL and restore key live in the GitHub environment `backup`, restricted to the `main`
    branch, so PR branches (including `claude/*`) cannot read them.
  - **Weekly restore test** (Sunday): download the latest artifact → decrypt → restore into a
    Postgres service container → check tables exist, row counts > 0, and a sample replay matches
    stored derived rows → fail the job if anything is off. The job never prints data.
  - `/admin` shows the latest backup and restore-test status, read from the public GitHub API.
  - Anyone signed in to GitHub can download artifacts of a public repo — that is why dumps are
    encrypted before upload.
- **`/api/health`** returns only `200 {"ok":true}` or `503 {"ok":false}` (cheap DB query). No
  versions or dependency details.

### 2.4 Route map

| Route | Access | Purpose |
|---|---|---|
| `/` | public | Positioning page + sign-in button; signed-in users are redirected to `/today` |
| `/sign-in`, `/auth/callback` | public | Google/GitHub OAuth; test-only email login when `AUTH_TEST_LOGIN=true` |
| `/pending` | signed in | Pending / rejected / suspended status screen; moves on automatically when approved |
| `/onboarding` | active | Tracks → DSA 10w/8w → minutes per track → start date, timezone, day start → code language → weekly template preview |
| `/today` | active | Dashboard: plan blocks, one-tap check-in, streak, per-track progress, due reviews, weak areas, mode badge, paused banner |
| `/today?block=<id>` | active | Opens the check-in sheet for a block (deep-linkable, back button works) |
| `/review` (`?track=`) | active | Cross-track review queue, Weak items first |
| `/tracks` | active | My tracks and available tracks |
| `/t/[trackId]` | active | Track overview: roadmap weeks, progress, topics/decks, weak items |
| `/t/[trackId]/items/[itemId]` | active | **One route for every item type**, rendered via the item-type registry (§3.2) |
| `/progress` | active | Calendar heatmap + weekly summary |
| `/settings` | active | Tracks, minutes, weekly template, timezone, day start, code language, throttle, notes sharing, theme, delete account |
| `/admin` | admin | Overview and warnings (content coverage, backup/restore status, DB size, bot health) |
| `/admin/users` | admin | Approval queue, role, suspend, AI flag |
| `/admin/bot` | admin | Kill switch, dry-run, per-run cap, run log |
| `/admin/content` | admin | Catalog stats, verification counts, coverage by week, draft tracks |
| `/dev/components` | dev + preview; admin-only in prod | Component catalog |
| `/api/bot/v1/*` | bot token | Bot contract (§6) |
| `/api/health` | public | ok / fail |

---

## 3. Track plugin design — APPROVED

### 3.1 The rule

- **A track is data** (manifest + content). A new track that uses existing item types needs
  **no code changes**.
- **An item type is code** — a plugin in the registry. A new item type means one new folder
  `features/items/<type>/` plus one registry entry; no existing screen changes.

### 3.2 Item-type registry

Core item types: `problem`, `flashcard`, `lesson`, `exercise`, `prompt`.

```ts
type ItemTypeDef<T> = {
  type: ItemType
  schema: ZodType<T>                                         // validates content at build time
  outcomes: Record<string, 'success' | 'partial' | 'fail'>  // problem: solved|hint|failed
                                                            // flashcard: know|unsure|dont_know
  srs: boolean                                              // problem, flashcard: true; others: false
  estimateMinutes(item: T, mode: 'new' | 'review'): number
  Page: ComponentType<ItemPageProps<T>>                     // /t/[track]/items/[id]
  Row:  ComponentType<ItemRowProps<T>>                      // plan blocks, review queue, lists
}
```

### 3.3 Content layout and IDs

```
content/
  ids.lock                               # every published ID (incl. derived); removal fails the build
                                         # unless the ID is moved to `retired`
  tracks/<trackId>/
    track.yaml                           # manifest
    roadmaps/<variant>.yaml              # weeks → ordered item refs by role
    lessons/<slug>.mdx                   # frontmatter: kind, format, topic, anchor, practice, about?
    problems/<lc-0001-two-sum>/          # problem.yaml · note.mdx · solution.py · Solution.java
                                         # · solution.go · tests.yaml
    decks/<w01-standup>.yaml             # cards, each with a stable id and tier: core|extended
    exercises/*.yaml
    prompts/*.yaml
```

- **IDs are `<track>:<localId>`**, e.g. `dsa:lc-0001`, `dsa:lesson-arrays-hashing`,
  `english:w01-blocker`.
- **Derived card IDs are deterministic:** `english:explaining-code:dsa:lc-0001`.
- `ids.lock` covers derived IDs. IDs are append-only; events reference them forever.

### 3.4 Manifest

DSA manifest (abridged):

```yaml
id: dsa
status: active                       # draft | active | retired
title: { vi: "Cấu trúc dữ liệu & Giải thuật", en: "Data Structures & Algorithms" }
accent: track-1                      # must be one of the design tokens track-1..track-8
itemTypes: [lesson, problem, prompt]
codeLanguages: [python, java, go]
srs: { intervals: [1, 3, 7, 14, 30] }
topics:
  - { id: arrays-hashing, title: { vi: …, en: "Arrays & Hashing" }, signals: [...] }
  # … two-pointers, sliding-window, stack, binary-search, linked-list, trees, heap,
  #   tries (optional), backtracking, graphs, dp-1d, dp-2d, intervals, greedy
lessonFormats:
  pattern:
    sections: [signals, analogy, visual, approach, code, complexity, bilingual, practice, quiz]
    requires: [anchor, practice]
    rules: [anchor!=practice, same-topic, one-per-topic]
  deep-dive:
    sections: [analogy, visual, approach, code, complexity, bilingual, practice, quiz]
    requires: [about, practice]
    rules: [practice!=about, same-topic, max-1-per-about]
defaults: { budgetMinutes: 60, newPerDay: null, throttle: [] }
estimates:
  lesson: 25
  problem: { new: { E: 20, M: 35, H: 50 }, reviewFactor: 0.6 }
  prompt: 10
roadmaps: [{ id: 10w, default: true }, { id: 8w }]
weeklyTemplate:
  mon-fri: [{ kind: new }]
  sat:     [{ kind: review }]
  sun:     [{ kind: recap, count: 3 },
            { kind: practice, tag: mock-interview, minutes: 45, fromWeek: 3 }]
```

- **`status`:** `draft` = merged but visible only to admins; `active` = available;
  `retired` = no new enrollments, existing enrollments are paused with a notice.
- **`fromWeek`** refers to the **user's roadmap week** for that track (§5.3), not calendar weeks.
- **Weekly template:** the user's template in `user_tracks.weekly_template` overrides the track
  default.
- **Lesson formats are declared per track**, so each track has its own lesson structure.

English track manifest — derived deck (abridged):

```yaml
id: english
accent: track-2
itemTypes: [flashcard, exercise, prompt]
srs: { intervals: [1, 3, 7, 14] }
defaults:
  budgetMinutes: 25
  newPerDay: 8
  throttle: [{ dueAbove: 40, newPerDay: 4 }, { dueAbove: 60, newPerDay: 0 }]
estimates: { flashcard: { new: 1.5, review: 0.5 }, exercise: 5, prompt: 10 }
decks:
  - id: explaining-code
    kind: derived
    from: { track: dsa, itemType: problem }
    unlock: attempted                     # card unlocks when the source problem has any result
    map:
      front: { template: "Explain the optimal approach for {problem.title} in English." }
      back: note.bilingual.en
      hint: note.bilingual.vi
weeklyTemplate:
  mon-fri: [{ kind: new }, { kind: review },
            { kind: practice, itemType: exercise }, { kind: practice, tag: shadowing }]
  sat:     [{ kind: review }]
  sun:     [{ kind: practice, tag: weekend-task }]
```

The dependency points one way: English pulls from DSA; DSA knows nothing about English.

### 3.5 Item files

`problems/lc-0271-encode-and-decode-strings/problem.yaml` (example):

```yaml
id: dsa:lc-0271
leetcode: 271
title: Encode and Decode Strings
difficulty: M
topic: arrays-hashing
premium: true
alternatives:                           # required when premium: true (at least one free link)
  - { label: "LintCode 659 (free)", url: "https://www.lintcode.com/problem/659/" }
signature: { kind: design-codec }       # used by the verification harness
```

- We **never copy LeetCode problem statements**: link + our own notes only.
- **Cards** (`decks/*.yaml`): term/phrase · Vietnamese meaning · usage note (part of speech,
  formal/informal) · one work-context example · pronunciation hint · tags (week, topic) · `tier`.
- **Problem note** (`note.mdx`): key idea · complexity · `<Solution />` (3-language tabs, hidden until
  revealed; code comes from the solution files) · `<Bilingual vi en />` one-liner (becomes the
  derived "Explaining code" card) · verification badge (`tested` / `compile-only`).
- **Deep-dive:** a lesson with `kind: deep-dive, about: dsa:lc-XXXX`. The catalog builds a reverse
  lookup problem → deep-dive; the problem page shows the link. Adding one = adding one file.

### 3.6 `pnpm content:build`

Runs first in `pnpm verify` and in the build.

1. Parse manifests and items with Zod (YAML parsed with a safe parser).
2. Cross-reference checks:
   - roadmap references exist; each ID appears once per roadmap
   - lesson section order matches its format (checked on the MDX syntax tree)
   - anchor / practice / about rules; one pattern lesson per topic; ≤ 1 deep-dive per problem
   - a solution file exists for every language in `codeLanguages`
   - accent token exists in the token set
   - `ids.lock` is stable (no silent removals)
   - derived-deck sources and field mappings exist
   - premium problems have a free alternative
3. **MDX safety check** (the bot can open content PRs):
   - no `import` / `export`; no `{expressions}`
   - only allow-listed components; literal attribute values only
   - links must be `https:`; images local or from an allow-listed host; `javascript:` and `data:`
     URLs rejected
   - the allow-list lives in code (`tools/content/allowlist.ts`), outside `content/**`
   - frontmatter is YAML (remark-frontmatter), not `export const metadata`
4. Emit `.generated/catalog.json` and a static map of MDX imports (git-ignored build output).
5. Print a report: counts by type, verification status, coverage by week, draft tracks.

### 3.7 Solution verification (`content-verify`)

- Every problem folder has `tests.yaml`: LeetCode examples plus edge cases (empty input, single
  element, duplicates, negatives, max constraints where cheap). The build checks a minimum case
  count.
- **Runners** (Python, Java, Go) only execute the solution and print JSON output. **One Node
  orchestrator** compares results and enforces a per-test timeout.
- **Comparators** declared per problem: `exact` (default), `unordered`, `unordered-nested`,
  `float{tolerance}`, `in-place{arg}`, `validator{name}`.
- **Validators** (e.g. `topological-order`) live in `tools/content-verify/validators/`, outside
  `content/**`. A new validator is a normal code PR; the bot cannot add executable check code.
- **Phases** (inside M3):
  - M3a: numbers, strings, arrays, nested arrays
  - M3b: linked lists, trees, graph nodes, random-pointer lists
  - M3c: design-class problems as operation sequences
- Until a problem's signature is supported it falls back to **compile-only** (Python syntax check,
  `javac`, `go vet`) plus a signature check. The harness decides `verification: tested |
  compile-only`; CI prints the counts (e.g. `tested 27 · compile-only 3`).
- **Sandbox:** the job has no secrets, a read-only `GITHUB_TOKEN`, and runs solutions in a
  container with no network. It runs only when `content/**` or `tools/content-verify/**` changes.
- **Could-have (deferred):** one large input per problem with a time limit, to catch an
  accidental O(n²) where the note claims O(n).

### 3.8 Worked example: adding a "System Design" track

1. Create `content/tracks/system-design/track.yaml`:
   - `status: draft` (visible only to admins while content is reviewed)
   - `accent: track-3`
   - `itemTypes: [lesson, flashcard, prompt, exercise]`
   - topics: fundamentals, caching, databases, queues, …
   - `lessonFormats.concept: { sections: [overview, analogy, diagram, tradeoffs, bilingual, quiz] }`
   - `srs.intervals: [1, 3, 7, 14, 30]`; defaults: 30 minutes a day
   - weekly template: Mon/Wed/Fri lesson + cards · Sat review · Sun a 45-minute design prompt
2. Add `roadmaps/8w.yaml`, lessons (`lessons/caching.mdx`, `format: concept`), vocabulary decks
   ("consistent hashing", "write-through"), and prompts ("Design a URL shortener", with a rubric).
3. Run `pnpm content:build` → all checks pass. Open a PR → CI green → merge → deploy. Admin
   previews the draft track.
4. Flip `status: active` in a one-line PR. The track appears automatically in `/tracks`, onboarding
   and settings (the track list comes from the catalog). Users opt in from settings.

**What would need code:** a genuinely new interaction (e.g. a drawing canvas for architecture
diagrams) — a new item type, i.e. one plugin folder. Still no changes to existing screens.

---

## 4. Data model — APPROVED

### 4.1 Per-user tables

All in the `public` schema with RLS on.

**`profiles`** (state)
- `id` → `auth.users` (on delete cascade)
- `role`: learner / admin
- `status`: pending / active / rejected / suspended
- `ai_personalization` bool, default false (admin-only)
- `share_notes_with_ai` bool, default false (user-controlled; see §4.6)
- `code_language`, `display_name`, `avatar_url`, `onboarded_at`, `approved_by`, `approved_at`

**`schedule_versions`** (state, versioned)
- PK `(user_id, effective_at)`; `timezone` (default `Asia/Ho_Chi_Minh`); `day_starts_at`
  (default `04:00`)
- The engine uses the latest version with `effective_at ≤ now`. A change takes effect at the next
  day start, so past days are never rewritten (§5.8).

**`user_tracks`** (state)
- PK `(user_id, track_id)`
- `roadmap_variant`; `status` active / paused / removed; `start_date`
- `budget_minutes`; `new_per_day`, `throttle`, `weekly_template` (null = track default)
- `include_bonus` bool (default false, §5.3)

**`events`** (append-only log)
- `id` uuid — generated on the device, PK (idempotent retries, safe offline queue)
- `user_id`, `actor_id`
- `source`: learner / system / bot / admin
- `type`, `occurred_at` (DB `now()`), `local_day` (computed in the DB, §4.5)
- `track_id`, `item_id`, `plan_id`, `block_id`
- `payload` jsonb (Zod-checked per type, ≤ 2 KB)
- `rules_version`

**`day_plans`** (plan)
- `id`; unique `(user_id, plan_date)`
- `source`: baseline / ai; `version`
- `blocks` jsonb: `block_id`, `track`, `kind`, `item_ids`, `est_minutes`, `mode`
- `roadmap_weeks` jsonb (per-track week snapshot); `rationale` (AI only); `bot_run_id`;
  `rules_version`

**`item_state`** (derived)
- PK `(user_id, item_id)`
- `track_id`, `topic_id`, `item_type` (copied in so queries need no catalog)
- `level`; `weak` bool; `status` weak / ok / strong / skipped (no row = not started)
- `due_on`, `last_result`, `last_result_on`, `introduced_on`, `lapses`, `reps`
- `version`, `rules_version`

**`plan_block_state`** (derived)
- PK `(plan_id, block_id)`
- `status` done / partial / skipped; `minutes`; `note`; `auto` bool; `checked_in_at`

**`daily_activity`** (derived)
- PK `(user_id, local_day)`
- `minutes_by_track` jsonb, `items_done`, `completed` bool
- **`completed` = at least one block checked in as `done` or `partial` on that local day.**
  Used by the gate rule (§5.2) and the streak (§5.7). Item results alone do not set it
  (but see off-plan study, §5.8).

### 4.2 Admin and bot tables

- **`bot_settings`** (single row): `enabled` (kill switch), `dry_run`, `per_run_user_cap`.
  A hard env switch `BOT_API_ENABLED` also exists; both must be on.
- **`bot_runs`**: mode, status, users considered / processed, error, timestamps.
- **`bot_run_users`**: one row per user per run; outcome `applied | skipped_plan_in_use |
  skipped_gate_closed | invalid | error | dry_run`; detail. **`user_id` references `profiles` with
  on delete cascade.**

### 4.3 Views, functions, indexes

- **Every view has `security_invoker = true`** (Supabase views bypass RLS otherwise).
- `v_weak_topics`: topics with ≥ 2 Weak items.
- `due_items(p_local_day)`: SQL function (today depends on the user's timezone).
- Streak and roadmap week are computed in TypeScript on read (from `daily_activity`, `item_state`
  and the catalog). No extra tables.
- **Indexes:**
  - `events (user_id, occurred_at)`
  - `item_state (user_id, due_on)`
  - `daily_activity (user_id, local_day)` (the PK)
  - implied unique indexes: `events (id)`, `day_plans (user_id, plan_date)`,
    `plan_block_state (plan_id, block_id)`, `item_state (user_id, item_id)`
  - All are included in the §8 size estimate.

### 4.4 Event types

**Learner events** — through `apply_event`:
- `block.checked_in` {status, minutes, note?, auto?}
- `item.result` {result: solved | hint | failed | know | unsure | dont_know}
- `lesson.completed` {quizScore?}, `exercise.submitted`, `prompt.completed`, `item.skipped`
- `track.enrolled` / `updated` / `paused` / `resumed` / `removed` / `reset`
- `schedule.changed`, `onboarding.completed`, `settings.changed`

**System, bot and admin events** — through `apply_system_event` (only the server-side secret key
can call it):
- `plan.generated` — `ensurePlan` calls this after `requireActive`; `user_id` always comes from the
  DAL, never from input
- `plan.extra_added` (off-plan study, "Học thêm", §5.8)
- `plan.ai_proposed`, `plan.ai_applied`, `plan.ai_skipped`
- `block.checked_in` with `auto: true` (auto check-in, §5.5)
- `admin.user_approved` / `rejected` / `suspended` / `role_changed` / `ai_flag_changed`
- Admin events are stored with `actor_id` → free audit trail.

**Atomicity and locking**
- `apply_event(event, new_state, expected_version)` inserts the event and upserts derived rows in
  one transaction; a version mismatch aborts. The server action then reloads, recomputes and
  retries (max 3).
- Both `apply_event` and `apply_system_event` take `pg_advisory_xact_lock(user, plan_date)` for
  plan-related events, instead of `SELECT … FOR UPDATE` (which would need an UPDATE grant on
  `day_plans` for `authenticated`).

### 4.5 RLS and write rules

- **All tables:** RLS on, deny by default. Writes require `is_active()`. `is_admin()` and
  `is_active()` are `SECURITY DEFINER` helpers so policies do not recurse into `profiles`.
- **`apply_event`** is `SECURITY INVOKER` (RLS applies), rejects `user_id ≠ auth.uid()`, and
  accepts only learner event types.
- **`events` insert trigger** (for `authenticated`): forces `actor_id = auth.uid()` and
  `source = 'learner'`, and **computes `local_day` in the database** from `schedule_versions`
  (`(occurred_at at time zone tz − day_starts_at)::date`) — never taken from input. A parity test
  runs the same fixtures through the SQL function and TypeScript `localDay()`.
- **`profiles`:** read own row. Created with status `pending` by a trigger on `auth.users`; users
  cannot insert. Users can update only `display_name`, `avatar_url`, `code_language`,
  `share_notes_with_ai` (column-level grants; `share_notes_with_ai` is only settable while
  `ai_personalization` is on). Role, status and the AI flag change only via `admin_*` functions,
  which check `is_admin()` and write an audit event.
- **`events` and derived tables:** read own rows. Writes need `user_id = auth.uid()`. `events` can
  never be updated (trigger). Rows are deleted only by the account-deletion cascade.
  Because `apply_event` runs as the user, a user could write their own rows directly; that only
  affects their own self-reported data, and the drift check (§4.7) catches it.
- **`day_plans`:** read own; only the server writes.
- **Admins** have no direct read access to `events` or check-in notes. Admin pages call aggregate
  `SECURITY DEFINER` functions (counts, coverage, streaks), so learner notes stay private.

### 4.6 Privacy

- **Check-in notes are excluded from the bot context by default.** `share_notes_with_ai` (default
  off) is shown in settings only when `ai_personalization` is on, with the explanation:
  "Bot AI và người vận hành bot có thể xem ghi chú bạn chia sẻ." Only when it is on does the bot
  context include the sanitized, truncated note (§6).
- **Account deletion:** a server action deletes the `auth.users` row, which cascades to every table
  (including `bot_run_users`). Privacy wins over append-only here. The privacy text states:
  **"Dữ liệu đã xoá vẫn có thể tồn tại trong bản sao lưu đã mã hoá tối đa 90 ngày."**
- **Could-have:** "Tải dữ liệu của tôi" — JSON export of the user's events and derived state in
  settings.

### 4.7 Rules version and drift check

- `RULES_VERSION` is a constant in `lib/domain`; bumped whenever SRS or plan behavior changes.
  Stored on events and derived rows, so replay is an explicit choice: historical rules vs current
  rules.
- **Could-have:** a drift check in the admin run log — replay a sample of users and compare with
  stored derived rows.

### 4.8 What lives where

| Repo | Database | Neither (secret stores) |
|---|---|---|
| `content/**`, `ids.lock`, migrations, pgTAP tests, `seed.sql` with **synthetic users only**, design tokens, bot prompt and routine docs. The generated catalog is build output (git-ignored). | Every per-user row above, bot run log, bot settings. | Vercel env vars, the GitHub `backup` environment, the Routine's API credentials. |

### 4.9 Storage warning (input to §8)

- ~300 B per event including indexes; ~35 events per active user per day (per-card grading).
- 100 daily users → ~1 MB/day → **~365 MB/year vs the 500 MB free limit.**
- Mitigation plan in §8: lean columns, DB-size warning in admin, compacting old card-result events
  into snapshots (versioned by `rules_version`).

---

## 5. Plan engine, spaced repetition and edge cases — IN REVIEW

All functions in this section are **pure TypeScript** in `lib/domain/**`. They receive `now`,
the user's `localDay`, state and the catalog as parameters — never the client clock, never I/O.
Same inputs → same output (tie-breaks use a hash of `userId + localDay`, not randomness).

### 5.1 Local day

- `localDay(now, schedule) = date part of (now in schedule.timezone − schedule.day_starts_at)`.
- Default day start 04:00: studying at 01:30 counts for the previous day.
- One function used by: gate rule, streak, `ensurePlan`, heatmap, weekly summary. The DB's
  `local_day` for events uses the same formula (parity-tested, §4.5).

### 5.2 Gate rule

- **Last planned day** = the user's most recent `day_plans` row with `plan_date < today`.
- **Gate is open** when there is no previous plan, or when at least one block of the last plan has
  been checked in as `done` or `partial` — at any time, including a later day.
- **Gate is closed** otherwise (nothing done, or everything skipped). Then:
  - no new plan is created and the roadmap does not advance;
  - `/today` shows the last plan's unfinished blocks with the banner
    "Lộ trình đang tạm dừng — hoàn thành ít nhất một phần để tiếp tục" and the original date;
  - check-ins go to that old plan. The first `done`/`partial` check-in reopens the gate. The next
    plan is created on the **next local day** (one plan per day; resuming counts as today's work);
  - the bot cannot write a plan for this user (outcome `skipped_gate_closed`, §6).
- Unfinished work never needs an explicit "carry-over" copy: new items stay not-introduced and
  reviews stay due, so the next plan picks them up naturally.

### 5.3 Roadmap position

- **Introduced set:** an item is introduced on its first recorded outcome (`item.result`,
  `lesson.completed`, `exercise.submitted`, `prompt.completed`, or `item.skipped`). Planned but
  untouched items are not introduced.
- **New-item queue** for a track = all not-introduced items in roadmap order, active variant,
  excluding retired items. Order within a roadmap week:
  1. lesson(s) of the week's topic(s)
  2. `core` items (problems / cards)
  3. derived cards that are unlocked (English: "Explaining code", in unlock order)
  4. `extended` cards
  5. `bonus` problems — only when `user_tracks.include_bonus` is true (default false; otherwise
     bonus problems are listed on the track page and reachable via "Học thêm" or a recap)
- **Current roadmap week** = the week of the first not-introduced **core** item. Content added
  later to earlier weeks (e.g. extended cards for W4 after the user reached W6) is still scheduled
  from the queue, but **does not move the week back**.
- Switching roadmap variant (10w ↔ 8w) keeps the introduced set (it is item-based); the queue
  simply follows the new order.
- Roadmap advances by **study days**: only plans advance it, and plans are only created when the
  gate is open.

### 5.4 Building a plan

`ensurePlan(user, localDay)`:

1. If a plan exists for `localDay` → return it (idempotent).
2. If `localDay < start_date` for every track → return "Bắt đầu vào <date>".
3. If the gate is closed → return the paused state (§5.2).
4. Otherwise `buildPlan(ctx)` → `apply_system_event('plan.generated')` with
   `insert … on conflict (user_id, plan_date) do nothing` → re-read and return.
5. AI users: if the bot already wrote today's AI plan, step 1 returns it. If a baseline plan is
   created first, the bot may replace it only while it has zero check-ins (§2 decision; §6).

`buildPlan(ctx)` — for each active track (tracks with `localDay < start_date` are skipped):

1. **Day template:** the user's weekly template for today's weekday, else the track default.
   Blocks with `fromWeek` are included only when the track's roadmap week ≥ `fromWeek`.
2. **Fill blocks in this order within the track budget** (`budget_minutes`; a block's own
   `minutes` caps that block):
   - `review` — due items (`due_on ≤ localDay`), sorted: Weak first → items of weak topics →
     most overdue → lowest level. If a Weak problem has a deep-dive the user has not completed,
     the deep-dive is placed right before that problem.
   - `recap` — see §5.6.
   - `new` — the new-item queue (§5.3), taking items in order while they fit. **If the first new
     item alone exceeds the remaining budget it is still included** (flagged "dài hơn thời gian dự
     kiến"), so a Hard problem is never skipped forever. After that, stop at the first item that
     does not fit — order is never broken.
   - `practice` — one exercise or prompt matching `itemType`/`tag` (not-introduced first; prompts
     with `repeatable: true`, such as the mock interview, rotate).
3. **New-card cap:** for tracks with `newPerDay`, the number of new SRS items is
   `effectiveNewPerDay` (§5.5), in addition to the budget.
4. **Empty-block fallback:** if a block yields no items: `review → recap (older introduced items)
   → new`. A user starting on a Saturday therefore still gets work.
5. **Review debt:** if a track has items overdue by more than 7 days and no `review` block today,
   add a review block capped at 25 % of the track budget (covers users who skip every Saturday).
6. **Output:** blocks with deterministic IDs (`<planDate>:<track>:<kind>:<n>`), `est_minutes`,
   `mode` (e.g. `redo`, `explain-aloud`), `item_ids`; plus the per-track roadmap week snapshot and
   `rules_version`.

**Estimates** come from the manifest (`estimates`): DSA E/M/H 20/35/50 min new, ×0.6 for review;
lesson 25; card 1.5 new / 0.5 review; exercise 5; prompt 10 (mock interview 45).
Could-have: calibrate estimates per user from check-in minutes.

**Settings changes** (budget, template, tracks) apply to today's plan only if it has zero
check-ins (the plan is rebuilt, `version + 1`); otherwise they apply from the next plan.

### 5.5 Check-in, throttle, auto check-in

- **One-tap check-in:** tapping a block marks it `done` with `est_minutes` pre-filled. The sheet
  allows `partial` / `skipped`, actual minutes and an optional note.
- **Item results are recorded as they happen** (problem: solved / hint / failed; card: know /
  unsure / don't know), independent of block check-in.
- **Auto check-in:** when the last item of a block gets a result and the block has no check-in
  yet, the server also records `block.checked_in {status: done, minutes: sum(est), auto: true}`.
  The user can edit it. This keeps the strict "completed = a block done/partial" rule (§4.1) from
  punishing someone who studied but forgot to tap.
- **Throttle:** `dueCount` = the track's items due on `localDay` at plan time.
  `effectiveNewPerDay` = `newPerDay` of the matching rule with the highest `dueAbove` that
  `dueCount` exceeds; otherwise `newPerDay`. English defaults: > 40 due → 4 new; > 60 due → 0 new.
  Thresholds are track defaults, user-overridable in settings. When throttled, the dashboard says
  why, e.g. "Đang có 52 thẻ cần ôn — tạm giảm thẻ mới."

### 5.6 Recap day and mock interview

- **DSA recap (Sunday):** use the roadmap's `recap` list of the most recent roadmap week whose core
  items are all introduced and whose recap has not been done (e.g. W1: 271 new, 128 `redo`,
  49 `explain-aloud`). Recap items may be not-introduced (e.g. 271) — they get introduced here.
- If no such week exists (the user is mid-week-one), pick `count` (3) older introduced problems
  deterministically: lowest level first, oldest `last_result_on`, spread across topics.
- **Mock interview** (from roadmap week 3): repeatable prompt `dsa:prompt-mock-interview`, 45 min —
  pick the introduced Medium problem not seen for the longest, solve and explain aloud in English.
- **English Sunday:** the week's weekend task (`tag: weekend-task`, e.g. "record a 1-minute
  stand-up update").
- **Shadowing (English weekdays):** renders 3 example sentences from today's new cards to read
  aloud; completion only.

### 5.7 Spaced repetition

Applies to item types with `srs: true` (problems, flashcards). Intervals come from the track
manifest (`[1, 3, 7, 14]`, DSA `[1, 3, 7, 14, 30]`). Level `L` is 1…N (N = number of intervals);
interval for level L = `intervals[L-1]`.

| Current | Outcome | New level | Weak flag | Next due |
|---|---|---|---|---|
| not started | success | 1 | false | today + intervals[0] |
| not started | partial | 1 | false | today + intervals[0] |
| not started | fail | 1 | **true** | today + intervals[0] |
| L | success | min(L+1, N) | cleared | today + intervals[newL-1] |
| L | partial | L | unchanged | today + intervals[L-1] |
| L | fail | 1 | **true** (lapses + 1) | today + intervals[0] |

- **Outcomes:** success = solved alone / "I know it"; partial = needed a hint / "unsure";
  fail = failed / "don't know".
- **"today"** is the local day of the result, not the due date (reviewing late does not shorten
  the next interval).
- **Only the first result per item per local day changes SRS state.** Later results that day are
  logged but ignored (no grinding a card up three levels in one sitting).
- At level N the item keeps repeating at the longest interval (no graduation in v1; the throttle
  manages load).
- **Status:** Weak if the weak flag is set; otherwise OK (level 1–2) or Strong (level 3+).
  Not started = no row. `item.skipped` sets status `skipped` (introduced, not in SRS).
- **Weak topics:** a topic with ≥ 2 Weak items is highlighted on the dashboard and prioritized on
  the review day.
- **Streak:** consecutive local days (ending today, or yesterday if today is not yet completed)
  with `daily_activity.completed = true`. No freeze in v1. A single missing date caused by a
  schedule change (§5.8) does not break the streak.

### 5.8 Edge cases

| Case | Behavior |
|---|---|
| **Missed a day, last plan had progress** | Next visit creates today's plan. Roadmap continues from the introduced set; due reviews accumulate and are sorted Weak-first. No "catch-up" of missed days — only today's budget. |
| **Missed a day, last plan had nothing done** | Gate closed (§5.2): paused banner, old unfinished blocks, no advancement. |
| **Long absence** (weeks) | Same as above, plus a large review backlog: the throttle reduces new cards; review debt rule adds a capped review block; due sort puts Weak items first. |
| **User pauses a track** | `track.paused`: excluded from plans, due lists and weak areas. On `track.resumed`, all `due_on` dates of that track shift forward by the paused duration, so resuming does not produce an instant backlog. |
| **User pauses everything** | Same per track. Streak breaks (no freeze in v1). |
| **Catching up / studying more** | "Học thêm" adds the next new item(s) to today's plan (`plan.extra_added`, via the server after `requireActive`). Items studied off-plan (from a track page) are attached to today's `extra` block, which is auto-checked-in `done` — studying always counts. |
| **Off-plan study while the gate is closed** | Attached to the last (paused) plan's `extra` block → reopens the gate; the next plan comes the next local day. |
| **Timezone change** | Recorded as a new `schedule_versions` row effective at the **next day start** in the old timezone. Moving west can repeat a local date → `ensurePlan` returns the existing plan. Moving east can skip a date → the gate uses the last *plan*, not the calendar, so nothing breaks; the streak ignores a single date skipped by a schedule change. |
| **Day-start change** | Same mechanism as timezone changes. |
| **Adding a track mid-way** | Starts at the first item of the chosen variant; included today if today's plan has zero check-ins, otherwise from the next plan. |
| **Removing a track** | Excluded from plans, due lists, weak areas and summaries. History is kept; re-adding resumes from the introduced set. "Bắt đầu lại" emits `track.reset`, which clears that track's derived rows (events stay; replay honors the reset). |
| **Switching 10w ↔ 8w** | Introduced set is kept; queue follows the new order. |
| **Content added / reordered** | Not-introduced items flow into the queue in roadmap order; the roadmap week (core-based) does not move back. |
| **Content retired** | Retired items are excluded from queues and due lists; their `item_state` rows are kept but ignored. |
| **Lesson or note not written yet** | Problems are still scheduled (the LeetCode link is enough; page shows "Chưa có ghi chú"). A missing pattern lesson is skipped and flagged in `/admin/content` coverage. |
| **Start date in the future** | "Bắt đầu vào <date>"; no plan until then. Start date in the past is treated as today (no backfill). |
| **Two devices / flaky network** | Client-generated event UUIDs make retries idempotent; version conflicts reload and recompute (max 3). |
| **Bot plan invalid or missing** | Baseline plan is used (§6). |
| **Premium problem** | Shown with its free alternative link(s). |

### 5.9 Module layout (`lib/domain`)

```
lib/domain/
  time/localDay.ts            localDay(), schedule version lookup
  srs/applyResult.ts          SRS transition table (§5.7)
  plan/gate.ts                isGateOpen()
  plan/queues.ts              dueQueue(), newQueue(), recapPicker()
  plan/budget.ts              fill blocks within budget, overshoot rule
  plan/throttle.ts            effectiveNewPerDay()
  plan/buildPlan.ts           orchestrates §5.4
  projection/project.ts       project(state, event) → state (all derived tables)
  projection/replay.ts        replay(events, rulesVersion) → state
  stats/streak.ts · stats/weeklySummary.ts · stats/weakTopics.ts
  rules.ts                    RULES_VERSION
```

Built test-first in M4 (Vitest, table-driven fixtures for every row of §5.7 and §5.8).

---

## 6. AI bot boundaries and bot API contract — NOT YET WRITTEN

## 7. Repo structure and component layers — NOT YET WRITTEN

## 8. Free-tier budget — NOT YET WRITTEN

## 9. Risks and ADRs — NOT YET WRITTEN

---

## Appendix A — Research sources (checked 2026-09-23)

- Vercel Hobby limits: https://vercel.com/docs/plans/hobby · https://vercel.com/docs/limits ·
  fair use (non-commercial): https://vercel.com/docs/limits/fair-use-guidelines ·
  cron: https://vercel.com/docs/cron-jobs/usage-and-pricing
- Supabase: pricing https://supabase.com/pricing · pausing
  https://supabase.com/docs/guides/platform/free-project-pausing · SMTP
  https://supabase.com/docs/guides/auth/auth-smtp · rate limits
  https://supabase.com/docs/guides/auth/rate-limits · API keys
  https://supabase.com/docs/guides/api/api-keys · Next.js SSR auth
  https://supabase.com/docs/guides/auth/server-side/nextjs · backups
  https://supabase.com/docs/guides/platform/backups
- Upstash Redis pricing: https://upstash.com/pricing/redis · ratelimit costs
  https://upstash.com/docs/redis/sdks/ratelimit-ts/costs
- GitHub Actions billing: https://docs.github.com/en/billing/concepts/product-billing/github-actions
- Claude Code Routines: https://code.claude.com/docs/en/routines · cloud environments
  https://code.claude.com/docs/en/cloud-environments · claude-code-action
  https://code.claude.com/docs/en/github-actions
- Next.js 16: https://nextjs.org/docs/app/api-reference/file-conventions/proxy ·
  https://nextjs.org/docs/app/guides/mdx · https://nextjs.org/docs/app/api-reference/config/eslint
- shadcn/ui (Tailwind v4): https://ui.shadcn.com/docs/tailwind-v4 · https://ui.shadcn.com/docs/theming
