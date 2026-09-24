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
