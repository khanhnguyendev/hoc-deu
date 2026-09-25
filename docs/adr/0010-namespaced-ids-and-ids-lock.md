# ADR-0010: Namespaced IDs, append-only `ids.lock`, reserved `user:` prefix

- **Status:** accepted
- **Date:** 2026-09-25
- **Spec:** platform design §3.3, §3.6, §5.12; implementation plan Part B-M3 decisions 7–9

## Context

Every learner action is an event that names an item by its ID (§4.4), and events are kept
forever. Content is data under `content/**`, written by people and, from v1.1, by a bot that opens
content PRs. Several tracks share one catalog, derived cards are built from another track's items,
and per-user custom items (§5.12) need IDs that can never collide with content. An ID that changes
or disappears silently would orphan every event that references it, and a reused ID would attach
old history to a new item.

## Decision

- **IDs are `<track>:<localId>`** — the track ID `^[a-z][a-z0-9-]{0,31}$`, the local ID
  `^[a-z0-9][a-z0-9-]{0,63}$`, ASCII only ([RF-3]); exactly one `:`.
- **The file names the ID**, checked by `pnpm content:build` (`tools/content/load.ts`):
  - a `track.yaml`'s `id` is its folder name, and every item in `content/tracks/<t>/` has an ID
    starting `<t>:`;
  - `problems/lc-<number>-<LeetCode slug>/` ↔ `<t>:lc-<number>` (the number zero-padded to four
    digits, five from 10000);
  - `lessons/<slug>.mdx` ↔ `<t>:lesson-<slug>`; `decks/<slug>.yaml` ↔ `<t>:deck-<slug>`;
  - exercise and prompt local IDs start `ex-` / `prompt-`; a card's local ID starts with none of
    `lc-`, `lesson-`, `deck-`, `ex-`, `prompt-`;
  - IDs are unique across all tracks.
- **Derived card IDs are deterministic:** `<track>:<derived deck id>:<source item ID>`
  (`english:explaining-code:dsa:lc-0001`), so rebuilding the catalog never renames a card.
- **`content/ids.lock` is append-only.** A comment header, a `[published]` and a `[retired]`
  section, one ID per line, sorted and unique; derived IDs are included. `pnpm content:build`
  adds new IDs locally. An ID in `[published]` that is no longer in `content/**` fails the build
  until someone restores it, sets `status: retired` on the item (it stays in content and in the
  catalog, never scheduled), or moves the ID to `[retired]` by hand. A `[retired]` ID found in
  content fails the build: IDs are never reused. Only item IDs are locked — decks, roadmaps and
  `<id>#note` publish targets are not items.
- **Check mode in CI and on Vercel:** `pnpm content:build --check`, or `CI` set to anything but
  `''`, `'0'` or `'false'`, never writes the lock and fails when it is stale (missing IDs or not
  normalised). GitHub Actions sets `CI=true` and Vercel builds `CI=1`, so a deployment can never
  publish an ID the lock does not record; CI's `content-build` job catches it first.
- **`user:` is reserved** for per-user custom items (§5.12): no content ID may start with it, and
  no track may be called `user`.

## Consequences

- Events, SRS state and notes can reference an ID forever. Because the file names the ID,
  **renaming a lesson or deck file, or a problem folder, changes the item's ID**: the renamed file
  is a new item (its learners' history does not follow it), and the old ID fails the build until
  it is moved to `[retired]` in the same change. So files are renamed only when a new ID is meant.
- Every content PR that adds items also changes `content/ids.lock` — a reviewable list of what
  becomes permanent. On the content branches only the controller commits the lock, so parallel
  content tasks never conflict on it (decision 8).
- Removing content takes a deliberate, reviewed step (`status: retired` or a hand edit of the
  lock). A mistakenly published ID cannot be taken back, only retired.
- Custom items and content can never collide, whatever either side names its items.

## Limits

- **The lock only knows what is committed.** A change that deletes an item **and** its
  `[published]` line together passes `pnpm content:build`. For the bot's `claude/*` branches the
  v1.1 `path-guard` check rejects any removal from `ids.lock` (platform design §6.6); a human PR
  relies on review of the `ids.lock` diff, where a removed line is visible.

## Merge conflicts in `ids.lock`

Two branches that both add IDs conflict in `content/ids.lock`. Take either side, run
`pnpm content:build` (a local run re-adds every ID found in `content/**`, sorted), and commit the
result. If the build then reports an ID "no longer in content/**", the side you dropped had moved it
to `[retired]`: move it there again.
