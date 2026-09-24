# ADR-0032: Tooling pins — TypeScript 6.0.x, ESLint 9.39.x, Node 22.12+

- **Status:** accepted
- **Date:** 2026-09-24
- **Spec:** platform design §2.1, §7.10

## Context

In September 2026 typescript-eslint supports TypeScript below 6.1 (not 7), and Next.js's ESLint
plugins declare support up to ESLint 9. Vitest 5 and supabase-js need Node 22.12 or newer. An
unsupported combination fails quietly: lint rules stop type-checking or crash on some files.

## Decision

- `typescript` pinned to **6.0.x**, `eslint` to **9.39.x**, Node **≥ 22.12** (`engines`,
  `.nvmrc` `22`), pnpm **11.1.1** (`packageManager`). All dependencies are installed with exact
  versions.
- Dependabot ignores **major and minor** updates of `typescript` and `eslint`
  (`.github/dependabot.yml`, with a test in `tools/guards/dependabot.test.ts`); patch updates
  still arrive.

## Consequences

- Lint and type checks stay reliable. New TypeScript or ESLint features wait until the plugins
  support them.
- Revisit when typescript-eslint supports TypeScript 6.1+/7 and `eslint-config-next` supports
  ESLint 10: lift the Dependabot ignore, upgrade on a branch, run `pnpm verify`.
