/**
 * An in-memory stand-in for the secret-key Supabase client in `lib/bot` unit tests: the subset of
 * PostgREST's query builder the bot service uses (select / insert / update with filters, order,
 * limit, delete, `single` / `maybeSingle`, `count: 'exact', head: true`) over plain arrays of rows, unique
 * keys that fail with `23505`, and `rpc` handlers the test supplies. Rows are copied in and out,
 * so a test sees only what the code wrote. Not a test file itself (no `.test.`): tests import it.
 */
import { randomUUID } from 'node:crypto'

export type Row = Record<string, unknown>
type DbError = { code: string; message: string }
type Result = { data: unknown; error: DbError | null; count?: number | null }
type Filter = (row: Row) => boolean
type RpcHandler = (args: Record<string, unknown>, db: FakeDb) => unknown

export type FakeDbOptions = {
  /** Column defaults per table, applied on insert (a function is called per row). */
  defaults?: Record<string, Record<string, unknown | (() => unknown)>>
  /** Unique column sets per table; a duplicate insert fails with 23505. */
  unique?: Record<string, string[][]>
  rpc?: Record<string, RpcHandler>
  /** Called before each insert is checked: a test can simulate a concurrent writer here. */
  onInsert?: (table: string, rows: readonly Row[], db: FakeDb) => void
}

export type FakeDb = {
  tables: Record<string, Row[]>
  /** Every call, in order: `from:<table>:<op>` or `rpc:<name>`. */
  calls: string[]
  rpc: Record<string, RpcHandler>
  client: unknown
}

const copy = <T>(value: T): T => structuredClone(value)

/** A raised SQL exception as PostgREST reports it (`raise exception '<code>'` → message). */
export class RaisedError extends Error {
  constructor(
    message: string,
    readonly code = 'P0001',
  ) {
    super(message)
  }
}

function compare(a: unknown, b: unknown): number {
  if (a === b) return 0
  if (a === null || a === undefined) return 1
  if (b === null || b === undefined) return -1
  return (a as string | number) < (b as string | number) ? -1 : 1
}

class Query implements PromiseLike<Result> {
  private filters: Filter[] = []
  private orders: { column: string; ascending: boolean; nullsFirst: boolean }[] = []
  private max: number | null = null
  private mode: 'many' | 'single' | 'maybe' = 'many'
  private returning = false
  private head = false
  private op: 'select' | 'insert' | 'update' | 'delete' = 'select'
  private payload: Row[] | Row = []

  constructor(
    private readonly db: FakeDb,
    private readonly options: FakeDbOptions,
    private readonly table: string,
  ) {}

  select(_columns?: string, options?: { count?: 'exact'; head?: boolean }): this {
    if (this.op === 'select') this.head = options?.head === true
    else this.returning = true
    return this
  }
  insert(rows: Row | Row[]): this {
    this.op = 'insert'
    this.payload = Array.isArray(rows) ? rows : [rows]
    return this
  }
  update(patch: Row): this {
    this.op = 'update'
    this.payload = patch
    return this
  }
  delete(): this {
    this.op = 'delete'
    return this
  }
  eq(column: string, value: unknown): this {
    this.filters.push((row) => row[column] === value)
    return this
  }
  neq(column: string, value: unknown): this {
    this.filters.push((row) => row[column] !== value)
    return this
  }
  in(column: string, values: readonly unknown[]): this {
    this.filters.push((row) => values.includes(row[column]))
    return this
  }
  is(column: string, value: null): this {
    this.filters.push((row) => (row[column] ?? null) === value)
    return this
  }
  not(column: string, operator: 'is', value: null): this {
    if (operator !== 'is') throw new Error(`fake-db: not(${operator}) is not supported`)
    this.filters.push((row) => (row[column] ?? null) !== value)
    return this
  }
  lt(column: string, value: unknown): this {
    this.filters.push((row) => compare(row[column], value) < 0)
    return this
  }
  lte(column: string, value: unknown): this {
    this.filters.push((row) => compare(row[column], value) <= 0)
    return this
  }
  gte(column: string, value: unknown): this {
    this.filters.push((row) => compare(row[column], value) >= 0)
    return this
  }
  order(column: string, options: { ascending?: boolean; nullsFirst?: boolean } = {}): this {
    const ascending = options.ascending ?? true
    this.orders.push({ column, ascending, nullsFirst: options.nullsFirst ?? !ascending })
    return this
  }
  limit(count: number): this {
    this.max = count
    return this
  }
  single(): this {
    this.mode = 'single'
    return this
  }
  maybeSingle(): this {
    this.mode = 'maybe'
    return this
  }

