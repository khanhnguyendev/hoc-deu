/**
 * The auth columns a backup holds (task 5.7c, ADR-0029) — the allow-list, written once. The
 * backup never reads `auth.users` or `auth.identities` itself: `backup_reader` calls
 * `backup.auth_users()` and `backup.auth_identities()` (migration
 * `20260927000400_backup_auth.sql`), SECURITY DEFINER functions that return exactly these columns,
 * typed as the local stack's GoTrue (the Supabase CLI pinned in package.json) declares them.
 *
 * The SQL that repeats the lists is static — the dump step runs no Node code — so
 * auth-columns.test.ts fails whenever one of them differs from this file: the migration's
 * `returns table` lists and bodies, `auth-dump.sql` (the backup writes `COPY auth.<table> (<these
 * columns>) FROM stdin;` blocks with it, and the restore loads those columns only),
 * `normalise-auth.sql` and the pgTAP test `081-backup-auth.test.sql`.
 *
 * Changing a list means a new migration (`drop function` + `create function`: a function's result
 * type cannot be replaced in place), this file, the SQL above and ADR-0029's reason for the column.
 */
import type { AUTH_TABLES } from './counts'

export type AuthTable = (typeof AUTH_TABLES)[number]

/** `[name, type]`, the type spelled as `pg_get_function_result` prints it. */
export type AuthColumn = readonly [name: string, type: string]

export const AUTH_COLUMNS: Readonly<Record<AuthTable, readonly AuthColumn[]>> = {
  'auth.users': [
    ['id', 'uuid'],
    ['aud', 'character varying'],
    ['role', 'character varying'],
    ['email', 'character varying'],
    ['email_confirmed_at', 'timestamp with time zone'],
    ['raw_app_meta_data', 'jsonb'],
    ['raw_user_meta_data', 'jsonb'],
    ['created_at', 'timestamp with time zone'],
    ['updated_at', 'timestamp with time zone'],
    ['last_sign_in_at', 'timestamp with time zone'],
    ['is_anonymous', 'boolean'],
    // Beyond the brief's list, proven by the local round trip (task 5.7c): GoTrue looks every
    // user up by the nil instance id, so a user restored with a null instance_id is "not found".
    ['instance_id', 'uuid'],
  ],
  // `email` is GENERATED ALWAYS from identity_data: a restore cannot load it and gets it back.
  'auth.identities': [
    ['id', 'uuid'],
    ['user_id', 'uuid'],
    ['provider', 'text'],
    ['provider_id', 'text'],
    ['identity_data', 'jsonb'],
    ['created_at', 'timestamp with time zone'],
    ['updated_at', 'timestamp with time zone'],
    ['last_sign_in_at', 'timestamp with time zone'],
  ],
}

/** The function that returns each table's allow-listed columns to backup_reader. */
export const AUTH_FUNCTIONS: Readonly<Record<AuthTable, string>> = {
  'auth.users': 'backup.auth_users',
  'auth.identities': 'backup.auth_identities',
}

/**
 * The never-list: columns that hold a password, a one-time token or a pending change — a
 * backup never holds them, whatever a later GoTrue adds under these names.
 */
export const NEVER_COLUMN =
  /^(?:encrypted_password$|confirmation_|recovery_|email_change|phone_change|reauthentication_)|_token/

/**
 * The `auth.users` columns GoTrue reads as non-null strings — the local round trip (task 5.7c) set
 * each one null in turn, and GoTrue then failed to load the user (HTTP 500). A backup never holds
 * them, so a restore leaves them null (the first four have no default) or `''` (their default,
 * the last four); `normalise-auth.sql` sets every one that is null to `''` — never an old value,
 * and never relying on a default GoTrue may drop.
 */
export const NORMALISED_COLUMNS: readonly string[] = [
  'confirmation_token',
  'recovery_token',
  'email_change_token_new',
  'email_change',
  'email_change_token_current',
  'phone_change',
  'phone_change_token',
  'reauthentication_token',
]

/** SQL keyword types: they always mean pg_catalog's type, whatever the search path. */
const KEYWORD_TYPES = new Set(['character varying', 'timestamp with time zone', 'boolean'])

/**
 * The type a column is cast to in the function bodies. With `search_path = ''` PostgreSQL still
 * looks type names up in the caller's `pg_temp` first, so a name-resolved type (uuid, jsonb,
 * text) is qualified with pg_catalog; keyword types need no qualifier.
 */
export function castType(type: string): string {
  return KEYWORD_TYPES.has(type) ? type : `pg_catalog.${type}`
}

export function columnNames(table: AuthTable): string[] {
  return AUTH_COLUMNS[table].map(([name]) => name)
}

/** The function's result as `pg_get_function_result` prints it: `TABLE(id uuid, …)`. */
export function functionResult(table: AuthTable): string {
  return `TABLE(${AUTH_COLUMNS[table].map(([name, type]) => `${name} ${type}`).join(', ')})`
}
