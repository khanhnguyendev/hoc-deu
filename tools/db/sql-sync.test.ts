import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { TRACK_ID_PATTERN } from '@/lib/content/schemas/ids'
import { LEARNER_EVENT_TYPES, SYSTEM_EVENT_TYPES } from '@/lib/domain/events'
import { RULES_VERSION } from '@/lib/domain/rules'
import { BUDGET_MINUTES, CODE_LANGUAGES, ROADMAP_VARIANT_PATTERN } from '@/lib/domain/settings'

const MIGRATIONS = 'supabase/migrations'

/** Every migration, concatenated in the order `supabase db reset` applies them (file name). */
function migrationsSql(): string {
  return readdirSync(MIGRATIONS)
    .filter((file) => file.endsWith('.sql'))
    .sort()
    .map((file) => readFileSync(path.join(MIGRATIONS, file), 'utf8'))
    .join('\n')
}

/**
 * The dollar-quoted body of the last `create [or replace] function [public.]<name>(…)` in `sql`,
 * whatever the dollar-quote tag (`$$`, `$body$`, …).
 */
function lastFunctionBody(sql: string, name: string): string {
  const definition = new RegExp(
    String.raw`create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?${name}\s*\([^)]*\)[\s\S]*?(\$\w*\$)([\s\S]*?)\1`,
    'gi',
  )
  const body = [...sql.matchAll(definition)].at(-1)?.[2]
  if (body === undefined) {
    throw new Error(`No "create function public.${name}" in ${MIGRATIONS}`)
  }
  return body.replace(/--.*$/gm, '')
}

const stringLiterals = (body: string): string[] =>
  [...body.matchAll(/'((?:[^']|'')*)'/g)].map((match) => match[1]!.replaceAll("''", "'"))

/** The capture groups of the last match of `pattern` (a `g` regex) in `sql`. */
function lastCheck(sql: string, pattern: RegExp): string[] {
  const match = [...sql.matchAll(pattern)].at(-1)
  if (match === undefined) throw new Error(`No check matching ${pattern} in ${MIGRATIONS}`)
  return match.slice(1)
}

describe('SQL and TypeScript stay in sync', () => {
  it('public.learner_event_types() returns exactly LEARNER_EVENT_TYPES', () => {
    expect(stringLiterals(lastFunctionBody(migrationsSql(), 'learner_event_types'))).toEqual([
      ...LEARNER_EVENT_TYPES,
    ])
  })

  it('public.system_event_types() returns exactly SYSTEM_EVENT_TYPES', () => {
    expect(stringLiterals(lastFunctionBody(migrationsSql(), 'system_event_types'))).toEqual([
      ...SYSTEM_EVENT_TYPES,
    ])
  })

  it('public.rules_version() returns RULES_VERSION', () => {
    const body = lastFunctionBody(migrationsSql(), 'rules_version')
    expect(/^\s*select\s+(\d+)\s*;?\s*$/i.exec(body)?.[1]).toBe(String(RULES_VERSION))
  })

  it('profiles.code_language allows exactly CODE_LANGUAGES', () => {
    const [list] = lastCheck(
      migrationsSql(),
      /check\s*\(\s*code_language\s+in\s*\(([^)]*)\)\s*\)/gi,
    )
    expect(stringLiterals(list!)).toEqual([...CODE_LANGUAGES])
  })

  it('user_tracks.budget_minutes follows BUDGET_MINUTES', () => {
    const bounds = lastCheck(
      migrationsSql(),
      /check\s*\(\s*budget_minutes\s+between\s+(\d+)\s+and\s+(\d+)\s+and\s+budget_minutes\s*%\s*(\d+)\s*=\s*0\s*\)/gi,
    )
    expect(bounds.map(Number)).toEqual([
      BUDGET_MINUTES.min,
      BUDGET_MINUTES.max,
      BUDGET_MINUTES.step,
    ])
  })

  it('user_tracks.roadmap_variant and track_id use the TypeScript patterns', () => {
    const sql = migrationsSql()
    expect(lastCheck(sql, /check\s*\(\s*roadmap_variant\s*~\s*'([^']*)'\s*\)/gi)).toEqual([
      ROADMAP_VARIANT_PATTERN.source,
    ])
    expect(lastCheck(sql, /check\s*\(\s*track_id\s*~\s*'([^']*)'\s*\)/gi)).toEqual([
      TRACK_ID_PATTERN.source,
    ])
  })

  it('reads the last definition when a later migration replaces a function', () => {
    const sql = [
      "create or replace function public.learner_event_types() returns text[] as $$ select array['a.b'] $$;",
      '-- later migration',
      "create or replace function public.learner_event_types()\nreturns text[] language sql as $$\n  select array['a.b', 'c.d'] -- 'x.y' commented out\n$$;",
    ].join('\n')
    expect(stringLiterals(lastFunctionBody(sql, 'learner_event_types'))).toEqual(['a.b', 'c.d'])
    expect(() => lastFunctionBody(sql, 'rules_version')).toThrow(/rules_version/)
  })

  it('reads `create function` without `or replace`, and any dollar-quote tag', () => {
    const sql = [
      "create or replace function public.learner_event_types() returns text[] as $$ select array['a.b'] $$;",
      "create function public.learner_event_types() returns text[]\nlanguage sql as $body$\n  select array['e.f', 'g$$h.i']\n$body$;",
      'CREATE FUNCTION rules_version() RETURNS integer AS $fn$ select 7 $fn$;',
    ].join('\n')
    expect(stringLiterals(lastFunctionBody(sql, 'learner_event_types'))).toEqual(['e.f', 'g$$h.i'])
    expect(lastFunctionBody(sql, 'rules_version').trim()).toBe('select 7')
  })
})
