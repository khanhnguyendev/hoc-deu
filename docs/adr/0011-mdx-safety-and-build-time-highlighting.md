# ADR-0011: `@next/mdx` with a strict MDX safety check; code highlighting at build time

- **Status:** accepted
- **Date:** 2026-09-25
- **Spec:** platform design §3.5, §3.6, §7.10; implementation plan Part B-M3 (OD1, OD3, decisions
  13, 14, 16, 17)

## Context

Lessons and problem notes are MDX files in `content/**`, and from v1.1 a bot opens content PRs.
MDX is a programming language: `import`/`export`, `{expressions}` and arbitrary JSX run on the
server when a page renders. Content must stay data — prose, a fixed set of components, fenced
code — while still rendering the lesson components (sections, quizzes, solution tabs, …). Code
must be highlighted without shipping a highlighter to the browser, and images need a home that is
neither the repo nor an arbitrary host.

## Decision

- **Renderer:** `@next/mdx` with Turbopack. Remark plugins are passed **by name**
  (`['remark-frontmatter', 'remark-gfm']`): Turbopack cannot take plugin functions. No MDX routes
  and no `pageExtensions` change: pages import MDX through the import map `content:build`
  generates (`.generated/mdx.ts`); `mdx-components.tsx` supplies the component map
  (`features/items/mdx/components.tsx`), and a page binds its own data (`Solution`, `Practice`,
  `pre`) with `mdxComponentsFor`. Frontmatter is YAML (`remark-frontmatter`) and never reaches
  the output.
- **One parser for check and render:** the safety check parses with `@mdx-js/mdx` (OD1) and the
  **same** remark plugins, from one shared list (`tools/content/mdx/remark-plugins.ts`) that both
  `tools/content/mdx/parse.ts` and `next.config.ts` import. A check is only valid if the renderer
  parses exactly like the checker, so `tools/guards/next-config.test.ts` pins, for Turbopack and
  for webpack: no `experimental.mdxRs` (the Rust loader ignores remark plugins — plain CommonMark,
  no GFM, no frontmatter); the loader is `@next/mdx`'s mdx-js loader; and its **whole** options
  object is `{ providerImportSource, remarkPlugins: <the shared list> }` — no rehype or recma
  plugin, no `format`, nothing else that would change the output after the check. It then
  compiles probes with the real config: `See https://x.test/{alert(1)} now` and a `{…}` in
  frontmatter must compile to text, never to an expression.
- **Strict safety check in `content:build`**, on the MDX syntax tree (not regexes): no
  `import` / `export`, no `{expressions}` (braces in prose are written `` `{}` `` or `\{\}`);
  only the allow-listed components, with **literal** attribute values (no expression values, no
  spreads) and per-component rules (contexts, placement, children, counts); links `https:` only
  (no `javascript:`, `data:`, relative or `mailto:`); fenced code needs a language
  (`python`, `java`, `go`, `text`). The allowlist lives in code (`tools/content/allowlist.ts`),
  outside `content/**`, so a content PR cannot widen what content may do. `<Question prompt
  answer>` carries its text in attributes, so the client quiz never inspects children across the
  server/client boundary.
- **Highlighting at build time:** `content:build` runs shiki (CSS-variables theme, JS regex
  engine) and stores **token kinds, not HTML** — compact JSON per item — which the `CodeBlock`
  pattern renders as spans with token utility classes (keyword `text-primary`, string
  `text-success`, constant `text-warning`, comment `text-muted-foreground italic`; decision 13 —
  no new design tokens). No `dangerouslySetInnerHTML`, no inline styles, **zero client JS** for
  highlighting. The MDX `pre` looks a fence up by `codeBlockKey(lang, text)` (the trailing newline
  MDX adds is ignored) and falls back to plain text.
- **Images (owner decision OD3):** remote, in one allow-listed Supabase Storage bucket —
  `content-images` in the production project, public read, owner-only writes, 1 MB per file, SVG /
  PNG / WebP / JPEG — **not in git**. The owner created it in the dashboard on 2026-09-25; no
  migration creates it. One committed constant, `CONTENT_IMAGE_BASE_URL` (`lib/content/images.ts`,
  re-exported by `tools/content/allowlist.ts`), feeds the safety check (URL under the base,
  `<track>/<item-local-id>/` prefix, path characters, extension, non-empty alt, `"WIDTHxHEIGHT"`
  title), `next.config.ts` `images.remotePatterns` and the renderer. `ContentImage` renders
  `next/image` at the size from the title (SVG `unoptimized`) and fails closed: a source outside
  the base renders nothing, because an unoptimized SVG never passes `remotePatterns`. The app
  never imports `tools/` (a layer rule): shared rules live in `lib/`. Runbook:
  `docs/ops/content-images.md`.

## Consequences

- Easier: content PRs — the bot's included — cannot run code or load anything from an arbitrary
  host; reviewing content means reviewing text; pages ship no highlighter; the allowlist and the
  image host each change in exactly one place.
- Harder: authors follow MDX rules the check enforces (escape braces, block components on their
  own lines, headings by context); a new component needs code (allowlist rule + renderer +
  catalog entry), by design.
- Images are **not versioned with content PRs**: reviewers see only URLs, the bot cannot add
  images, and a missing upload is not caught by the offline build (it shows as a broken image on
  the preview). An empty base URL rejects every image. Changing buckets means changing the
  constant and every image URL.
- The shared plugin list must stay the single source: adding a remark plugin is a change to that
  list, checked by the guard test, never a local addition in `next.config.ts` or the checker.
  Any other MDX option (a rehype plugin, `mdxRs`) fails the guard until this ADR is revisited.
