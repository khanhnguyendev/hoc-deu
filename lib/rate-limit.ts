/**
 * Rate limits (platform design §2.3, §2.5; Part B-M6 decision 22). Upstash's sliding window when
 * `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` are configured (both or neither,
 * `lib/env.ts`); otherwise, and on any Upstash error or timeout, an in-memory sliding window
 * decides instead (fail open — the limits protect against runaway retries, never against a
 * determined attacker, so a false "allow" is always the safer failure). `checkLimit` never
 * throws.
 */
import 'server-only'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { serverEnv } from '@/lib/env'
import { createAdminClient } from '@/lib/supabase/admin'

export type LimitName = 'botApi' | 'oauthCallback' | 'accountDeletion' | 'adminAction'

type LimitWindow = '10 m' | '1 d' | '1 m'

/** §2.3: bot API 120 / 10 min per token; OAuth callback 20 / 10 min per IP; account deletion 3 /
 *  day per user; admin actions 60 / min per admin. */
export const LIMITS: Readonly<
  Record<LimitName, { readonly tokens: number; readonly window: LimitWindow }>
> = {
  botApi: { tokens: 120, window: '10 m' },
  oauthCallback: { tokens: 20, window: '10 m' },
  accountDeletion: { tokens: 3, window: '1 d' },
  adminAction: { tokens: 60, window: '1 m' },
}

const WINDOW_MS: Readonly<Record<LimitWindow, number>> = {
  '10 m': 10 * 60_000,
  '1 d': 24 * 60 * 60_000,
  '1 m': 60_000,
}

export type LimitResult = {
  readonly ok: boolean
  readonly retryAfterSeconds: number
  readonly source: 'upstash' | 'memory' | 'fail-open'
}

/** The subset of `@upstash/ratelimit`'s `Ratelimit` used here; a test may inject a fake. */
export type Limiter = {
  limit(identifier: string): Promise<{ success: boolean; reset: number; reason?: string }>
}

/** The identifier's request times, pruned to the window; bounded to 10 000 identifiers total. */
const MAX_IDENTIFIERS = 10_000
const memoryWindows = new Map<LimitName, Map<string, number[]>>()

/**
 * The in-memory decision for `name`/`identifier` at `nowMs`: allows the request and records it
 * while under `tokens` for the window, otherwise refuses without recording it again. Oldest
 * identifier evicted (insertion order) once a limit's map would exceed `MAX_IDENTIFIERS`.
 */
function memoryDecision(
  name: LimitName,
  identifier: string,
  nowMs: number,
): { ok: boolean; retryAfterSeconds: number } {
  let store = memoryWindows.get(name)
  if (!store) {
    store = new Map()
    memoryWindows.set(name, store)
  }
  const { tokens, window } = LIMITS[name]
  const windowMs = WINDOW_MS[window]
  const cutoff = nowMs - windowMs
  const pruned = (store.get(identifier) ?? []).filter((time) => time > cutoff)

  if (pruned.length >= tokens) {
    store.set(identifier, pruned)
    const retryAfterSeconds = Math.max(0, Math.ceil((pruned[0]! + windowMs - nowMs) / 1000))
    return { ok: false, retryAfterSeconds }
  }

  if (!store.has(identifier) && store.size >= MAX_IDENTIFIERS) {
    const oldest = store.keys().next().value
    if (oldest !== undefined) store.delete(oldest)
  }
  pruned.push(nowMs)
  store.set(identifier, pruned)
  return { ok: true, retryAfterSeconds: 0 }
}

/** `serverEnv().upstash`, or `undefined` on any error (`checkLimit` never throws). */
function upstashConfig(): { url: string; token: string } | undefined {
  try {
    return serverEnv().upstash
  } catch {
    return undefined
  }
}

let redisClient: Redis | undefined
const upstashLimiters = new Map<LimitName, Limiter>()

/** One `Ratelimit` per limit name, created once per instance (module scope), or `undefined`
 *  while Upstash is not configured. */
function upstashLimiterFor(name: LimitName): Limiter | undefined {
  const config = upstashConfig()
  if (!config) return undefined
  redisClient ??= new Redis({ url: config.url, token: config.token })
  let limiter = upstashLimiters.get(name)
  if (!limiter) {
    const { tokens, window } = LIMITS[name]
    limiter = new Ratelimit({
      redis: redisClient,
      limiter: Ratelimit.slidingWindow(tokens, window),
      analytics: false,
      timeout: 1000,
      prefix: `hoc-deu:${name}`,
    })
    upstashLimiters.set(name, limiter)
  }
  return limiter
}

/** Best effort, never awaited by the caller and never throws: `ops_bump_metric('ratelimit.fail_open')`
 *  (20260928000100_bot_and_ai_tables.sql), read on `/admin` (§8.4 item 5). */
function bumpFailOpenMetric(): void {
  try {
    createAdminClient()
      .rpc('ops_bump_metric', { p_key: 'ratelimit.fail_open' })
      .then(
        () => {},
        () => {},
      )
  } catch {
    // Best effort: never lets a broken admin client turn fail-open into a thrown error.
  }
}

/**
 * Never throws. Upstash when configured (1000 ms timeout); on an error or a timeout
 * (`reason: 'timeout'`) the in-memory window decides instead, and
 * `ops_bump_metric('ratelimit.fail_open')` is called without awaiting it or its failure.
 */
export async function checkLimit(
  name: LimitName,
  identifier: string,
  deps?: { readonly now?: () => number; readonly limiter?: Limiter },
): Promise<LimitResult> {
  const now = deps?.now ?? Date.now
  const limiter = deps?.limiter ?? upstashLimiterFor(name)

  if (!limiter) {
    return { ...memoryDecision(name, identifier, now()), source: 'memory' }
  }

  let response: { success: boolean; reset: number; reason?: string } | undefined
  try {
    response = await limiter.limit(identifier)
  } catch {
    response = undefined
  }

  if (response === undefined || response.reason === 'timeout') {
    bumpFailOpenMetric()
    return { ...memoryDecision(name, identifier, now()), source: 'fail-open' }
  }

  return {
    ok: response.success,
    retryAfterSeconds: Math.max(0, Math.ceil((response.reset - now()) / 1000)),
    source: 'upstash',
  }
}

/** First `x-forwarded-for` entry (Vercel sets it at the edge), else `x-real-ip`, else `'unknown'`. */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()
    if (first) return first
  }
  const real = headers.get('x-real-ip')?.trim()
  return real ? real : 'unknown'
}

/** Whether every limiter currently runs against Upstash or falls back to memory (`/admin`, §2.4). */
export function rateLimitMode(): 'upstash' | 'memory' {
  return upstashConfig() ? 'upstash' : 'memory'
}
