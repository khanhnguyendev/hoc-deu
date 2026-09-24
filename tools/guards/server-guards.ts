import ts from 'typescript'
import { GUARD_NAMES } from '@/lib/auth/guards'

const HTTP_METHODS: ReadonlySet<string> = new Set([
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'HEAD',
  'OPTIONS',
])
const GUARDS: ReadonlySet<string> = new Set(GUARD_NAMES)

type ModuleKind = 'server-actions' | 'route-handlers' | 'loaders' | 'other'
type FunctionNode = ts.FunctionDeclaration | ts.FunctionExpression | ts.ArrowFunction

const isRouteFile = (file: string) => /^app\/(.+\/)?route\.tsx?$/.test(file)
const isLoaderFile = (file: string) => /^features\/[^/]+\/queries\.tsx?$/.test(file)

/** String-literal expression statements at the top of a body (`'use server'`, `'use strict'`). */
function directives(statements: readonly ts.Statement[]): string[] {
  const found: string[] = []
  for (const statement of statements) {
    if (!ts.isExpressionStatement(statement) || !ts.isStringLiteral(statement.expression)) break
    found.push(statement.expression.text)
  }
  return found
}

function moduleKind(file: string, sourceFile: ts.SourceFile): ModuleKind {
  if (directives(sourceFile.statements)[0] === 'use server') return 'server-actions'
  if (isRouteFile(file)) return 'route-handlers'
  if (isLoaderFile(file)) return 'loaders'
  return 'other'
}

const hasModifier = (node: ts.Node, kind: ts.SyntaxKind) =>
  ts.canHaveModifiers(node) && (ts.getModifiers(node)?.some((m) => m.kind === kind) ?? false)

/** `requireX()` or `await requireX()` with `requireX` in GUARD_NAMES. */
function isGuardCall(expression: ts.Expression | undefined): boolean {
  if (expression === undefined) return false
  const call = ts.isAwaitExpression(expression) ? expression.expression : expression
  return (
    ts.isCallExpression(call) &&
    ts.isIdentifier(call.expression) &&
    GUARDS.has(call.expression.text)
  )
}

/** A guard call as the first statement after any directives (`const user = await …` counts). */
function startsWithGuard(fn: FunctionNode): boolean {
  const body = fn.body
  if (body === undefined) return false
  if (!ts.isBlock(body)) return isGuardCall(body)
  const first = body.statements[directives(body.statements).length]
  if (first === undefined) return false
  if (ts.isExpressionStatement(first)) return isGuardCall(first.expression)
  if (ts.isVariableStatement(first)) {
    const declarations = first.declarationList.declarations
    return declarations.length === 1 && isGuardCall(declarations[0]?.initializer)
  }
  return false
}

/** The function an exported value holds: a function expression, or one wrapped in `cache()`. */
function functionOf(expression: ts.Expression | undefined): FunctionNode | undefined {
  if (expression === undefined) return undefined
  if (ts.isParenthesizedExpression(expression)) return functionOf(expression.expression)
  if (ts.isArrowFunction(expression) || ts.isFunctionExpression(expression)) return expression
  if (
    ts.isCallExpression(expression) &&
    ts.isIdentifier(expression.expression) &&
    expression.expression.text === 'cache'
  ) {
    return functionOf(expression.arguments[0])
  }
  return undefined
}

const isAsync = (fn: FunctionNode) => hasModifier(fn, ts.SyntaxKind.AsyncKeyword)

/**
 * Architecture test for §2.2 ("every server action and route handler calls a guard, and every
 * `features/*\/queries.ts` loader calls the DAL"). Checks, with the TypeScript compiler API:
 *
 * - a module whose first statement is `'use server'`: every export (each one is an endpoint);
 * - `app/**\/route.ts`: every exported `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`;
 * - `features/<name>/queries.ts`: every exported async function (also inside `cache()`);
 * - any module: every function whose body starts with an inline `'use server'` directive.
 *
 * Each must start with a call — optionally awaited or assigned — to a name in `GUARD_NAMES`. An
 * export this check cannot see into (a re-export, `export *`, a wrapper other than `cache()`) is a
 * violation wherever a guard is required.
 */
