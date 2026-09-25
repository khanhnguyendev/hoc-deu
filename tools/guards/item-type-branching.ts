import ts from 'typescript'
import { ITEM_TYPES } from '@/lib/content/schemas/common'

const TYPES: ReadonlySet<string> = new Set(ITEM_TYPES)

/**
 * Where item types may be branched on: the registry and its item folders (`features/items`), and
 * the content pipeline, which builds items by type (`lib/content`, `tools/content`).
 */
const EXEMPT = ['features/items/', 'lib/content/', 'tools/content/']
const SCANNED = ['app/', 'components/', 'features/', 'lib/', 'tools/']

const isTestFile = (file: string) =>
  /\.test\.[cm]?[jt]sx?$/.test(file) || /(^|\/)__tests__\//.test(file)

/** Whether `file` (repo-relative, posix) is subject to the rule. */
export function isBranchingScanned(file: string): boolean {
  const normalized = file.split('\\').join('/')
  return (
    SCANNED.some((dir) => normalized.startsWith(dir)) &&
    !EXEMPT.some((dir) => normalized.startsWith(dir)) &&
    !isTestFile(normalized)
  )
}

/** The literal text of a `case` expression that is a (parenthesised) string, else null. */
function literalText(expression: ts.Expression): string | null {
  let inner = expression
  while (ts.isParenthesizedExpression(inner)) inner = inner.expression
  return ts.isStringLiteral(inner) || ts.isNoSubstitutionTemplateLiteral(inner) ? inner.text : null
}

/**
 * Architecture test for §7.2 — "no `switch`/`case` on item types" outside the registry (gate-review
 * fix 4): every `case` clause whose expression is a string literal naming an item type
 * (`ITEM_TYPES`), with the TypeScript compiler API. Screens render items through the registry
 * (`renderItemRow`, `renderItemPage`); code that must pick items of one type narrows with
 * `isItemOfType` (`features/items/narrow.ts`), so equality checks are not flagged. Files outside
 * the scanned folders, in the exempt ones, and test files report nothing.
 */
export function itemTypeBranches(file: string, source: string): string[] {
  const normalized = file.split('\\').join('/')
  if (!isBranchingScanned(normalized)) return []
  const scriptKind = /\.[cm]?[jt]sx$/.test(normalized) ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const sourceFile = ts.createSourceFile(
    normalized,
    source,
    ts.ScriptTarget.Latest,
    true,
    scriptKind,
  )
  const branches: string[] = []
  const visit = (node: ts.Node) => {
    if (ts.isCaseClause(node)) {
      const text = literalText(node.expression)
      if (text !== null && TYPES.has(text)) {
        const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
        branches.push(
          `${normalized}:${line + 1}: case '${text}' branches on an item type — render through the registry or narrow with isItemOfType`,
        )
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return branches
}
