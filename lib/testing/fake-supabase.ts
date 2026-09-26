/**
 * A small in-memory stand-in for `SupabaseClient<Database>` (Part B-M5 task 5.1a), for the
 * `lib/plans` and `lib/events` tests: tables are arrays of rows; `from(table).select(columns)`
 * with the filters, ordering and paging the loaders use, then `await`, `.maybeSingle()` or
 * `.single()`; `rpc(name, args)` is answered by a per-test handler (`onRpc`). Every query and rpc
 * is recorded (`calls`) with the label of the client that made it, so a test can assert the reads
 * a loader made and which client wrote.
 *
 * Like PostgREST with `max_rows = 1000` (`supabase/config.toml`), a request returns at most
 * `MAX_ROWS` rows — with or without `range`, so a loader that forgets to page fails its test.
 * Only what the tests use is here: any other method throws "not supported by the fake".
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'

type Tables = Database['public']['Tables']
export type TableName = keyof Tables
export type RowOf<T extends TableName> = Tables[T]['Row']
export type FakeRows = { [T in TableName]?: RowOf<T>[] }

/** PostgREST's `max_rows` (supabase/config.toml). */
export const MAX_ROWS = 1000

export type FakeFilter = {
  readonly op: 'eq' | 'neq' | 'lt' | 'lte' | 'gt' | 'gte' | 'in' | 'is' | 'not.is' | 'contains'
  readonly column: string
  readonly value: unknown
}

export type FakeSelect = {
  readonly kind: 'select'
  readonly client: string
  readonly table: string
  readonly columns: string
  readonly filters: readonly FakeFilter[]
  readonly order: readonly { readonly column: string; readonly ascending: boolean }[]
  readonly limit: number | null
  readonly range: readonly [number, number] | null
  readonly single: 'single' | 'maybeSingle' | null
}

export type FakeRpc = {
  readonly kind: 'rpc'
  readonly client: string
  readonly name: string
  readonly args: Record<string, unknown>
}

export type FakeCall = FakeSelect | FakeRpc

export type FakeError = { readonly message: string; readonly code?: string }
export type RpcAnswer = { readonly data: unknown; readonly error: FakeError | null }
export type RpcHandler = (args: Record<string, unknown>) => RpcAnswer | Promise<RpcAnswer>

export type FakeSupabase = {
  /** The rows by table; tests may change them between calls. */
  readonly tables: FakeRows
  /** Every query and rpc, in the order they ran. */
  readonly calls: FakeCall[]
  /** Answers `rpc(name, …)`; an rpc without a handler throws. */
  onRpc(name: string, handler: RpcHandler): void
  /** Every later select on `table` returns `{ data: null, error: { message } }`. */
  failSelect(table: TableName, message: string): void
  /** A client whose calls are recorded with `label` (e.g. `session`, `admin`). */
  client(label?: string): SupabaseClient<Database>
  selects(table?: TableName): FakeSelect[]
  rpcs(name?: string): FakeRpc[]
}

type Row = Record<string, unknown>

/** Property reads the runtime or a test printer may make; they answer `undefined`. */
const INTROSPECTION: ReadonlySet<string> = new Set([
  'then',
  'toJSON',
  'asymmetricMatch',
  '$$typeof',
  'nodeType',
  'constructor',
  '@@__IMMUTABLE_ITERABLE__@@',
  '@@__IMMUTABLE_RECORD__@@',
])

/** `target`, throwing "not supported by the fake" for any other property. */
function strict<T extends object>(target: T, what: string): T {
  return new Proxy(target, {
    get(object, property, receiver) {
      if (typeof property === 'symbol' || property in object) {
        return Reflect.get(object, property, receiver)
      }
      if (INTROSPECTION.has(property)) return undefined
      throw new Error(`${what}.${property} is not supported by the fake`)
    },
  })
}

