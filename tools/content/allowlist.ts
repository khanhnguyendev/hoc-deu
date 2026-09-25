// The MDX allowlist (platform design §3.5, §3.6 step 3): it lives in code, outside content/**, so a
// content PR cannot widen what content may do. `next.config.ts` imports this file too, so it keeps
// to relative imports (no `@/` alias); its runtime imports (lib/content/images, lib/domain/settings)
// need at most zod.
import { CONTENT_IMAGE_BASE_URL } from '../../lib/content/images'
import type { MdxComponentName } from '../../lib/content/mdx-components'
import { CODE_LANGUAGES } from '../../lib/domain/settings'

// OD3's base URL and size title live in lib/ (the renderer needs them; the app never imports
// tools/); re-exported here for the check, content:build and next.config.ts.
export { CONTENT_IMAGE_BASE_URL, IMAGE_SIZE_TITLE, parseImageSize } from '../../lib/content/images'

export type MdxContext = 'lesson' | 'note'

export type AttributeRule = {
  required?: boolean
  values?: readonly string[]
  pattern?: RegExp
  maxLength?: number
}

export type ComponentRule = {
  attributes: Readonly<Record<string, AttributeRule>>
  contexts: readonly MdxContext[]
  /** block ⇒ its own line (mdxJsxFlowElement), inline ⇒ inside a sentence (mdxJsxTextElement). */
  display: 'block' | 'inline'
  /** Allowed direct parents (the nearest enclosing component), when restricted. */
  parents?: readonly MdxComponentName[]
  /** A direct child of the document root only. */
  topLevel?: true
  /**
   * `none`: no content; `text`: text-level content only (text, emphasis, inline code, links and
   * inline components), in paragraphs when the component stands on its own lines; `table`: one GFM
   * table; a list: only those components.
   */
  children?: 'none' | 'text' | 'any' | readonly MdxComponentName[] | 'table'
  /** With a component list in `children`: at least this many of them (an empty quiz is a bug). */
  minChildren?: number
  /** Occurrences per file, checked in `contexts` (default: the rule's contexts). */
  perFile?: { min?: number; max?: number; contexts?: readonly MdxContext[] }
}

const BOTH: readonly MdxContext[] = ['lesson', 'note']
const LESSON: readonly MdxContext[] = ['lesson']
const NOTE: readonly MdxContext[] = ['note']
const ONE_PER_NOTE = { min: 1, max: 1, contexts: NOTE }

export const MDX_COMPONENTS: { readonly [K in MdxComponentName]: ComponentRule } = {
  Section: {
    attributes: { kind: { required: true, pattern: /^[a-z][a-z0-9-]*$/ } },
    contexts: LESSON,
    display: 'block',
    topLevel: true,
    children: 'any',
  },
  Callout: {
    attributes: { tone: { required: true, values: ['info', 'tip', 'warning'] }, title: {} },
    contexts: BOTH,
    display: 'block',
    children: 'any',
  },
  Steps: { attributes: {}, contexts: BOTH, display: 'block', children: ['Step'], minChildren: 1 },
  Step: {
    attributes: { title: {} },
    contexts: BOTH,
    display: 'block',
    parents: ['Steps'],
    children: 'text',
  },
  VarTable: { attributes: { caption: {} }, contexts: BOTH, display: 'block', children: 'table' },
  Complexity: {
    attributes: {
      time: { required: true, maxLength: 40 },
      space: { required: true, maxLength: 40 },
    },
    contexts: BOTH,
    display: 'block',
    children: 'none',
    perFile: ONE_PER_NOTE,
  },
  Bilingual: {
    attributes: {
      vi: { required: true, maxLength: 300 },
      en: { required: true, maxLength: 300 },
    },
    contexts: BOTH,
    display: 'block',
    children: 'none',
    perFile: ONE_PER_NOTE,
  },
  Solution: {
    attributes: {},
    contexts: NOTE,
    display: 'block',
    children: 'none',
    perFile: ONE_PER_NOTE,
  },
  Practice: {
    attributes: { problem: { required: true, pattern: /^[a-z][a-z0-9-]{0,31}:lc-\d{4,5}$/ } },
    contexts: LESSON,
    display: 'block',
    children: 'none',
  },
  Quiz: {
    attributes: {},
    contexts: LESSON,
    display: 'block',
    children: ['Question'],
    minChildren: 1,
  },
  Question: {
    attributes: { prompt: { required: true, maxLength: 300 }, answer: { required: true } },
    contexts: LESSON,
    display: 'block',
    parents: ['Quiz'],
    children: ['Choice'],
    minChildren: 2,
  },
  Choice: {
    attributes: { id: { required: true, pattern: /^[a-z0-9]{1,8}$/ } },
    contexts: LESSON,
    display: 'block',
    parents: ['Question'],
    children: 'text',
  },
  Reveal: { attributes: { label: {} }, contexts: BOTH, display: 'block', children: 'any' },
  Term: { attributes: { vi: {} }, contexts: BOTH, display: 'inline', children: 'text' },
}

/** Fenced code languages: the platform's code languages (CODE_LANGUAGES) and plain text. */
export const CODE_LANGS: readonly string[] = [...CODE_LANGUAGES, 'text']

export const IMAGE_EXTENSIONS: readonly string[] = ['svg', 'png', 'webp', 'jpg']

/** The part of an image URL after the base URL. */
export const IMAGE_PATH_PATTERN = /^[a-z0-9\-_/.]+$/

/**
 * A non-empty image base URL, parsed; throws unless it is a canonical `https://` directory URL (no
 * port, credentials, query or fragment; ends in `/`), so a prefix match cannot reach a sibling
 * such as `content-images-evil/` or differ from the URL the browser loads.
 */
export function parseImageBaseUrl(baseUrl: string): URL {
  const url = URL.canParse(baseUrl) ? new URL(baseUrl) : null
  const extra = url !== null && (url.port || url.username || url.password || url.search || url.hash)
  if (url?.protocol !== 'https:' || !url.pathname.endsWith('/') || extra || url.href !== baseUrl) {
    throw new Error(
      `CONTENT_IMAGE_BASE_URL must be a canonical https:// URL ending in '/': ${baseUrl}`,
    )
  }
  return url
}

/** `<trackId>/<localId>/`: relative, path characters only, no empty, `.` or `..` segment. */
export function isImagePathPrefix(prefix: string): boolean {
  const segments = prefix.split('/').slice(0, -1)
  return (
    prefix.endsWith('/') &&
    IMAGE_PATH_PATTERN.test(prefix) &&
    segments.every((segment) => segment !== '' && segment !== '.' && segment !== '..')
  )
}

/** next.config.ts `images.remotePatterns` from the same base URL (single source): [] when it is empty. */
export function contentImageRemotePatterns(
  baseUrl: string = CONTENT_IMAGE_BASE_URL,
): { protocol: 'https'; hostname: string; pathname: string }[] {
  if (baseUrl === '') return []
  const url = parseImageBaseUrl(baseUrl)
  return [{ protocol: 'https', hostname: url.hostname, pathname: `${url.pathname}**` }]
}