export function guardViolations(file: string, source: string): string[] {
  const normalized = file.split('\\').join('/')
  const scriptKind = normalized.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const sourceFile = ts.createSourceFile(
    normalized,
    source,
    ts.ScriptTarget.Latest,
    true,
    scriptKind,
  )
  const kind = moduleKind(normalized, sourceFile)
  const violations: string[] = []
  const report = (name: string, what: string) =>
    violations.push(`${normalized}: ${what} \`${name}\` must call a guard first (${kind})`)

  // Local functions by name, so `export { handler as GET }` checks `handler`.
  const locals = new Map<string, FunctionNode>()
  for (const statement of sourceFile.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name) {
      locals.set(statement.name.text, statement)
    } else if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        const fn = functionOf(declaration.initializer)
        if (fn && ts.isIdentifier(declaration.name)) locals.set(declaration.name.text, fn)
      }
    }
  }

  /** The function an exported expression holds, following a local name (`export const GET = h`). */
  const resolve = (expression: ts.Expression | undefined): FunctionNode | undefined =>
    expression !== undefined && ts.isIdentifier(expression)
      ? locals.get(expression.text)
      : functionOf(expression)

  /** Whether an export under `exportedName` holding `fn` must start with a guard. */
  const mustBeGuarded = (exportedName: string, fn: FunctionNode | undefined): boolean => {
    switch (kind) {
      case 'server-actions':
        return true // every export of a 'use server' module is a callable endpoint
      case 'route-handlers':
        return HTTP_METHODS.has(exportedName)
      case 'loaders':
        return fn !== undefined && isAsync(fn)
      default:
        return false
    }
  }
  const checkExport = (exportedName: string, fn: FunctionNode | undefined) => {
    if (!mustBeGuarded(exportedName, fn)) return
    if (fn === undefined || !startsWithGuard(fn)) report(exportedName, 'export')
  }

  if (kind !== 'other') {
    for (const statement of sourceFile.statements) {
      const exported = hasModifier(statement, ts.SyntaxKind.ExportKeyword)
      if (ts.isFunctionDeclaration(statement) && exported) {
        const isDefault = hasModifier(statement, ts.SyntaxKind.DefaultKeyword)
        checkExport(isDefault ? 'default' : (statement.name?.text ?? 'default'), statement)
      } else if (ts.isVariableStatement(statement) && exported) {
        for (const declaration of statement.declarationList.declarations) {
          const name = ts.isIdentifier(declaration.name) ? declaration.name.text : '(destructured)'
          checkExport(name, resolve(declaration.initializer))
        }
      } else if (ts.isExportAssignment(statement) && !statement.isExportEquals) {
        checkExport('default', resolve(statement.expression))
      } else if (ts.isExportDeclaration(statement) && !statement.isTypeOnly) {
        const clause = statement.exportClause
        if (clause === undefined || !ts.isNamedExports(clause)) {
          // `export * from '…'` / `export * as ns from '…'`: this check cannot see what it exports.
          report('*', 're-export')
          continue
        }
        for (const specifier of clause.elements) {
          if (specifier.isTypeOnly) continue
          const exportedName = specifier.name.getText(sourceFile)
          if (statement.moduleSpecifier === undefined) {
            const localName = (specifier.propertyName ?? specifier.name).getText(sourceFile)
            checkExport(exportedName, locals.get(localName))
          } else if (kind !== 'route-handlers' || HTTP_METHODS.has(exportedName)) {
            // Re-exported from another module: this check cannot see the function.
            report(exportedName, 're-export')
          }
        }
      }
    }
  }

  // Inline server actions (`async function save() { 'use server'; … }`) in any module.
  const visit = (node: ts.Node) => {
    if (
      (ts.isFunctionDeclaration(node) ||
        ts.isFunctionExpression(node) ||
        ts.isArrowFunction(node)) &&
      node.body !== undefined &&
      ts.isBlock(node.body) &&
      directives(node.body.statements).includes('use server') &&
      !startsWithGuard(node)
    ) {
      const name =
        (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node)) && node.name
          ? node.name.text
          : '(anonymous)'
      violations.push(`${normalized}: inline server action \`${name}\` must call a guard first`)
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)

  return violations
}