/** Postgres `jsonb @>`: objects by key, arrays by "every element matches some element". */
function jsonContains(stored: unknown, wanted: unknown): boolean {
  if (Array.isArray(wanted)) {
    return (
      Array.isArray(stored) &&
      wanted.every((item) => stored.some((candidate) => jsonContains(candidate, item)))
    )
  }
  if (wanted !== null && typeof wanted === 'object') {
    if (stored === null || typeof stored !== 'object' || Array.isArray(stored)) return false
    return Object.entries(wanted).every(
      ([key, value]) => Object.hasOwn(stored, key) && jsonContains((stored as Row)[key], value),
    )
  }
  return Object.is(stored, wanted)
}

/** SQL comparison: null never compares. */
function compare(a: unknown, b: unknown): number | null {
  if (a === null || a === undefined || b === null || b === undefined) return null
  if (typeof a === 'number' && typeof b === 'number') return a - b
  if (typeof a === 'string' && typeof b === 'string') return a < b ? -1 : a > b ? 1 : 0
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b)
  throw new Error(`The fake cannot compare ${typeof a} with ${typeof b}`)
}

function matches(row: Row, filter: FakeFilter): boolean {
  const value = row[filter.column]
  /** `test` of the comparison, false when either side is null (SQL). */
  const ordered = (test: (result: number) => boolean) => {
    const result = compare(value, filter.value)
    return result !== null && test(result)
  }
  switch (filter.op) {
    case 'eq':
      return value !== null && value === filter.value
    case 'neq':
      return value !== null && value !== filter.value
    case 'lt':
      return ordered((result) => result < 0)
    case 'lte':
      return ordered((result) => result <= 0)
    case 'gt':
      return ordered((result) => result > 0)
    case 'gte':
      return ordered((result) => result >= 0)
    case 'in':
      return (filter.value as readonly unknown[]).includes(value)
    case 'is':
      return value === filter.value
    case 'not.is':
      return value !== filter.value
    case 'contains':
      return jsonContains(value, filter.value)
  }
}

/** ORDER BY: ascending puts nulls last, descending puts them first (Postgres defaults). */
function sortRows(rows: Row[], order: FakeSelect['order']): Row[] {
  return rows.toSorted((a, b) => {
    for (const { column, ascending } of order) {
      const left = a[column]
      const right = b[column]
      const leftNull = left === null || left === undefined
      const rightNull = right === null || right === undefined
      if (leftNull || rightNull) {
        if (leftNull && rightNull) continue
        return (leftNull ? 1 : -1) * (ascending ? 1 : -1)
      }
      const result = compare(left, right) ?? 0
      if (result !== 0) return ascending ? result : -result
    }
    return 0
  })
}

function project(row: Row, columns: string, table: string): Row {
  const names = columns.split(',').map((name) => name.trim())
  if (names.length === 1 && names[0] === '*') return structuredClone(row)
  const result: Row = {}
  for (const name of names) {
    if (!/^[a-z_][a-z0-9_]*$/.test(name)) {
      throw new Error(`The fake selects plain columns only, not "${name}"`)
    }
    if (!Object.hasOwn(row, name)) throw new Error(`Column ${table}.${name} does not exist`)
    result[name] = structuredClone(row[name])
  }
  return result
}

