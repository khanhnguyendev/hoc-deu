import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

/**
 * Plans are permanent (decision 35 of M4; the `day_plans_permanent` trigger): e2e cleanup deletes
 * **users** (`deleteTestUser`, whose cascade is the one allowed path), never plans — a spec that
 * deleted a plan would also delete, by cascade, the events that name it. Task 5.1b: no file under
 * `e2e/` deletes from `day_plans`, through supabase-js (`.from('day_plans')….delete()`, directly
 * or through a variable holding that query) or in SQL (`delete from day_plans`).
 */

const TABLE = 'day_plans'
const SQL_DELETE = new RegExp(String.raw`\bdelete\s+from\s+(?:"?public"?\.)?"?${TABLE}"?\b`, 'i')

const isSource = (name: string) => /\.[cm]?[jt]sx?$/.test(name)

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? walk(path) : isSource(name) ? [path] : []
  })
}

const stringText = (node: ts.Node): string | null =>
  ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) ? node.text : null

/** `x.from('day_plans')` somewhere in this call/property chain, or a variable holding one. */
function reachesPlans(node: ts.Expression, plansVariables: ReadonlySet<string>): boolean {
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
        current.arguments.some((argument) => stringText(argument) === TABLE)
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

  // Variables initialised with a day_plans query: `const plans = admin().from('day_plans')`.
  const plansVariables = new Set<string>()
  const collect = (node: ts.Node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer !== undefined &&
      reachesPlans(node.initializer, plansVariables)
    ) {
      plansVariables.add(node.name.text)
    }
    ts.forEachChild(node, collect)
  }
  collect(sourceFile)

  const visit = (node: ts.Node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'delete' &&
      reachesPlans(node.expression.expression, plansVariables)
    ) {
      found.push(at(node))
    }
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

  it('lets reads, updates and user deletes through', () => {
    const flagged = (source: string) => planDeletes('sample.ts', source).length
    expect(flagged(`await admin().from('day_plans').select('*').eq('user_id', id)`)).toBe(0)
    expect(flagged(`await admin().from('day_plans').update({ seen_at: null })`)).toBe(0)
    expect(flagged(`await admin().from('plan_block_state').delete().eq('plan_id', id)`)).toBe(0)
    expect(flagged(`await admin().auth.admin.deleteUser(id)`)).toBe(0)
    expect(flagged(`const plans = admin().from('day_plans')\nawait other.delete()`)).toBe(0)
  })

  it('finds no plan delete in any file under e2e/', () => {
    const files = walk('e2e')
    expect(files.length).toBeGreaterThan(10)
    const deletes = files.flatMap((file) => planDeletes(file, readFileSync(file, 'utf8')))
    expect(deletes).toEqual([])
  })
})
