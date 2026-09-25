/**
 * Build-time code highlighting for the content pipeline (task 3.3a). Uses
 * `createHighlighterCore` with the JavaScript regex engine (no WASM, spike: init 8 ms, 300
 * Python/Java/Go snippets in 245 ms) and a CSS-variables theme, so highlighting never runs in the
 * browser and produces no HTML — only `HighlightedCode` token runs (decision 14).
 *
 * `Highlighter` is created once and reused: `createHighlighterCore` compiles every grammar, so
 * creating one per call would defeat the point (guarded by the perf test).
 */
import { createHighlighterCore, createCssVariablesTheme } from 'shiki/core'
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript'
import type { ThemedToken } from 'shiki/core'
import go from 'shiki/langs/go.mjs'
import java from 'shiki/langs/java.mjs'
import python from 'shiki/langs/python.mjs'
import {
  plainCode,
  type CodeLine,
  type CodeTokenKind,
  type HighlightedCode,
} from '@/lib/content/code-tokens'

export type Highlighter = {
  highlight(code: string, lang: string): HighlightedCode
  dispose(): void
}

const THEME_NAME = 'hoc-deu-code-tokens'

/** The languages this project highlights; every other language throws in `highlight()`. */
const SUPPORTED_LANGS = new Set(['python', 'java', 'go'])

/** The CSS-variables theme's `--shiki-token-*` suffix → this project's token kind (decision 13). */
const KIND_BY_COLOR_SUFFIX: Readonly<Record<string, CodeTokenKind>> = {
  keyword: 'keyword',
  string: 'string',
  'string-expression': 'string',
  constant: 'constant',
  comment: 'comment',
}

const COLOR_VAR = /^var\(--shiki-token-([a-z-]+)\)$/

/** The token kind for a CSS-variables-theme token colour, or `null` for plain (inherited) text. */
function kindOf(color: string | undefined): CodeTokenKind | null {
  if (color === undefined) return null
  const match = COLOR_VAR.exec(color)
  if (match === null) return null
  return KIND_BY_COLOR_SUFFIX[match[1] as string] ?? null
}

/** Merges shiki's tokens for one line into a `CodeLine`: adjacent runs of one kind are merged. */
function toCodeLine(tokens: readonly ThemedToken[]): CodeLine {
  const runs: Array<string | [string, CodeTokenKind]> = []
  for (const token of tokens) {
    if (token.content === '') continue
    const kind = kindOf(token.color)
    const last = runs[runs.length - 1]
    if (kind === null) {
      if (typeof last === 'string') runs[runs.length - 1] = last + token.content
      else runs.push(token.content)
    } else if (Array.isArray(last) && last[1] === kind) {
      last[0] += token.content
    } else {
      runs.push([token.content, kind])
    }
  }
  return runs
}

/** Removes one trailing `\n` from `code`, if present — matches `lib/content/code-tokens.ts`. */
function trimOneTrailingNewline(code: string): string {
  return code.endsWith('\n') ? code.slice(0, -1) : code
}

export async function createHighlighter(): Promise<Highlighter> {
  const theme = createCssVariablesTheme({ name: THEME_NAME })
  const core = await createHighlighterCore({
    themes: [theme],
    langs: [python, java, go],
    engine: createJavaScriptRegexEngine(),
  })

  return {
    highlight(code: string, lang: string): HighlightedCode {
      if (lang === 'text') return plainCode(lang, code)
      if (!SUPPORTED_LANGS.has(lang)) throw new Error(`unsupported language: ${lang}`)
      const tokens = core.codeToTokensBase(trimOneTrailingNewline(code), {
        lang,
        theme: THEME_NAME,
      })
      return { lang, lines: tokens.map(toCodeLine) }
    },
    dispose() {
      core.dispose()
    },
  }
}
