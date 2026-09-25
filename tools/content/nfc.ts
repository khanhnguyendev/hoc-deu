/**
 * [RF-3] Vietnamese text is stored composed (NFC): macOS and iOS keyboards can produce decomposed
 * (NFD) text, which looks the same but compares and searches differently. Content is checked, not
 * silently normalised, so the file in git is what the app shows.
 */
import type { ContentIssue } from './issues'

const NOT_NFC = 'is not NFC — save the file with composed (NFC) Unicode characters'

const isNfc = (text: string): boolean => text === text.normalize('NFC')

const join = (path: string, key: string | number): string =>
  path === '' ? String(key) : `${path}.${key}`

/** Every string in a parsed YAML value — keys too — at its path (`cards.0.back`). */
export function nfcIssues(file: string, value: unknown, path = ''): ContentIssue[] {
  if (typeof value === 'string') {
    return isNfc(value) ? [] : [{ file, path, message: NOT_NFC }]
  }
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => nfcIssues(file, entry, join(path, index)))
  }
  if (value !== null && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, entry]) => [
      ...(isNfc(key) ? [] : [{ file, path: join(path, key), message: NOT_NFC }]),
      ...nfcIssues(file, entry, join(path, key)),
    ])
  }
  return []
}

/** One issue for an MDX source that is not NFC, at its first such line. */
export function nfcSourceIssue(file: string, source: string): ContentIssue | null {
  if (isNfc(source)) return null
  const index = source.split('\n').findIndex((line) => !isNfc(line))
  return { file, line: index + 1, message: NOT_NFC }
}

/** Fails on invalid bytes (never U+FFFD) and keeps a leading BOM, so `bomIssue` can report it. */
const UTF8 = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true })

/** A file's bytes as text, or an issue when they are not valid UTF-8. */
export function decodeUtf8(
  file: string,
  bytes: Uint8Array,
): { ok: true; text: string } | { ok: false; issue: ContentIssue } {
  try {
    return { ok: true, text: UTF8.decode(bytes) }
  } catch {
    return { ok: false, issue: { file, message: 'is not valid UTF-8 — save the file as UTF-8' } }
  }
}

/** A leading byte order mark (U+FEFF): invisible, and not part of the text. */
export function bomIssue(file: string, source: string): ContentIssue | null {
  return source.startsWith('\uFEFF')
    ? {
        file,
        line: 1,
        column: 1,
        message: 'starts with a byte order mark (U+FEFF) — save the file as UTF-8 without a BOM',
      }
    : null
}
