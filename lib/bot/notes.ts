/**
 * The notes sanitiser (platform design §6.3; Part B-M6 decision 32): a learner's check-in note as
 * the bot context may carry it under `untrusted.notes` — only when the learner turned on
 * `share_notes_with_ai`. Control characters, anything between `<` and `>` (and a script or style
 * element's body), and URLs (`scheme://…`, `www.…`, `javascript:` and the like; a markdown link
 * keeps its text) are removed, whitespace is collapsed, the text is NFC, then cut to 280
 * graphemes (`Intl.Segmenter`). The note stays the learner's data, never an instruction (§6.5
 * rule 5) — this only keeps markup and links out of the bot's input. Pure; no server-only needed.
 */

/** Decision 32: the most graphemes a shared note keeps. */
export const NOTE_MAX_GRAPHEMES = 280

/** The UTF-16 units read from a note: far above 280 graphemes with markup, and a bound on the
 *  regexes' work. */
export const NOTE_INPUT_MAX = 4096

const segmenter = new Intl.Segmenter('vi', { granularity: 'grapheme' })

/** Tags, comments and script / style elements, removed until none is left (`<<b>b>` hides a tag
 *  in a tag, so they go without leaving a space that would split the outer one). */
const MARKUP =
  /<(script|style)\b[^<>]*>[\s\S]*?<\/\1\s*>|<!--[\s\S]*?(?:-->|$)|<\/?[a-z!?][^<>]*>/gi

function withoutMarkup(text: string): string {
  let clean = text
  for (let previous = ''; previous !== clean;) {
    previous = clean
    clean = clean.replace(MARKUP, '')
  }
  return clean
}

function withoutUrls(text: string): string {
  return (
    text
      // A markdown link or image keeps its text.
      .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/\b[a-z][a-z0-9+.-]*:\/\/\S*/gi, ' ')
      .replace(/\b(?:javascript|vbscript|data|file):\S*/gi, ' ')
      .replace(/\bwww\.\S+/gi, ' ')
  )
}

/** The first `max` graphemes of `text`. */
function firstGraphemes(text: string, max: number): string {
  let out = ''
  let count = 0
  for (const { segment } of segmenter.segment(text)) {
    if (count === max) break
    out += segment
    count += 1
  }
  return out
}

/** A note as the context carries it (decision 32), or null when nothing is left. */
export function sanitizeNote(text: string): string | null {
  let clean = text.slice(0, NOTE_INPUT_MAX).normalize('NFC')
  // Control characters become spaces; invisible format characters (bidi overrides, zero-width
  // spaces, BOM) go, except the zero-width joiner of emoji sequences.
  clean = clean.replace(/\p{Cc}/gu, ' ').replace(/(?!‍)\p{Cf}/gu, '')
  clean = withoutUrls(withoutMarkup(clean))
  clean = clean.replace(/\s+/gu, ' ').trim().normalize('NFC')
  clean = firstGraphemes(clean, NOTE_MAX_GRAPHEMES).trim()
  return clean === '' ? null : clean
}
