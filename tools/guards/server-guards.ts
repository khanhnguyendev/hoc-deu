import path from 'node:path'
import ts from 'typescript'
import { GUARD_NAMES, RESPONSE_GUARD_NAMES, SYNC_GUARD_NAMES } from '@/lib/auth/guards'

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
const SYNC_GUARDS: ReadonlySet<string> = new Set(SYNC_GUARD_NAMES)
/** Guards that return their denial (see `RESPONSE_GUARD_NAMES`): only one form is accepted. */
const RESPONSE_GUARDS: ReadonlySet<string> = new Set(RESPONSE_GUARD_NAMES)

type ModuleKind = 'server-actions' | 'route-handlers' | 'loaders' | 'other'
type FunctionNode = ts.FunctionDeclaration | ts.FunctionExpression | ts.ArrowFunction

/**
 * What an exported binding holds, as far as a syntactic check can tell: a function it can read, a
 * plain value (literal, object, array, `new …`, a type), or something **opaque** — a call, an
 * imported name, a property access — whose function it cannot see.
 */
type Binding = { kind: 'function'; fn: FunctionNode } | { kind: 'value' } | { kind: 'opaque' }
const VALUE: Binding = { kind: 'value' }
const OPAQUE: Binding = { kind: 'opaque' }

const isRouteFile = (file: string) => /^app\/(.+\/)?route\.tsx?$/.test(file)
const isLoaderFile = (file: string) => /^features\/[^/]+\/queries\.tsx?$/.test(file)

/** The directive prologue: leading string-literal statements (`'use strict'; 'use server'`). */
function directives(statements: readonly ts.Statement[]): string[] {
  const found: string[] = []
  for (const statement of statements) {
    if (!ts.isExpressionStatement(statement) || !ts.isStringLiteral(statement.expression)) break
    found.push(statement.expression.text)
  }
  return found
}

function moduleKind(file: string, sourceFile: ts.SourceFile): ModuleKind {
  if (directives(sourceFile.statements).includes('use server')) return 'server-actions'
  if (isRouteFile(file)) return 'route-handlers'
  if (isLoaderFile(file)) return 'loaders'
  return 'other'
}

const hasModifier = (node: ts.Node, kind: ts.SyntaxKind) =>
  ts.canHaveModifiers(node) && (ts.getModifiers(node)?.some((m) => m.kind === kind) ?? false)

const isAsync = (fn: FunctionNode) => hasModifier(fn, ts.SyntaxKind.AsyncKeyword)

/** `expression` without the parentheses around it: `((x))` → `x`. */
function unparenthesized(expression: ts.Expression): ts.Expression {
  let inner = expression
  while (ts.isParenthesizedExpression(inner)) inner = inner.expression
  return inner
}

/**
 * `await requireX()` for any guard, or a bare `publicRoute()` for a synchronous one
 * (`SYNC_GUARD_NAMES`). An un-awaited async guard does not stop the handler: its `redirect()`
 * becomes an unhandled rejection while the rest of the function runs. Parentheses are looked
 * through (`(await requireX())`, `await (requireX())` — M2 carry-over), and so is reading a field
 * of the awaited result (`(await requireX()).id`): the guard still runs, and is awaited, first.
 */
function isGuardCall(expression: ts.Expression | undefined): boolean {
  if (expression === undefined) return false
  let outer = unparenthesized(expression)
  while (ts.isPropertyAccessExpression(outer) || ts.isElementAccessExpression(outer)) {
    const base = unparenthesized(outer.expression)
    // Only a field of an *awaited* guard: `requireX().then` is a promise, not a guard.
    if (!ts.isAwaitExpression(base)) return false
    outer = base
  }
  const guard: ts.Expression = outer
  const awaited = ts.isAwaitExpression(guard)
  const call = awaited ? unparenthesized(guard.expression) : guard
  if (!ts.isCallExpression(call) || !ts.isIdentifier(call.expression)) return false
  const name = call.expression.text
  if (RESPONSE_GUARDS.has(name)) return false // only with its denial returned: startsWithGuard
  return awaited ? GUARDS.has(name) : SYNC_GUARDS.has(name)
}

/** Exactly `await requireX(…)` for a response guard (parentheses aside): nothing read from it. */
function isResponseGuardCall(expression: ts.Expression | undefined): boolean {
  if (expression === undefined) return false
  const awaited = unparenthesized(expression)
  if (!ts.isAwaitExpression(awaited)) return false
  const call = unparenthesized(awaited.expression)
  return (
    ts.isCallExpression(call) &&
    ts.isIdentifier(call.expression) &&
    RESPONSE_GUARDS.has(call.expression.text)
  )
}

