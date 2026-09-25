import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { ITEM_TYPES } from '@/lib/content/schemas/common'
import { TRACK_ID_PATTERN } from '@/lib/content/schemas/ids'
import { LEARNER_EVENT_TYPES, MAX_PAUSED_DAYS, SYSTEM_EVENT_TYPES } from '@/lib/domain/events'
import { RULES_VERSION } from '@/lib/domain/rules'
import { BUDGET_MINUTES, CODE_LANGUAGES, ROADMAP_VARIANT_PATTERN } from '@/lib/domain/settings'
import { CHECK_IN_STATUSES, ITEM_STATE_STATUSES } from '@/lib/domain/state'

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

/**
 * Every `create table` and `alter table` statement of `[public.]<table>` in `sql`, in order and
 * without comments, so `lastCheck` over it reads that table's own checks (several tables have a
 * `check (status in (…))`) and a later `alter table … add constraint` wins over the first one.
 */
function tableSql(sql: string, table: string): string {
  const statement = new RegExp(
    String.raw`(?:create\s+table|alter\s+table(?:\s+only)?)\s+(?:public\.)?${table}\b[^;]*;`,
    'gi',
  )
  const statements = [...sql.replace(/--.*$/gm, '').matchAll(statement)].map((match) => match[0])
  if (statements.length === 0) throw new Error(`No "create table public.${table}" in ${MIGRATIONS}`)
  return statements.join('\n')
}

const STATUS_CHECK = /check\s*\(\s*status\s+in\s*\(([^)]*)\)\s*\)/gi

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

  // Decision 18: pgTAP 070 asserts that the running database's rules_version() returns this
  // literal, so the constant, the migrations and the live function cannot disagree unnoticed.
  it('pgTAP 070 checks the running rules_version() against RULES_VERSION', () => {
    const pgtap = readFileSync('supabase/tests/database/070-derived-tables.test.sql', 'utf8')
    expect(/select is\(\s*public\.rules_version\(\),\s*(\d+)/.exec(pgtap)?.[1]).toBe(
      String(RULES_VERSION),
    )
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

  // Final review M-9: equal by inspection until now. A new item type (spec §3.8) would otherwise
  // fail every item_state insert with a raw check violation.
  it('item_state.item_type allows exactly ITEM_TYPES (lib/content)', () => {
    const [list] = lastCheck(
      tableSql(migrationsSql(), 'item_state'),
      /check\s*\(\s*item_type\s+in\s*\(([^)]*)\)\s*\)/gi,
    )
    expect(stringLiterals(list!)).toEqual([...ITEM_TYPES])
  })

  it('item_state.status allows exactly ITEM_STATE_STATUSES', () => {
    const [list] = lastCheck(tableSql(migrationsSql(), 'item_state'), STATUS_CHECK)
    expect(stringLiterals(list!)).toEqual([...ITEM_STATE_STATUSES])
  })

  it('plan_block_state.status allows exactly CHECK_IN_STATUSES', () => {
    const [list] = lastCheck(tableSql(migrationsSql(), 'plan_block_state'), STATUS_CHECK)
    expect(stringLiterals(list!)).toEqual([...CHECK_IN_STATUSES])
  })

  it('apply_event bounds track.resumed pausedDays to 0–MAX_PAUSED_DAYS (decision 36)', () => {
    const bounds = lastCheck(
      lastFunctionBody(migrationsSql(), 'apply_event'),
      /\(v_payload\s*->\s*'pausedDays'\)::numeric\s+between\s+(\d+)\s+and\s+(\d+)/gi,
    )
    expect(bounds.map(Number)).toEqual([0, MAX_PAUSED_DAYS])
    // pgTAP 071 accepts the bound and rejects one more.
    const pgtap = readFileSync('supabase/tests/database/071-apply-event-derived.test.sql', 'utf8')
    expect(pgtap).toContain(`{"pausedDays": ${MAX_PAUSED_DAYS}}`)
    expect(pgtap).toContain(`{"pausedDays": ${MAX_PAUSED_DAYS + 1}}`)
  })

  it("reads a table's own checks, the last one winning", () => {
    const sql = [
      "create table public.item_state (\n  status text check (status in ('a', 'b')) -- ('x')\n);",
      "create table public.plan_block_state (status text check (status in ('c')));",
      "alter table public.item_state add constraint item_state_status check (status in ('a', 'b', 'd'));",
      "create table public.item_state_archive (status text check (status in ('e')));",
    ].join('\n')
    expect(stringLiterals(lastCheck(tableSql(sql, 'item_state'), STATUS_CHECK)[0]!)).toEqual([
      'a',
      'b',
      'd',
    ])
    expect(stringLiterals(lastCheck(tableSql(sql, 'plan_block_state'), STATUS_CHECK)[0]!)).toEqual([
      'c',
    ])
    expect(() => tableSql(sql, 'daily_activity')).toThrow(/daily_activity/)
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
