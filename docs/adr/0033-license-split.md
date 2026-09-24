# ADR-0033: License split — code MIT, `content/**` CC BY-NC-SA 4.0

- **Status:** accepted
- **Date:** 2026-09-24
- **Spec:** platform design §9.3

## Context

The repository is public (ADR-0005). The code should be freely reusable; the learning content
(notes, lessons, decks) is the project's main asset and should stay open but non-commercial. Bot
content PRs add to `content/**`. Fonts are third-party files with their own license.

## Decision

- **Code:** MIT (`LICENSE` at the root).
- **Learning content** (`content/**`): CC BY-NC-SA 4.0 — `content/LICENSE` is the official legal
  code fetched from creativecommons.org, not retyped. Bot-written content is added under the same
  license.
- **Fonts** (`app/fonts/**`): SIL Open Font License 1.1, kept as each family's `OFL.txt` next to
  the font files (ADR-0001).
- `README.md` states the split.

## Consequences

- Anyone can reuse the code; content reuse requires attribution, non-commercial use and the same
  license.
- Contributors must put content under `content/` and code elsewhere; mixed files (e.g. MDX with
  code samples) follow the content license.
