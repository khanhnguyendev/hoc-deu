import ts from 'typescript'

const ALLOWED_TEST_PACKAGES = new Set(['vitest', 'fast-check'])

// Full local-time getters and their setter counterparts (§7.2, task 2.3): these read or write the
// *process's* time zone, which `lib/domain` must never depend on. The UTC counterparts
// (getUTCFullYear, ...) are fine and are how this guard's own file (localDay.ts) does its
// calendar math.
const LOCAL_TIME_MEMBERS = new Set([
  'getHours',
  'getDate',
  'getDay',
  'getMonth',
  'getFullYear',
  'getMinutes',
  'getSeconds',
  'getTimezoneOffset',
  'toLocaleDateString',
  'toLocaleTimeString',
  'toLocaleString',
  'setHours',
  'setDate',
  'setMonth',
  'setFullYear',
  'setMinutes',
  'setSeconds',
])

function isTestFile(file: string): boolean {
  return /\.test\.tsx?$/.test(file) || /(^|\/)__tests__\//.test(file)
}

function isAllowedImport(spec: string, testFile: boolean): boolean {
  if (spec === 'zod' || spec.startsWith('zod/')) return true
  if (testFile && ALLOWED_TEST_PACKAGES.has(spec)) return true
  if (spec.startsWith('@/lib/domain')) return true
  if (spec === '.' || spec === '..' || spec.startsWith('./') || spec.startsWith('../')) return true
  return false
}

/**
 * Architecture-test rules for `lib/domain/**` (task 2.3 brief): imports only from `lib/domain`
 * (alias or relative) and `zod` (plus `vitest`/`fast-check` in test files); no `node:*`; no
 * `.tsx` files; no clock reads (`Date.now()`, `Date()` without `new`, argument-less `new Date()`,
 * `performance.now()`); no local-time getters/setters; no `Math.random()`; no `fetch`.
 */
export function purityViolations(file: string, source: string): string[] {
  const normalized = file.split('\\').join('/')
  const violations: string[] = []

  if (normalized.endsWith('.tsx')) {
    violations.push(`${normalized}: lib/domain must not contain .tsx files`)
  }

  const testFile = isTestFile(normalized)
  const sourceFile = ts.createSourceFile(
    normalized,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  )

  function visit(node: ts.Node): void {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const spec = node.moduleSpecifier.text
      if (!isAllowedImport(spec, testFile)) {
        violations.push(`${normalized}: disallowed import "${spec}"`)
      }
    }

    if (ts.isNewExpression(node)) {
      if (ts.isIdentifier(node.expression) && node.expression.text === 'Date') {
        const argCount = node.arguments?.length ?? 0
        if (argCount === 0) {
          violations.push(`${normalized}: argument-less \`new Date()\` is not allowed`)
        }
      }
    } else if (ts.isCallExpression(node)) {
      const callee = node.expression
      if (ts.isIdentifier(callee)) {
        if (callee.text === 'Date') {
          violations.push(`${normalized}: \`Date()\` must be called with \`new\``)
        } else if (callee.text === 'fetch') {
          violations.push(`${normalized}: \`fetch\` is not allowed`)
        }
      } else if (ts.isPropertyAccessExpression(callee)) {
        const objectName = ts.isIdentifier(callee.expression) ? callee.expression.text : undefined
        const memberName = callee.name.text
        if (objectName === 'Date' && memberName === 'now') {
          violations.push(`${normalized}: \`Date.now()\` is not allowed`)
        } else if (objectName === 'performance' && memberName === 'now') {
          violations.push(`${normalized}: \`performance.now()\` is not allowed`)
        } else if (objectName === 'Math' && memberName === 'random') {
          violations.push(`${normalized}: \`Math.random()\` is not allowed`)
        } else if (LOCAL_TIME_MEMBERS.has(memberName)) {
          violations.push(`${normalized}: local-time member \`${memberName}()\` is not allowed`)
        }
      }
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return violations
}