export function createFakeSupabase(rows: FakeRows = {}): FakeSupabase {
  const tables: FakeRows = structuredClone(rows)
  const calls: FakeCall[] = []
  const handlers = new Map<string, RpcHandler>()
  const failures = new Map<string, string>()
  const rowsOf = (table: string): Row[] => {
    const record = tables as Record<string, Row[] | undefined>
    return (record[table] ??= [])
  }

  function select(label: string, table: string, columns: string) {
    const state = {
      filters: [] as FakeFilter[],
      order: [] as { column: string; ascending: boolean }[],
      limit: null as number | null,
      range: null as [number, number] | null,
    }

    function run(
      single: FakeSelect['single'],
    ): Promise<{ data: unknown; error: FakeError | null }> {
      calls.push({
        kind: 'select',
        client: label,
        table,
        columns,
        filters: [...state.filters],
        order: [...state.order],
        limit: state.limit,
        range: state.range,
        single,
      })
      const failure = failures.get(table)
      if (failure !== undefined) {
        return Promise.resolve({ data: null, error: { message: failure } })
      }
      try {
        let result = sortRows(
          rowsOf(table).filter((row) => state.filters.every((filter) => matches(row, filter))),
          state.order,
        )
        if (state.range !== null) result = result.slice(state.range[0], state.range[1] + 1)
        if (state.limit !== null) result = result.slice(0, state.limit)
        result = result.slice(0, MAX_ROWS)
        const data = result.map((row) => project(row, columns, table))
        if (single === null) return Promise.resolve({ data, error: null })
        if (data.length > 1 || (single === 'single' && data.length === 0)) {
          return Promise.resolve({
            data: null,
            error: {
              message: 'JSON object requested, multiple (or no) rows returned',
              code: 'PGRST116',
            },
          })
        }
        return Promise.resolve({ data: data[0] ?? null, error: null })
      } catch (error) {
        return Promise.reject(error)
      }
    }

    const filter = (op: FakeFilter['op']) => (column: string, value: unknown) => {
      state.filters.push({ op, column, value })
      return builder
    }
    const builder = strict(
      {
        eq: filter('eq'),
        neq: filter('neq'),
        lt: filter('lt'),
        lte: filter('lte'),
        gt: filter('gt'),
        gte: filter('gte'),
        in: filter('in'),
        is: filter('is'),
        contains: filter('contains'),
        not(column: string, operator: string, value: unknown) {
          if (operator !== 'is' || value !== null) {
            throw new Error(`not(${column}, '${operator}', …) is not supported by the fake`)
          }
          state.filters.push({ op: 'not.is', column, value: null })
          return builder
        },
        order(column: string, options: { ascending?: boolean } = {}) {
          state.order.push({ column, ascending: options.ascending ?? true })
          return builder
        },
        limit(count: number) {
          state.limit = count
          return builder
        },
        range(from: number, to: number) {
          state.range = [from, to]
          return builder
        },
        maybeSingle: () => run('maybeSingle'),
        single: () => run('single'),
        then<A, B>(
          onFulfilled?: (value: { data: unknown; error: FakeError | null }) => A | PromiseLike<A>,
          onRejected?: (reason: unknown) => B | PromiseLike<B>,
        ) {
          return run(null).then(onFulfilled, onRejected)
        },
      },
      `from('${table}').select(…)`,
    )
    return builder
  }

  function client(label = 'client'): SupabaseClient<Database> {
    const fake = strict(
      {
        from: (table: string) =>
          strict({ select: (columns = '*') => select(label, table, columns) }, `from('${table}')`),
        rpc(name: string, args: Record<string, unknown> = {}) {
          calls.push({ kind: 'rpc', client: label, name, args: structuredClone(args) })
          const handler = handlers.get(name)
          if (handler === undefined) {
            throw new Error(`rpc ${name}: no handler (fake.onRpc) — not supported by the fake`)
          }
          return Promise.resolve(handler(structuredClone(args)))
        },
      },
      'client',
    )
    return fake as unknown as SupabaseClient<Database>
  }

  return {
    tables,
    calls,
    onRpc: (name, handler) => {
      handlers.set(name, handler)
    },
    failSelect: (table, message) => {
      failures.set(table, message)
    },
    client,
    selects: (table) =>
      calls.filter(
        (call): call is FakeSelect =>
          call.kind === 'select' && (table === undefined || call.table === table),
      ),
    rpcs: (name) =>
      calls.filter(
        (call): call is FakeRpc =>
          call.kind === 'rpc' && (name === undefined || call.name === name),
      ),
  }
}
