# Học Đều

**Nền tảng học tập dẫn dắt bởi AI** — mỗi ngày một chút, AI giúp bạn tiến đều.

An AI-driven learning platform for Vietnamese IT learners: data-defined tracks (DSA, English for IT
workplaces), a daily plan that only moves forward on days you study, spaced repetition, and — from
v1.1 — a daily AI bot that personalises plans and grows the shared content.

> Status: **M0 (scaffold)**. See the [platform design](docs/plans/2026-09-23-platform-design.md),
> the [design system](docs/design/DESIGN_SYSTEM.md) and the
> [implementation plan](docs/plans/2026-09-24-implementation-plan.md).

## Development

Requirements: Node ≥ 22.12, pnpm 11, [Docker](https://www.docker.com/) (for the local Supabase
stack), and Python ≥ 3.11, JDK ≥ 21 and Go ≥ 1.22 on `PATH` (for `pnpm content:verify`, which runs
the DSA solutions).

```bash
pnpm install
cp .env.example .env.local   # then fill in the Supabase values `pnpm db:start` prints
pnpm dev            # http://localhost:3000
pnpm content:build  # validate content/**, update content/ids.lock, write .generated/
                    # (dev, build, typecheck, test and test:e2e run it first)
pnpm content:verify # run every solution against its tests.yaml (Python, Java, Go)
pnpm verify         # typecheck, lint (ESLint + Prettier), unit tests, build
pnpm db:start       # start the local Supabase stack (db, kong, gotrue, postgrest)
pnpm db:reset       # re-apply migrations and seed data
pnpm test:db        # pgTAP tests against the local stack
pnpm test:e2e       # Playwright + axe (run `pnpm exec playwright install chromium` once)
pnpm verify:full    # verify + test:db + test:e2e — needs the local stack running
pnpm sim:projections # regenerate the simulated finish table after changing DSA roadmaps,
                    # difficulties or the manifest's srs / review / estimates / weeklyTemplate /
                    # defaults
```

Contributor and agent rules live in [CLAUDE.md](CLAUDE.md).

Staging environment setup (Supabase, Vercel, OAuth): [docs/ops/staging.md](docs/ops/staging.md).

## License

- **Code:** [MIT](LICENSE).
- **Learning content** (everything under `content/`): [CC BY-NC-SA 4.0](content/LICENSE) —
  share and adapt with attribution, non-commercially, under the same license.
- **Fonts** (`app/fonts/`): Be Vietnam Pro and JetBrains Mono under the
  [SIL Open Font License 1.1](app/fonts/be-vietnam-pro/OFL.txt), self-hosted so the build works
  offline.