/** `if (name) return name` or `if (name) { return name }`, with no `else`. */
function returnsDenial(statement: ts.Statement | undefined, name: string): boolean {
  if (statement === undefined || !ts.isIfStatement(statement) || statement.elseStatement) {
    return false
  }
  const isName = (expression: ts.Expression | undefined) => {
    const inner = expression && unparenthesized(expression)
    return inner !== undefined && ts.isIdentifier(inner) && inner.text === name
  }
  const then = statement.thenStatement
  const only = ts.isBlock(then) && then.statements.length === 1 ? then.statements[0] : then
  return isName(statement.expression) && only !== undefined && ts.isReturnStatement(only)
    ? isName(only.expression)
    : false
}

/**
 * A guard call as the first statement after any directives and empty statements (a leading `;`
 * Prettier adds before `(await requireX())`): `await requireX()`, `const user = await …` or
 * `return await requireX()` (M2 carry-over). A response guard (`RESPONSE_GUARD_NAMES`) counts
 * only as `const denied = await requireX(…)` directly followed by `if (denied) return denied`.
 */
function startsWithGuard(fn: FunctionNode): boolean {
  const body = fn.body
  if (body === undefined) return false
  if (!ts.isBlock(body)) return isGuardCall(body)
  const [first, second] = body.statements
    .slice(directives(body.statements).length)
    .filter((statement) => !ts.isEmptyStatement(statement))
  if (first === undefined) return false
  if (ts.isExpressionStatement(first)) return isGuardCall(first.expression)
  if (ts.isReturnStatement(first)) return isGuardCall(first.expression)
  if (ts.isVariableStatement(first)) {
    const declarations = first.declarationList.declarations
    const declaration = declarations.length === 1 ? declarations[0] : undefined
    if (declaration === undefined) return false
    if (isGuardCall(declaration.initializer)) return true
    return (
      ts.isIdentifier(declaration.name) &&
      isResponseGuardCall(declaration.initializer) &&
      returnsDenial(second, declaration.name.text)
    )
  }
  return false
}

/** Expressions that can only hold plain data, never a function. */
function isPlainValue(expression: ts.Expression): boolean {
  if (ts.isLiteralExpression(expression) || ts.isTemplateExpression(expression)) return true
  if (ts.isPrefixUnaryExpression(expression)) return ts.isLiteralExpression(expression.operand)
  return (
    expression.kind === ts.SyntaxKind.TrueKeyword ||
    expression.kind === ts.SyntaxKind.FalseKeyword ||
    expression.kind === ts.SyntaxKind.NullKeyword ||
    ts.isObjectLiteralExpression(expression) ||
    ts.isArrayLiteralExpression(expression) ||
    ts.isNewExpression(expression)
  )
}

/** Whether the module has `import { cache } from 'react'` (not renamed, not type-only). */
function importsReactCache(sourceFile: ts.SourceFile): boolean {
  return sourceFile.statements.some((statement) => {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) {
      return false
    }
    const clause = statement.importClause
    const named = clause?.namedBindings
    if (statement.moduleSpecifier.text !== 'react' || clause?.isTypeOnly || !named) return false
    return (
      ts.isNamedImports(named) &&
      named.elements.some((e) => !e.isTypeOnly && !e.propertyName && e.name.text === 'cache')
    )
  })
}

