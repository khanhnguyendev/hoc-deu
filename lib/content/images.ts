/**
 * MDX images (owner decision OD3): the one allow-listed source and the size-title format. Shared
 * by the renderer (`features/items/components/mdx/content-image.tsx`) and, re-exported through
 * `tools/content/allowlist.ts`, by the MDX safety check and `next.config.ts` — so this file keeps
 * to no imports (the Next config loads it).
 */

/** The one allow-listed image source, committed as data (a public URL — no key). If it is ever
 *  set to '', every MDX image is rejected (tested with an injected base). */
export const CONTENT_IMAGE_BASE_URL =
  'https://oelgwbxukbgaqqvociwi.supabase.co/storage/v1/object/public/content-images/'

/** The image title carries its size: `![alt](url "WIDTHxHEIGHT")`, 1–9999 each. */
export const IMAGE_SIZE_TITLE = /^([1-9]\d{0,3})x([1-9]\d{0,3})$/

/** The size in an image title, or null when it is missing or malformed. */
export function parseImageSize(
  title: string | null | undefined,
): { width: number; height: number } | null {
  const match = IMAGE_SIZE_TITLE.exec(title ?? '')
  if (match === null) return null
  return { width: Number(match[1]), height: Number(match[2]) }
}
