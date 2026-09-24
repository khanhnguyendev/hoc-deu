import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

export type TokenViolation = { file: string; line: number; rule: string; excerpt: string }

const SCANNED_DIRS = ['app', 'components', 'features'] as const
const TOKEN_FILE = 'app/globals.css'

const LINE_RULES: ReadonlyArray<{ rule: string; pattern: RegExp }> = [
  { rule: 'hex-colour', pattern: /#[0-9a-fA-F]{3,8}\b/ },
  { rule: 'colour-function', pattern: /\b(?:rgba?|hsla?|oklch|oklab|lab|lch|color)\(/ },
  { rule: 'important', pattern: /!important/ },
  { rule: 'inline-style-tag', pattern: /<style[\s>]/ },
  { rule: 'style-literal-unit', pattern: /style=\{\{[^}]*\b\d+(?:\.\d+)?(?:px|rem|em|ms|s)\b/ },
]

/** Find hard-coded visual values in one source file (platform design §7.3). */
export function findTokenViolations(file: string, source: string): TokenViolation[] {
  const normalized = file.split(sep).join('/')
  if (normalized === TOKEN_FILE) return []
  if (normalized.endsWith('.css')) {
    return [
      {
        file: normalized,
        line: 1,
        rule: 'css-file',
        excerpt: 'Only app/globals.css may contain CSS.',
      },
    ]
  }
  const violations: TokenViolation[] = []
  source.split('\n').forEach((text, index) => {
    for (const { rule, pattern } of LINE_RULES) {
      if (pattern.test(text)) {
        violations.push({
          file: normalized,
          line: index + 1,
          rule,
          excerpt: text.trim().slice(0, 120),
        })
      }
    }
  })
  return violations
}

/** Scan app/, components/ and features/ under `root`, skipping allow-listed files. */
export function scanRepo(root: string, allow: Readonly<Record<string, string>>): TokenViolation[] {
  const results: TokenViolation[] = []
  for (const dir of SCANNED_DIRS) {
    let entries: string[]
    try {
      entries = readdirSync(join(root, dir), { recursive: true, encoding: 'utf8' })
    } catch {
      continue // the layer does not exist yet
    }
    for (const entry of entries) {
      if (!/\.(tsx?|css|mdx?)$/.test(entry)) continue
      const file = relative(root, join(root, dir, entry))
        .split(sep)
        .join('/')
      if (allow[file]) continue
      results.push(...findTokenViolations(file, readFileSync(join(root, file), 'utf8')))
    }
  }
  return results
}