/**
 * Architecture test for §2.2 ("every server action and route handler calls a guard, and every
 * `features/*\/queries.ts` loader calls the DAL"). Checks, with the TypeScript compiler API:
 *
 * - a module with `'use server'` in its directive prologue: every export (each one is an endpoint);
 * - `app/**\/route.ts`: every exported `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`;
 * - `features/<name>/queries.ts`: every exported async function, and every export it cannot see
 *   into;
 * - any module: every function whose body starts with an inline `'use server'` directive.
 *
 * Each must start with an awaited call to a name in `GUARD_NAMES` (optionally assigned:
 * `const user = await requireActive()`), or a bare call to a synchronous guard (`publicRoute()`).
 * A guard that returns its denial (`requireCronSecret`) must be followed at once by
 * `if (denied) return denied`.
 * The only wrapper it looks through is `cache(…)` imported as `cache` from `react`. Any other
 * export it cannot see into — a re-export, `export *`, an imported name, another wrapper
 * (`React.cache`, a renamed `cache`, `unstable_cache`) — is a violation wherever a guard is
 * required.
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
  const report = (name: string, problem: string) =>
    violations.push(`${normalized}: ${problem.replace('%s', `\`${name}\``)} (${kind})`)

  // Top-level bindings by name, so `export { handler as GET }` and `export const load = impl`
  // resolve to what `handler` / `impl` hold.
  const reactCache = importsReactCache(sourceFile)
  const functions = new Map<string, ts.FunctionDeclaration>()
  const variables = new Map<string, ts.Expression | undefined>()
  const imported = new Set<string>()
  for (const statement of sourceFile.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name && statement.body) {
      functions.set(statement.name.text, statement)
    } else if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) {
          variables.set(declaration.name.text, declaration.initializer)
        }
      }
    } else if (ts.isImportDeclaration(statement) && !statement.importClause?.isTypeOnly) {
      const clause = statement.importClause
      if (clause?.name) imported.add(clause.name.text)
      const named = clause?.namedBindings
      if (named && ts.isNamespaceImport(named)) imported.add(named.name.text)
      if (named && ts.isNamedImports(named)) {
        for (const element of named.elements) {
          if (!element.isTypeOnly) imported.add(element.name.text)
        }
      }
    }
  }

  const bindingOfName = (name: string, seen: Set<string>): Binding => {
    if (seen.has(name)) return OPAQUE
    seen.add(name)
    const fn = functions.get(name)
    if (fn) return { kind: 'function', fn }
    if (variables.has(name)) return bindingOf(variables.get(name), seen)
    if (imported.has(name)) return OPAQUE
    return VALUE // a type, class, enum or global
  }
  function bindingOf(expression: ts.Expression | undefined, seen = new Set<string>()): Binding {
    if (expression === undefined) return VALUE
    if (
      ts.isParenthesizedExpression(expression) ||
      ts.isAsExpression(expression) ||
      ts.isSatisfiesExpression(expression) ||
      ts.isNonNullExpression(expression)
    ) {
      return bindingOf(expression.expression, seen)
    }
    if (ts.isArrowFunction(expression) || ts.isFunctionExpression(expression)) {
      return { kind: 'function', fn: expression }
    }
    if (ts.isIdentifier(expression)) return bindingOfName(expression.text, seen)
    if (
      reactCache &&
      ts.isCallExpression(expression) &&
      ts.isIdentifier(expression.expression) &&
      expression.expression.text === 'cache'
    ) {
      const inner = bindingOf(expression.arguments[0], seen)
      return inner.kind === 'function' ? inner : OPAQUE
    }
    return isPlainValue(expression) ? VALUE : OPAQUE
  }

  /** Whether an export under `exportedName` holding `binding` must start with a guard. */
  const mustBeGuarded = (exportedName: string, binding: Binding): boolean => {
    switch (kind) {
      case 'server-actions':
        return true // every export of a 'use server' module is a callable endpoint
      case 'route-handlers':
        return HTTP_METHODS.has(exportedName)
      case 'loaders':
        return binding.kind === 'opaque' || (binding.kind === 'function' && isAsync(binding.fn))
      default:
        return false
    }
  }
  const checkExport = (exportedName: string, binding: Binding) => {
    if (!mustBeGuarded(exportedName, binding)) return
    if (binding.kind === 'opaque') {
      report(
        exportedName,
        "export %s is not a function this check can see into (use a plain function or `cache()` from 'react')",
      )
    } else if (binding.kind === 'value' || !startsWithGuard(binding.fn)) {
      report(exportedName, 'export %s must start with an awaited guard call')
    }
  }

  if (kind !== 'other') {
    for (const statement of sourceFile.statements) {
      const exported = hasModifier(statement, ts.SyntaxKind.ExportKeyword)
      if (ts.isFunctionDeclaration(statement) && exported && statement.body) {
        const isDefault = hasModifier(statement, ts.SyntaxKind.DefaultKeyword)
        const name = isDefault ? 'default' : (statement.name?.text ?? 'default')
        checkExport(name, { kind: 'function', fn: statement })
      } else if (ts.isVariableStatement(statement) && exported) {
        for (const declaration of statement.declarationList.declarations) {
          if (ts.isIdentifier(declaration.name)) {
            checkExport(declaration.name.text, bindingOf(declaration.initializer))
          } else {
            checkExport('(destructured)', OPAQUE)
          }
        }
      } else if (ts.isExportAssignment(statement) && !statement.isExportEquals) {
        checkExport('default', bindingOf(statement.expression))
      } else if (ts.isExportDeclaration(statement) && !statement.isTypeOnly) {
        const clause = statement.exportClause
        if (clause === undefined || !ts.isNamedExports(clause)) {
          // `export * from '…'` / `export * as ns from '…'`: this check cannot see what it exports.
          report('*', 're-export %s cannot be checked; export a guarded function instead')
          continue
        }
        for (const specifier of clause.elements) {
          if (specifier.isTypeOnly) continue
          const exportedName = specifier.name.getText(sourceFile)
          if (statement.moduleSpecifier === undefined) {
            const localName = (specifier.propertyName ?? specifier.name).getText(sourceFile)
            checkExport(exportedName, bindingOfName(localName, new Set()))
          } else if (kind !== 'route-handlers' || HTTP_METHODS.has(exportedName)) {
            report(
              exportedName,
              're-export %s cannot be checked; export a guarded function instead',
            )
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
      violations.push(
        `${normalized}: inline server action \`${name}\` must start with an awaited guard call`,
      )
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)

  return violations
}

// -----------------------------------------------------------------------------------------------
// Supabase clients in features (M2 carry-over, task 3.4a)
// -----------------------------------------------------------------------------------------------

/** The modules that create Supabase clients: the session client and the secret-key client. */
const CLIENT_MODULES: readonly string[] = ['lib/supabase/server', 'lib/supabase/admin']

/** `features/<name>/queries.ts` and `features/<name>/actions.ts`: the only client-using modules. */
const isClientModuleUser = (file: string) => /^features\/[^/]+\/(queries|actions)\.tsx?$/.test(file)
const isTestFile = (file: string) => /\.test\.[cm]?[jt]sx?$/.test(file)

/** The repo path a module specifier points at (`@/` alias or relative), without extension. */
function resolveSpecifier(spec: string, file: string): string | null {
  let target: string
  if (spec.startsWith('@/')) target = path.posix.normalize(spec.slice(2))
  else if (spec === '.' || spec === '..' || spec.startsWith('./') || spec.startsWith('../')) {
    target = path.posix.join(path.posix.dirname(file), spec)
  } else return null
  return target.replace(/\/index(?:\.[cm]?[jt]sx?)?$/, '').replace(/\.[cm]?[jt]sx?$/, '')
}

/** Whether an import clause brings in a value (not `import type`, not only `{ type X }`). */
function importsValue(clause: ts.ImportClause | undefined): boolean {
  if (clause === undefined) return true // `import '…'` runs the module
  if (clause.isTypeOnly) return false
  if (clause.name !== undefined) return true
  const named = clause.namedBindings
  if (named === undefined || ts.isNamespaceImport(named)) return true
  return named.elements.some((element) => !element.isTypeOnly)
}

/** Whether an export declaration re-exports a value. */
function exportsValue(statement: ts.ExportDeclaration): boolean {
  if (statement.isTypeOnly) return false
  const clause = statement.exportClause
  if (clause === undefined || !ts.isNamedExports(clause)) return true // `export *`
  return clause.elements.some((element) => !element.isTypeOnly)
}

/**
 * Architecture test for the feature layer's data access (M2 deferred minor from 2.11): in
 * `features/**`, only `features/<name>/queries.ts` (guarded loaders) and `actions.ts` (guarded
 * server actions) may import `lib/supabase/server` or `lib/supabase/admin` — so a helper such as
 * `features/settings/reads.ts` takes the caller's client and cannot create one on its own — and
 * no feature module (its `index.ts` included) re-exports them. Imports, re-exports and dynamic
 * `import()` are resolved (alias or relative); type-only imports are fine; test files are skipped.
 */
export function supabaseClientViolations(file: string, source: string): string[] {
  const normalized = file.split('\\').join('/')
  if (!normalized.startsWith('features/') || isTestFile(normalized)) return []
  const scriptKind = normalized.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const sourceFile = ts.createSourceFile(
    normalized,
    source,
    ts.ScriptTarget.Latest,
    true,
    scriptKind,
  )
  const mayImport = isClientModuleUser(normalized)
  const violations: string[] = []

  const clientModule = (specifier: ts.Expression | undefined): string | null => {
    if (specifier === undefined || !ts.isStringLiteralLike(specifier)) return null
    const target = resolveSpecifier(specifier.text, normalized)
    return target !== null && CLIENT_MODULES.includes(target) ? target : null
  }
  const line = (node: ts.Node) =>
    sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1

  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node)) {
      const target = clientModule(node.moduleSpecifier)
      if (target !== null && !mayImport && importsValue(node.importClause)) {
        violations.push(
          `${normalized}:${line(node)}: imports ${target} — only queries.ts and actions.ts may create Supabase clients`,
        )
      }
    } else if (ts.isExportDeclaration(node)) {
      const target = clientModule(node.moduleSpecifier)
      if (target !== null && exportsValue(node)) {
        violations.push(
          `${normalized}:${line(node)}: re-exports ${target} — a feature never hands out a Supabase client`,
        )
      }
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const target = clientModule(node.arguments[0])
      if (target !== null && !mayImport) {
        violations.push(
          `${normalized}:${line(node)}: imports ${target} — only queries.ts and actions.ts may create Supabase clients`,
        )
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return violations
}
