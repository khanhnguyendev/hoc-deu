/**
 * The restore test's last check (task 5.7c, ADR-0029): every restored account loads in the local
 * stack's auth server (GoTrue) under its own id. A GoTrue or Supabase CLI change that breaks
 * loading a restored user — a string column GoTrue reads as non-null left null, a column the
 * backup should hold — then fails the weekly test before a real restore needs it. It cannot prove
 * a Google or GitHub sign-in: that is the owner's re-link drill (docs/ops/backups.md §8).
 *
 * It asks GoTrue's admin API (`GET /auth/v1/admin/users/<id>`) with the local stack's secret key,
 * and only a loopback API: never a hosted project. The repository and its logs are public, so the
 * result is counts and kinds of failure only — never an id, and never anything GoTrue returned.
 */

export type LocalAuthApi = { url: string; key: string }

export type GoTrueCheck = {
  total: number
  loaded: number
  /** How many users each kind of failure hit: `HTTP <status>`, `another id`, `no answer`, … */
  problems: Record<string, number>
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

/** One lower-case UUID per line: `psql -A -t` output of `select id from auth.users order by id`. */
export function parseUserIds(text: string): string[] {
  if (text === '') return []
  const lines = (text.endsWith('\n') ? text.slice(0, -1) : text).split('\n')
  const seen = new Set<string>()
  lines.forEach((line, index) => {
    if (!UUID.test(line)) throw new Error(`user ids: line ${index + 1} is not a user id`)
    if (seen.has(line)) throw new Error(`user ids: line ${index + 1} lists a user twice`)
    seen.add(line)
  })
  return lines
}

/** The API's URL, when it is the local stack's: plain http on 127.0.0.1 or localhost. */
export function loopbackUrl(url: string): URL {
  let parsed: URL | null = null
  try {
    parsed = new URL(url)
  } catch {
    parsed = null
  }
  if (
    parsed === null ||
    parsed.protocol !== 'http:' ||
    !['127.0.0.1', 'localhost'].includes(parsed.hostname)
  ) {
    throw new Error('gotrue: the API is not the local stack’s (loopback http only)')
  }
  return parsed
}

/** Asks GoTrue for every user by id, one at a time. */
export async function checkUsersLoad(
  ids: readonly string[],
  api: LocalAuthApi,
  fetchImpl: typeof fetch = fetch,
): Promise<GoTrueCheck> {
  const base = loopbackUrl(api.url)
  const headers = { apikey: api.key, Authorization: `Bearer ${api.key}` }
  const problems: Record<string, number> = {}
  let loaded = 0
  for (const id of ids) {
    const problem = await askFor(new URL(`auth/v1/admin/users/${id}`, base), id, headers, fetchImpl)
    if (problem === null) loaded += 1
    else problems[problem] = (problems[problem] ?? 0) + 1
  }
  return { total: ids.length, loaded, problems }
}

/** null when GoTrue returns the user under `id`; else the kind of failure. */
async function askFor(
  url: URL,
  id: string,
  headers: Record<string, string>,
  fetchImpl: typeof fetch,
): Promise<string | null> {
  let response: Response
  try {
    response = await fetchImpl(url, { headers, signal: AbortSignal.timeout(15_000) })
  } catch {
    return 'no answer'
  }
  let body: unknown
  try {
    body = await response.json()
  } catch {
    body = undefined
  }
  if (!response.ok) return `HTTP ${response.status}`
  if (typeof body !== 'object' || body === null || !('id' in body)) return 'unreadable answer'
  return body.id === id ? null : 'another id'
}

/** `HTTP 500: 2, another id: 1` — each kind with how many users it hit, sorted by kind. */
export function describeProblems(problems: Readonly<Record<string, number>>): string {
  return Object.entries(problems)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([kind, count]) => `${kind}: ${count}`)
    .join(', ')
}