  then<A = Result, B = never>(
    resolve?: ((value: Result) => A | PromiseLike<A>) | null,
    reject?: ((reason: unknown) => B | PromiseLike<B>) | null,
  ): PromiseLike<A | B> {
    return Promise.resolve()
      .then(() => this.run())
      .then(resolve, reject)
  }

  private rows(): Row[] {
    return (this.db.tables[this.table] ??= [])
  }

  private matching(): Row[] {
    return this.rows().filter((row) => this.filters.every((filter) => filter(row)))
  }

  private run(): Result {
    this.db.calls.push(`from:${this.table}:${this.op}`)
    let rows: Row[]
    if (this.op === 'insert') {
      const inserted = this.insertRows(this.payload as Row[])
      if ('error' in inserted) return { data: null, error: inserted.error }
      rows = inserted.rows
      if (!this.returning) return { data: null, error: null }
    } else if (this.op === 'update') {
      rows = this.matching()
      for (const row of rows) Object.assign(row, copy(this.payload as Row))
      if (!this.returning) return { data: null, error: null }
    } else if (this.op === 'delete') {
      const doomed = new Set(this.matching())
      this.db.tables[this.table] = this.rows().filter((row) => !doomed.has(row))
      return { data: null, error: null }
    } else {
      rows = this.sorted(this.matching())
      if (this.head) return { data: null, error: null, count: rows.length }
    }
    if (this.max !== null) rows = rows.slice(0, this.max)
    const data = rows.map(copy)
    if (this.mode === 'many') return { data, error: null }
    if (data.length > 1 || (this.mode === 'single' && data.length === 0)) {
      return { data: null, error: { code: 'PGRST116', message: `${data.length} rows` } }
    }
    return { data: data[0] ?? null, error: null }
  }

  private sorted(rows: Row[]): Row[] {
    return rows.toSorted((a, b) => {
      for (const { column, ascending, nullsFirst } of this.orders) {
        const x = a[column] ?? null
        const y = b[column] ?? null
        if (x === y) continue
        if (x === null) return nullsFirst ? -1 : 1
        if (y === null) return nullsFirst ? 1 : -1
        const order = compare(x, y)
        return ascending ? order : -order
      }
      return 0
    })
  }

  private insertRows(payload: Row[]): { rows: Row[] } | { error: DbError } {
    this.options.onInsert?.(this.table, payload, this.db)
    const defaults = this.options.defaults?.[this.table] ?? {}
    const unique = this.options.unique?.[this.table] ?? []
    const rows = payload.map((input) => {
      const row: Row = { id: randomUUID() }
      for (const [column, value] of Object.entries(defaults)) {
        row[column] = typeof value === 'function' ? (value as () => unknown)() : copy(value)
      }
      return Object.assign(row, copy(input))
    })
    const all = [...this.rows()]
    for (const row of rows) {
      for (const columns of unique) {
        if (all.some((other) => columns.every((column) => other[column] === row[column]))) {
          return {
            error: { code: '23505', message: `duplicate key value violates unique constraint` },
          }
        }
      }
      all.push(row)
    }
    this.rows().push(...rows)
    return { rows }
  }
}

export function fakeDb(tables: Record<string, Row[]> = {}, options: FakeDbOptions = {}): FakeDb {
  const db: FakeDb = {
    tables: copy(tables),
    calls: [],
    rpc: { ...options.rpc },
    client: undefined,
  }
  db.client = {
    from: (table: string) => new Query(db, options, table),
    rpc: async (name: string, args: Record<string, unknown> = {}): Promise<Result> => {
      db.calls.push(`rpc:${name}`)
      const handler = db.rpc[name]
      if (handler === undefined) throw new Error(`fake-db: no rpc handler for ${name}`)
      try {
        return { data: copy(await handler(args, db)), error: null }
      } catch (error) {
        if (error instanceof RaisedError) {
          return { data: null, error: { code: error.code, message: error.message } }
        }
        throw error
      }
    },
  }
  return db
}
