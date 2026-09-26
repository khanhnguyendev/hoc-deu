import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

/**
 * Plans are permanent (decision 35 of M4; the `day_plans_permanent` trigger): e2e cleanup deletes
 * **users** (`deleteTestUser`, whose cascade is the one allowed path), never plans — a spec that
 * deleted a plan would also delete, by cascade, the events that name it. Task 5.1b: no file under
 * `e2e/` deletes from `day_plans`, through supabase-js (`.from('day_plans')….delete()`, directly
 * or through a variable holding that query) or in SQL (`delete from day_plans`). M5-R26 (5.2b):
 * also when the table name is a constant (`.from(PLANS)`), and a raw PostgREST request
 * (`fetch('…/rest/v1/day_plans…', { method: 'DELETE' })`, the URL inline or in a constant).
 */

const TABLE = 'day_plans'
const SQL_DELETE = new RegExp(String.raw`\bdelete\s+from\s+(?:"?public"?\.)?"?${TABLE}"?\b`, 'i')
/** PostgREST's path for the table: `/rest/v1/day_plans`, then `?`, `/`, a quote or the end. */
const REST_PATH = new RegExp(String.raw`/rest/v1/${TABLE}(?![\w-])`)

const isSource = (name: string) => /\.[cm]?[jt]sx?$/.test(name)

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? walk(path) : isSource(name) ? [path] : []
  })
}

const stringText = (node: ts.Node): string | null =>
  ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) ? node.text : null

/** Names the database table: the string `'day_plans'`, or a constant holding it. */
function namesTable(node: ts.Expression, tableConstants: ReadonlySet<string>): boolean {
  return stringText(node) === TABLE || (ts.isIdentifier(node) && tableConstants.has(node.text))
}

/** `x.from('day_plans')` somewhere in this call/property chain, or a variable holding one. */
function reachesPlans(
  node: ts.Expression,
  plansVariables: ReadonlySet<string>,
  tableConstants: ReadonlySet<string>,
): boolean {
  let current: ts.Expression = node
  for (;;) {
    while (ts.isParenthesizedExpression(current) || ts.isAwaitExpression(current)) {
      current = current.expression
    }
    if (ts.isIdentifier(current)) return plansVariables.has(current.text)
    if (ts.isCallExpression(current)) {
      const callee = current.expression
      if (
        ts.isPropertyAccessExpression(callee) &&
        callee.name.text === 'from' &&
        current.arguments.some((argument) => namesTable(argument, tableConstants))
      ) {
        return true
      }
      current = callee
    } else if (ts.isPropertyAccessExpression(current) || ts.isElementAccessExpression(current)) {
      current = current.expression
    } else {
      return false
    }
  }
}

