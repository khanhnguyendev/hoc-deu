# ADR-0021: Layer rules via an in-repo ESLint rule, architecture tests and a token guard

- **Status:** accepted
- **Date:** 2026-09-24
- **Spec:** platform design §7.2, §7.3, §7.7

## Context

The UI is layered (tokens → `components/ui` → `components/patterns` → `features/<x>` → `app/`),
`lib/domain` must stay pure, and every visual value must come from the design tokens. Contributors
include an AI bot and future humans; conventions that are not enforced drift. The M0 review found
that ESLint's built-in `no-restricted-imports` cannot see relative imports (`../patterns/x` skipped
every layer) or tell which feature a file belongs to.

## Decision

- **Imports:** an in-repo ESLint rule, `layers/imports` (`tools/eslint/layer-imports.mjs`),
  resolves every import — `@/` alias, relative, re-export and `import()` — to a repo path and
  checks it against the §7.2 table. Built-in `no-restricted-imports` keeps package bans
  (`lib/domain`: React, Next, Supabase, date libraries; everywhere: `next/font/google`).
- **Syntax:** `no-restricted-syntax` bans `className` in pages, `'use client'` in pages and
  layouts, clock reads and `fetch` in `lib/domain`, and any `style` prop other than a literal object
  of CSS custom properties.
- **Tokens:** `eslint-plugin-better-tailwindcss` rejects unknown classes (Tailwind's default colour,
  font, text, radius, shadow and easing namespaces are cleared in `tokens.css`), arbitrary values,
  raw palette/black/white colours in every form, the important modifier, arbitrary breakpoints and
  raw durations. `tools/guards/token-guard.test.ts` scans source text for hex and colour functions,
  extra CSS files, `<style>` and `!important`.
- **Architecture tests** (`tools/guards/`, Vitest): component catalog (every component in
  `COMPONENTS.md` and `/dev/components`), offline build (no Google Fonts), tokens in sync
  (`app/globals.css` ↔ `docs/design/tokens.css`), Dependabot pins; later milestones add guard calls
  (M2), `lib/domain` purity (2.3) and the item-type `switch` ban (3.4). Each rule has tests with
  rejected and allowed cases.

## Consequences

- Layer and token violations fail `pnpm verify` locally and in CI, for people and the bot alike.
- The local rule is about 90 lines to maintain; it has its own tests and mirrors the §7.2 table.
- Exceptions are explicit: a documented ESLint block (e.g. `app/global-error.tsx`) or an entry in
  `tools/guards/token-guard.allow.ts` with a reason.
