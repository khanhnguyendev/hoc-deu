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
pnpm typecheck      # next typegen + tsc
pnpm lint           # ESLint (layer, token, style rules) + Prettier check
pnpm test           # Vitest (*.test.ts in Node, *.test.tsx in jsdom)
pnpm build          # next build (works offline: fonts are self-hosted in app/fonts)
pnpm test:e2e       # Playwright + axe
pnpm db:start       # start the local Supabase stack (db, kong, gotrue, postgrest)
pnpm db:stop        # stop it
pnpm db:reset       # re-apply migrations and seed data
pnpm db:types       # regenerate lib/supabase/database.types.ts from the local schema
pnpm test:db        # pgTAP tests (supabase test db) — needs pnpm db:start
pnpm verify:full    # verify + test:db + test:e2e — needs pnpm db:start
pnpm format         # Prettier write
pnpm tokens:sync    # regenerate docs/design/tokens.css and the token block of app/globals.css
```

Later milestones add `pnpm content:build`, `pnpm content:verify`, `pnpm bot`.

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

`tools/eslint/layer-imports.mjs` resolves every import (alias, relative, re-export, `import()`)
to a repo path before checking it, so `../` cannot skip a layer. A feature may import its own
files by alias or relative path.

- **Search `docs/design/COMPONENTS.md` before creating a component.** If two or more places need
  something similar, extract it into `components/patterns`. Update `COMPONENTS.md` and
  `/dev/components` in the same commit as any new or changed component.
- Variants via `cva`, merged with `cn()`; never copy-paste class strings.
- Item rendering goes through the item-type registry (`features/items/registry.ts`); never switch
  on item type in screens.
- Every data-driven component handles loading, empty and error states.

## Visual values

No hex, `rgb()`, `oklch()`, `px`/`rem`/`ms` literals, `!important`, extra CSS files or arbitrary
Tailwind values (`p-[13px]`, `text-[#fff]`, `max-[600px]:`) outside `app/globals.css`. Use token
utilities (`bg-surface`, `bg-background/50`, `text-muted-foreground`, `bg-track`, `rounded-lg`,
`duration-(--duration-fast)`). Tailwind's default colours, fonts, text sizes, radii, shadows and
easings are cleared, so `bg-red-500` or `shadow-lg` is an unknown class. `style` props may only set
CSS custom properties (`style={{ '--progress': value }}`). ESLint and the token guard
(`tools/guards`) fail the build otherwise. To change a token: edit `docs/design/assets/palette.py`
(or `gen_tokens.py`), run `pnpm tokens:sync` — it rewrites only the block between
`/* tokens:start */` and `/* tokens:end */` in `app/globals.css`, so CSS outside it survives.

## React / Next.js

- **Server Components by default.** `'use client'` only on interactive leaf components — never on
  `page.tsx` or `layout.tsx`. Browser APIs (`window`, `localStorage`, …) only in client components.
- Every server action, route handler and `features/*/queries.ts` loader calls a guard first
  (`requireUser`, `requireActive`, `requireOnboarded`, `requireAdmin`, `requireDevAccess`,
  `requireBotToken`, `requireCronSecret` or `publicRoute()`) — enforced by
  `tools/guards/server-guards.ts` (ADR-0006). Guards `redirect()` / `notFound()` by throwing: never
  call them inside `try`/`catch`.
- Supabase on the server: `createClient()` (`lib/supabase/server.ts`, RLS applies) for everything
  done for a user; `createAdminClient()` (`lib/supabase/admin.ts`, secret key) only for system, bot
  and admin writes. `'use client'` modules never import `lib/env` or `lib/supabase/admin` (ESLint).
- `lib/domain` is pure TypeScript: no React/Next/Supabase imports, no date library, no
  `Date.now()` / `new Date()` — `now` and `localDay` are parameters.

## Copy and accessibility

- All UI strings are Vietnamese, in `lib/i18n/vi.ts`; technical terms stay English.
  `<html lang="vi">`; wrap English learning content in `lang="en"`.
- WCAG 2.1 AA: visible focus, keyboard access, 44 px touch targets, never colour alone,
  `prefers-reduced-motion` respected. axe runs in CI.

## Safety

- **Never read or commit `.env*`, `docs/credentials/` or any secret.** Never print secrets.
  `.env.example` is the committed template; every other `.env*` stays unread.
- Per-user data never goes into the repo; `supabase/seed.sql` holds synthetic users only.
- **No new dependencies without asking the owner** (approved list: platform design §7.10).
- Do not pull `v1.1` or `later` features into v1.0 (release scope table, platform design §0).

## Git

- Conventional Commits (`feat:`, `fix:`, `test:`, `docs:`, `ci:`, `build:`, `chore:`,
  `refactor:`).
- Small commits, one reviewable change each; work on a branch and open a PR; CI must be green.
