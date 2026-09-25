# ADR-0009: Tracks are data, item types are code (one registry)

- **Status:** accepted
- **Date:** 2026-09-25
- **Spec:** platform design §3.1, §3.2, §3.8, §7.2, §7.6; implementation plan Part B-M3
  (decisions 4, 6, 23, 24, 25; gate-review fixes 4 and 5)

## Context

Học Đều starts with two tracks (DSA, English) and must take more — the §3.8 "System Design"
example — without touching screens. The things a learner studies differ in kind, not only in
content: a LeetCode problem with a note and solutions, an MDX lesson, a flashcard, an auto-graded
or self-graded exercise, a speaking or writing prompt. Each kind needs its own validation, SRS
behaviour, time estimate, page and list row. If screens branched on the kind (`switch (item.type)`)
every new kind would edit every screen, and a new track would tempt code changes too. The M2
track loader also parsed `track.yaml` at request time with no schema pin, which needed a file
tracing include to reach the deployed function.

## Decision

- **A track is data.** Its manifest (`content/tracks/<id>/track.yaml`: item types, topics, lesson
  formats, SRS parameters, estimates, roadmaps, weekly template) and its content files are
  validated once by `pnpm content:build` into the generated catalog (`.generated/`, ADR-0010,
  ADR-0011). The app reads tracks only from the catalog — `lib/content/tracks.ts` returns
  `getCatalog().tracks` (decision 6): no YAML at runtime, no `outputFileTracingIncludes`. A track
  that uses existing item types needs no code change; flipping its `status` to `active` makes it
  appear in onboarding and settings.
- **An item type is code, in two halves.**
  - The **core** — `lib/content/item-types/<type>.ts`: the authored schema, result outcomes, the
    `srs` flag and `estimateMinutes` (reading the manifest's estimates). No React; `content:build`,
    the bot API and the CLI use it.
  - The **UI** — `features/items/<type>/`: `Page.tsx` (the item page), `Row.tsx` (plan blocks,
    review queue, roadmap lists) and the type's `load` (what the page needs besides the catalog:
    problem — the note's MDX and highlighted code; lesson — its MDX and code; others — nothing).
  - **One registry** — `features/items/registry.ts` (`ITEM_REGISTRY`, `getItemType`) joins them:
    `{ ...core, Page, Row, load }` per type, typed as a mapped type so each type's Page and Row
    receive items of that type. It is server-only (`load` reads the catalog's lazy modules), so
    `features/items/index.ts` is for pages and server features, never for client components.
- **Screens never branch on item type.** They hand items to `renderItemRow(item, …)` and
  `await renderItemPage(item, …)` (`features/items/render.tsx`, fix 5); presentational components
  such as the roadmap's take the resulting rows and pages as `ReactNode` props. Code that must pick
  items of one type (a week's problems, a deck's cards) narrows with `isItemOfType(item, type)`
  (`features/items/narrow.ts`, fix 4). `tools/guards/item-type-branching.ts` — an architecture test
  on the TypeScript AST — fails any `case` clause naming an item type in `app/`, `components/`,
  `features/` (except `features/items/**`), `lib/` and `tools/` (except the content pipeline,
  `lib/content/**` and `tools/content/**`, which builds items by type); test files are skipped.
  Equality checks are not flagged: the rule targets dispatch, and dispatch goes through the
  registry.
- **Item URLs** are `/t/<trackId>/items/<localId>` with the local ID `encodeURIComponent`-encoded
  (derived card IDs contain colons; decision 24): `itemHref` / `itemIdFromRoute`.
- **Page props** carry the viewer (`codeLanguage`, `isAdmin`), the preloaded `data`, a
  `resolveItem` for linked items, the learner's `state` (`null` until item state exists) and,
  from task 5.2, `recordResult` (decision 25).

**Adding an item type** = one core file in `lib/content/item-types/` (plus its line in
`ITEM_TYPE_CORES` and `ITEM_TYPES`), one folder `features/items/<type>/` (Page, Row), one registry
line, and one `COMPONENTS.md` entry per Page and Row (the component-catalog test and the
`/dev/items` gallery check both). No existing screen changes.

## Consequences

- New tracks are content PRs: reviewed as data, validated by `content:build`, no app code — which
  is what lets the v1.1 bot propose content without touching the app.
- New interactions are contained: a new kind of item is one plugin folder; the TypeScript mapped
  type makes a missing Page, Row or `load` a compile error and the registry test a failing test.
- Pages and Rows read the catalog (topic titles, estimates), so they are server components; they
  render in the `/dev/items` gallery (fixture items, e2e + axe) rather than the client component
  catalog. Their interactive parts (flashcard reveal, exercises) are client leaf components in
  `features/items/components` with plain props, catalogued as usual.
- The rule forbids `case` on item types, not every mention of one: an equality check can still
  branch. Narrowing through `isItemOfType` keeps such checks searchable, and review keeps them to
  filtering, never rendering.
- The manifest is parsed once, at build time; changing a track needs a rebuild and deploy (as
  every content change does), never a runtime file read.
