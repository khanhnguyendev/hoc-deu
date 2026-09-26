/**
 * The auth allow-list (task 5.7c, ADR-0029) is written once, in auth-columns.ts; the SQL that has
 * to repeat it — the migration's two functions and the pgTAP test — is static, so this file fails
 * whenever one of them differs from it.
 */
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  AUTH_COLUMNS,
  AUTH_FUNCTIONS,
  NEVER_COLUMN,
  NORMALISED_COLUMNS,
  columnNames,
  functionResult,
} from './auth-columns'
import { AUTH_TABLES } from './counts'

const ROOT = resolve(import.meta.dirname, '..', '..')
const read = (path: string): string => readFileSync(join(ROOT, path), 'utf8')

const MIGRATION = 'supabase/migrations/20260927000400_backup_auth.sql'
const PGTAP = 'supabase/tests/database/081-backup-auth.test.sql'

/** SQL without `--` comments, whitespace collapsed to single spaces. */
const squash = (sql: string): string =>
  sql
    .replace(/--[^\n]*/g, '')
    .replace(/\s+/g, ' ')
    .trim()

/** The lines of a psql script that are not blank and not `--` comments, trimmed. */
/** The table alias each function's body reads its auth table through. */
const ALIAS = { 'auth.users': 'u', 'auth.identities': 'i' } as const

describe('the allow-list (auth-columns.ts)', () => {
  it('covers exactly the two auth tables a backup holds', () => {
    expect(Object.keys(AUTH_COLUMNS).sort()).toEqual([...AUTH_TABLES])
    expect(AUTH_FUNCTIONS).toEqual({
      'auth.users': 'backup.auth_users',
      'auth.identities': 'backup.auth_identities',
    })
  })

  it('lists what GoTrue needs to load an account, and nothing else', () => {
    expect(columnNames('auth.users')).toEqual([
      'id',
      'aud',
      'role',
      'email',
      'email_confirmed_at',
      'raw_app_meta_data',
      'raw_user_meta_data',
      'created_at',
      'updated_at',
      'last_sign_in_at',
      'is_anonymous',
      'instance_id',
    ])
    // identities.email is GENERATED ALWAYS from identity_data: a restore cannot load it and gets
    // it back anyway.
    expect(columnNames('auth.identities')).toEqual([
      'id',
      'user_id',
      'provider',
      'provider_id',
      'identity_data',
      'created_at',
      'updated_at',
      'last_sign_in_at',
    ])
  })

  it('never lists a column that holds a password, a token or a pending change', () => {
    for (const table of AUTH_TABLES) {
      for (const name of columnNames(table)) expect(name, table).not.toMatch(NEVER_COLUMN)
    }
  })

  it.each([
    'encrypted_password',
    'confirmation_token',
    'confirmation_sent_at',
    'recovery_token',
    'recovery_sent_at',
    'email_change',
    'email_change_token_new',
    'email_change_token_current',
    'email_change_sent_at',
    'email_change_confirm_status',
    'phone_change',
    'phone_change_token',
    'phone_change_sent_at',
    'reauthentication_token',
    'reauthentication_sent_at',
    'some_future_token',
  ])('the never-list catches %s', (name) => {
    expect(name).toMatch(NEVER_COLUMN)
  })

  it('prints each function’s result the way pg_get_function_result does', () => {
    expect(functionResult('auth.identities')).toBe(
      'TABLE(id uuid, user_id uuid, provider text, provider_id text, identity_data jsonb, ' +
        'created_at timestamp with time zone, updated_at timestamp with time zone, ' +
        'last_sign_in_at timestamp with time zone)',
    )
  })

  it('normalises only never-list columns of auth.users, none of them in the backup', () => {
    expect(NORMALISED_COLUMNS.length).toBeGreaterThan(0)
    for (const name of NORMALISED_COLUMNS) {
      expect(name).toMatch(NEVER_COLUMN)
      expect(columnNames('auth.users')).not.toContain(name)
    }
  })
})

describe(`the migration (${MIGRATION})`, () => {
  const sql = squash(read(MIGRATION))

  it('creates schema backup, closed to everyone but backup_reader', () => {
    expect(sql).toContain('create schema backup;')
    expect(sql).toContain('revoke all on schema backup from public;')
    expect(sql).toContain('grant usage on schema backup to backup_reader;')
    const grants = sql.match(/\bgrant [^;]*;/g) ?? []
    expect(grants.every((grant) => grant.endsWith(' to backup_reader;'))).toBe(true)
  })

  it('never selects *, and never declares a SQL-standard (begin atomic) body', () => {
    expect(sql).not.toMatch(/select \*|\.\*/)
    expect(sql).not.toMatch(/begin atomic/i)
  })

  describe.each(AUTH_TABLES)('%s', (table) => {
    const fn = AUTH_FUNCTIONS[table]
    const alias = ALIAS[table]
    const shape = new RegExp(
      `create function ${fn.replace('.', '\\.')}\\(\\) returns table \\((.*?)\\) language plpgsql ` +
        `stable security definer set search_path = '' set row_security = off as \\$\\$ begin ` +
        `return query select (.*?) from ${table.replace('.', '\\.')} as ${alias}; end \\$\\$;`,
    )
    const match = shape.exec(sql)

    it(`declares ${fn}() as a stable plpgsql security definer with search_path and row security set`, () => {
      expect(match).not.toBeNull()
    })

    it('returns exactly the allow-list, name and type, in order', () => {
      const declared = (match?.[1] ?? '')
        .trim()
        .split(', ')
        .map((column) => {
          const [name = '', ...type] = column.split(' ')
          return [name, type.join(' ')]
        })
      expect(declared).toEqual(AUTH_COLUMNS[table].map(([name, type]) => [name, type]))
    })

    it(`selects those columns from ${table}, each cast to its declared type`, () => {
      expect(match?.[2]).toBe(
        AUTH_COLUMNS[table].map(([name, type]) => `${alias}.${name}::${type}`).join(', '),
      )
    })

    it('revokes EXECUTE from public, anon, authenticated and service_role; grants it to backup_reader', () => {
      expect(sql).toContain(
        `revoke all on function ${fn}() from public, anon, authenticated, service_role;`,
      )
      expect(sql).toContain(`grant execute on function ${fn}() to backup_reader;`)
    })
  })
})

describe(`pgTAP (${PGTAP})`, () => {
  const pgtap = read(PGTAP)

  it.each(AUTH_TABLES)('pins %s’s function result to the allow-list', (table) => {
    expect(pgtap).toContain(`'${functionResult(table)}'`)
  })
})

describe('supabase/config.toml', () => {
  it('does not expose schema backup (or auth) through the Data API', () => {
    const config = read('supabase/config.toml')
    const api = /^\[api\]\n([\s\S]*?)^\[/m.exec(config)?.[1] ?? ''
    const schemas = /^schemas = (\[[^\]]*\])$/m.exec(api)?.[1]
    expect(schemas).toBeDefined()
    const list = JSON.parse(schemas as string) as string[]
    expect(list).toContain('public')
    expect(list).not.toContain('backup')
    expect(list).not.toContain('auth')
  })
})
