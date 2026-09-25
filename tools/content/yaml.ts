/**
 * The one YAML parser for content files (platform design §3.6: a safe parser), shared by
 * `content:build` (`load.ts`) and `content:verify` (`discover.ts`), so both read a file the same way
 * (final review M4). YAML 1.2 with the core schema is pinned: parse errors (duplicate keys
 * included), directives, anchors and aliases, and non-core tags are issues, and then the value is
 * not used. Self-contained (only the `yaml` package), so the content-verify path check covers it as
 * one file.
 */
import { isAlias, LineCounter, parseDocument, visit } from 'yaml'

/** A problem at a position of the parsed text (plus `lineOffset`), or in the file as a whole. */
export type YamlIssue = { line?: number; column?: number; message: string }

export type YamlParse = { ok: true; value: unknown } | { ok: false; issues: YamlIssue[] }

/** The YAML 1.2 core schema's tags; anything else (`!!binary`, `!custom`) is rejected. */
const CORE_TAGS: ReadonlySet<string> = new Set(
  ['map', 'seq', 'str', 'null', 'bool', 'int', 'float'].map((name) => `tag:yaml.org,2002:${name}`),
)
const ANCHORS = 'YAML anchors (&) and aliases (*) are not allowed — write each value out'
const DIRECTIVES =
  'YAML directives (%YAML, %TAG) are not allowed — content is YAML 1.2 (core schema)'

/**
 * The line of a directive (`%YAML 1.1`, `%TAG …`) in the prologue, before any content, or null.
 * Unpinned, `%YAML 1.1` switches a file to YAML 1.1 types (`yes` → true, `n` → false, `1:20` → 80)
 * with no tag to see; `parseContentYaml` pins 1.2 core and rejects directives as well.
 */
function directiveLine(text: string): number | null {
  const lines = text.split('\n')
  for (const [index, line] of lines.entries()) {
    if (line.startsWith('%')) return index + 1
    if (line.trim() !== '' && !line.trimStart().startsWith('#')) return null
  }
  return null
}

/**
 * Parse one YAML document as YAML 1.2 with the core schema. `lineOffset` places frontmatter lines
 * in their MDX file.
 */
export function parseContentYaml(text: string, lineOffset = 0): YamlParse {
  const lineCounter = new LineCounter()
  const doc = parseDocument(text, {
    version: '1.2',
    schema: 'core',
    uniqueKeys: true,
    prettyErrors: true,
    lineCounter,
  })
  const issues: YamlIssue[] = []
  const at = (offset: number) => {
    const { line, col } = lineCounter.linePos(offset)
    return { line: line + lineOffset, column: col }
  }

  const directive = directiveLine(text)
  if (directive !== null) {
    issues.push({ line: directive + lineOffset, column: 1, message: DIRECTIVES })
  }
  for (const error of [...doc.errors, ...doc.warnings]) {
    // An unknown directive is already the issue above.
    if (directive !== null && error.code === 'BAD_DIRECTIVE') continue
    const start = error.linePos?.[0]
    // prettyErrors appends " at line L, column C:" and a source excerpt to the message.
    const message = (error.message.split('\n')[0] ?? '').replace(/ at line \d+, column \d+:$/, '')
    issues.push({
      ...(start === undefined ? {} : { line: start.line + lineOffset, column: start.col }),
      message,
    })
  }
  let anchored = false
  visit(doc, {
    Node(_key, node) {
      const offset = node.range?.[0] ?? 0
      if (!anchored && (isAlias(node) || node.anchor !== undefined)) {
        anchored = true
        issues.push({ ...at(offset), message: ANCHORS })
      }
      if (node.tag !== undefined && !CORE_TAGS.has(node.tag)) {
        issues.push({
          ...at(offset),
          message: `the YAML tag ${node.tag} is not allowed (core tags only)`,
        })
      }
    },
  })

  return issues.length === 0 ? { ok: true, value: doc.toJS() } : { ok: false, issues }
}
