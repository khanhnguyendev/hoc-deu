# Content images runbook

How lessons and notes get images (implementation plan Part B-M3, owner decision OD3; ADR-0011).
No keys or secrets live in this file: the bucket is public-read and every upload is done by the
owner in the Supabase dashboard.

See also: `tools/content/allowlist.ts` (`CONTENT_IMAGE_BASE_URL`, the safety-check rules),
`next.config.ts` (`images.remotePatterns`), `features/items/components/mdx/content-image.tsx` (the
renderer) and `docs/ops/staging.md` (which Supabase project previews use).

## 1. The bucket already exists

- Bucket **`content-images`** in the **production** Supabase project (`hoc-deu`), created by the
  owner in the dashboard on **2026-09-25**.
- Settings: **public read**, owner-only writes, **1 MB** per file, allowed MIME types
  `image/svg+xml`, `image/png`, `image/webp`, `image/jpeg`.
- **No migration creates it**: the local stack runs without the storage service
  (`pnpm db:start` excludes `storage-api`), and every environment — local, previews, staging and
  production — reads this one bucket. Content URLs therefore never change between environments.

## 2. Uploading (owner, dashboard only)

- Upload in the Supabase dashboard → Storage → `content-images`. Only the owner uploads; the v1.1
  bot never uploads images (it cannot add them to content either).
- Path: `<track>/<item-local-id>/<name>.<ext>`, for example
  `dsa/lesson-two-pointers/walk.svg`. The safety check requires this prefix for the item that
  references the image.
- Extensions: `svg`, `png`, `webp`, `jpg` (lower case; `.jpeg` is not accepted — rename to `.jpg`).
- Names: lower case `[a-z0-9-_.]` only — no spaces, capitals or other characters; no `..`.
- SVGs are exported **without scripts** (no `<script>`, no event attributes, no external
  references). Prefer SVG for diagrams; keep raster images well under the 1 MB limit.

## 3. Licence

Images are content: **CC BY-NC-SA 4.0**, like `content/**` (ADR-0033). Say so in the PR that
references them, and only upload images you made or may share under that licence.

## 4. The base URL

```text
https://oelgwbxukbgaqqvociwi.supabase.co/storage/v1/object/public/content-images/
```

- Committed as `CONTENT_IMAGE_BASE_URL` in `tools/content/allowlist.ts` — a public URL, not a key.
- The same constant feeds `next.config.ts` `images.remotePatterns` (one pattern: that host,
  pathname `/storage/v1/object/public/content-images/**`), so the MDX safety check and Next's image
  optimiser always agree on the one allowed source.
- **Changing buckets** is a PR that changes that one constant — and every image URL in `content/**`.
  An empty base URL rejects every MDX image.

## 5. Referencing an image in MDX

```md
![Hai con trỏ đi từ hai đầu mảng lại gần nhau](https://oelgwbxukbgaqqvociwi.supabase.co/storage/v1/object/public/content-images/dsa/lesson-two-pointers/walk.svg "640x360")
```

- `![alt](<base><track>/<local-id>/<name>.<ext> "WIDTHxHEIGHT")`: non-empty Vietnamese alt text
  that says what the image shows, the full `https://` URL under the base, and the intrinsic size
  in the title (1–9999 each). The renderer uses `next/image` at that size: raster images go
  through Next's optimiser, SVGs are served as uploaded.
- **Upload first, then open the content PR.** The build never fetches images (it must work
  offline), so a missing upload is not caught by `pnpm verify` — it only shows as a broken image
  on the preview. Open the preview and check every new image before asking for review.
- Reviewers see only URLs in the diff: open them (or the preview) to review the images themselves.