/** Where `source` deletes from `day_plans`: `<file>:<line>` for each. */
function planDeletes(file: string, source: string): string[] {
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true)
  const found: string[] = []
  const at = (node: ts.Node) =>
    `${file}:${sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1}`

  // Variables holding the table name (`const PLANS = 'day_plans'`), a day_plans query (`const
  // plans = admin().from(PLANS)`) or a PostgREST URL of the table (`const url = `…/rest/v1/
  // day_plans``), in source order.
  const tableConstants = new Set<string>()
  const plansVariables = new Set<string>()
  const restVariables = new Set<string>()
  const collect = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      const { initializer } = node
      if (stringText(initializer) === TABLE) tableConstants.add(node.name.text)
      if (reachesPlans(initializer, plansVariables, tableConstants)) {
        plansVariables.add(node.name.text)
      }
      if (REST_PATH.test(initializer.getText(sourceFile))) restVariables.add(node.name.text)
    }
    ts.forEachChild(node, collect)
  }
  collect(sourceFile)

  /** `fetch(<a day_plans REST URL>, { method: 'DELETE' })` (any case, as fetch normalises it). */
  const isRestDelete = (node: ts.CallExpression): boolean => {
    if (!ts.isIdentifier(node.expression) || node.expression.text !== 'fetch') return false
    const [url, init] = node.arguments
    if (url === undefined || init === undefined || !ts.isObjectLiteralExpression(init)) {
      return false
    }
    const toTable =
      REST_PATH.test(url.getText(sourceFile)) ||
      (ts.isIdentifier(url) && restVariables.has(url.text))
    const deletes = init.properties.some(
      (property) =>
        ts.isPropertyAssignment(property) &&
        property.name.getText(sourceFile).replace(/['"]/g, '') === 'method' &&
        stringText(property.initializer)?.toUpperCase() === 'DELETE',
    )
    return toTable && deletes
  }

  const visit = (node: ts.Node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'delete' &&
      reachesPlans(node.expression.expression, plansVariables, tableConstants)
    ) {
      found.push(at(node))
    }
    if (ts.isCallExpression(node) && isRestDelete(node)) found.push(at(node))
    const text = stringText(node)
    if (text !== null && SQL_DELETE.test(text)) found.push(at(node))
    if (ts.isTemplateExpression(node) && SQL_DELETE.test(node.getText(sourceFile))) {
      found.push(at(node))
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return found
}

describe('e2e cleanup never deletes plans (decision 35 of M4, task 5.1b)', () => {
  it('flags every form of a plan delete', () => {
    const flagged = (source: string) => planDeletes('sample.ts', source).length
    expect(flagged(`await admin().from('day_plans').delete().eq('user_id', id)`)).toBe(1)
    expect(flagged(`await admin()\n  .from("day_plans")\n  .delete()\n  .eq('id', planId)`)).toBe(1)
    expect(flagged('const q = admin().from(`day_plans`)\nawait q.delete().eq("id", x)')).toBe(1)
    expect(flagged(`await sql('DELETE FROM public.day_plans WHERE user_id = $1')`)).toBe(1)
    expect(flagged('await sql(`delete from day_plans where id = ${id}`)')).toBe(1)
  })

  it('flags a table name held in a constant, and a raw PostgREST DELETE (M5-R26)', () => {
    const flagged = (source: string) => planDeletes('sample.ts', source).length
    expect(
      flagged(`const PLANS = 'day_plans'\nawait admin().from(PLANS).delete().eq('id', x)`),
    ).toBe(1)
    expect(flagged('const T = `day_plans`\nconst q = admin().from(T)\nawait q.delete()')).toBe(1)
    expect(
      flagged("await fetch(`${url}/rest/v1/day_plans?id=eq.${id}`, { method: 'DELETE', headers })"),
    ).toBe(1)
    expect(
      flagged(`await fetch(url + '/rest/v1/day_plans?user_id=eq.' + id, { method: "delete" })`),
    ).toBe(1)
    expect(
      flagged(
        "const endpoint = `${base}/rest/v1/day_plans`\nawait fetch(endpoint, { method: 'DELETE' })",
      ),
    ).toBe(1)
  })

  it('lets reads, updates and user deletes through', () => {
    const flagged = (source: string) => planDeletes('sample.ts', source).length
    expect(flagged(`await admin().from('day_plans').select('*').eq('user_id', id)`)).toBe(0)
    expect(flagged(`await admin().from('day_plans').update({ seen_at: null })`)).toBe(0)
    expect(flagged(`await admin().from('plan_block_state').delete().eq('plan_id', id)`)).toBe(0)
    expect(flagged(`await admin().auth.admin.deleteUser(id)`)).toBe(0)
    expect(flagged(`const plans = admin().from('day_plans')\nawait other.delete()`)).toBe(0)
    expect(flagged(`const PLANS = 'day_plans'\nawait admin().from(PLANS).select('*')`)).toBe(0)
    expect(flagged(`const OTHER = 'plan_block_state'\nawait admin().from(OTHER).delete()`)).toBe(0)
    expect(flagged("await fetch(`${url}/rest/v1/day_plans?select=id`, { method: 'GET' })")).toBe(0)
    expect(flagged('await fetch(`${url}/rest/v1/day_plans?select=id`)')).toBe(0)
    expect(
      flagged("await fetch(`${url}/rest/v1/plan_block_state?id=eq.1`, { method: 'DELETE' })"),
    ).toBe(0)
  })

  it('finds no plan delete in any file under e2e/', () => {
    const files = walk('e2e')
    expect(files.length).toBeGreaterThan(10)
    const deletes = files.flatMap((file) => planDeletes(file, readFileSync(file, 'utf8')))
    expect(deletes).toEqual([])
  })
})
