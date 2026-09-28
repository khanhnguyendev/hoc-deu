/**
 * Server environment parsing (platform design §2.3, §2.5). Deliberately **not** `server-only`
 * (decision 11): the proxy and `instrumentation.ts` import it, and the `server-only` package
 * throws outside the `react-server` condition. Secrets stay safe because only `NEXT_PUBLIC_*`
 * values are ever inlined into client bundles.
 */
import { z } from 'zod'

export type VercelEnv = 'production' | 'preview' | 'development'

export type ServerEnv = {
  supabaseUrl: string
  supabasePublishableKey: string
  supabaseSecretKey: string
  siteUrl: string
  adminEmails: readonly string[]
  authTestLogin: boolean
  vercelEnv: VercelEnv | undefined
  /**
   * `CRON_SECRET` (task 5.7a, ADR-0034): the maintenance cron's bearer secret, at least 32
   * characters. Required in production; elsewhere optional (unset or empty), and the cron route
   * then answers 401 to everyone.
   */
  cronSecret: string | undefined
  /**
   * `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` (§2.3, §2.5; task 6.1, decision 22):
   * optional — both or neither. Without them every rate limiter runs in memory, per instance.
   */
  upstash: { readonly url: string; readonly token: string } | undefined
}

/** Message lists variable NAMES only, never values — never printed or logged with a value. */
export class EnvError extends Error {}

const VERCEL_ENVS = ['production', 'preview', 'development'] as const satisfies readonly VercelEnv[]

const RawEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  SUPABASE_SECRET_KEY: z.string().min(1),
  NEXT_PUBLIC_SITE_URL: z.url().optional(),
  ADMIN_EMAILS: z.string().optional(),
  AUTH_TEST_LOGIN: z.enum(['true', 'false']).optional(),
  VERCEL_ENV: z.enum(VERCEL_ENVS).optional(),
  VERCEL_BRANCH_URL: z.string().optional(),
  // Empty means unset: `.env.example` ships the line as `CRON_SECRET=`.
  CRON_SECRET: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.string().min(32).optional(),
  ),
  // Empty means unset: `.env.example` ships both lines empty (decision 22). https only: `new
  // Redis({ url })` (lib/rate-limit.ts) throws for any other protocol, so this must be caught
  // here rather than at limiter construction (fix round 1, item 1).
  UPSTASH_REDIS_REST_URL: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.url({ protocol: /^https$/ }).optional(),
  ),
  UPSTASH_REDIS_REST_TOKEN: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.string().min(1).optional(),
  ),
})

function parseAdminEmails(value: string | undefined): readonly string[] {
  if (!value) return []
  return value
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter((email) => email.length > 0)
}

function invalidVariablesError(issues: readonly { path: PropertyKey[] }[]): EnvError {
  const names = [...new Set(issues.map((issue) => String(issue.path[0] ?? '')))]
  return new EnvError(`Invalid environment variables: ${names.join(', ')}`)
}

/** Parses and validates a raw environment source (e.g. `process.env`) into a {@link ServerEnv}. */
export function parseServerEnv(source: Record<string, string | undefined>): ServerEnv {
  const parsed = RawEnvSchema.safeParse(source)
  if (!parsed.success) throw invalidVariablesError(parsed.error.issues)
  const raw = parsed.data

  const vercelEnv = raw.VERCEL_ENV
  const authTestLogin = raw.AUTH_TEST_LOGIN === 'true'
  if (authTestLogin && vercelEnv === 'production') {
    throw new EnvError('AUTH_TEST_LOGIN must not be enabled in production')
  }

  let siteUrl: string
  if (vercelEnv === 'preview' && raw.VERCEL_BRANCH_URL) {
    siteUrl = `https://${raw.VERCEL_BRANCH_URL}`
  } else if (raw.NEXT_PUBLIC_SITE_URL) {
    siteUrl = raw.NEXT_PUBLIC_SITE_URL
  } else {
    throw new EnvError('Invalid environment variables: NEXT_PUBLIC_SITE_URL')
  }
  siteUrl = siteUrl.replace(/\/+$/, '')

  // Production must be able to run its maintenance cron (§2.3, §2.5); a missing secret would make
  // the route answer 401 to Vercel every day, silently.
  if (vercelEnv === 'production' && raw.CRON_SECRET === undefined) {
    throw new EnvError('Invalid environment variables: CRON_SECRET')
  }

  // Both or neither (decision 22): one alone is almost certainly a typo'd deploy, and a rate
  // limiter half-configured with only a URL or only a token would throw on every request.
  if ((raw.UPSTASH_REDIS_REST_URL === undefined) !== (raw.UPSTASH_REDIS_REST_TOKEN === undefined)) {
    throw new EnvError(
      'Invalid environment variables: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN',
    )
  }
  const upstash =
    raw.UPSTASH_REDIS_REST_URL !== undefined && raw.UPSTASH_REDIS_REST_TOKEN !== undefined
      ? { url: raw.UPSTASH_REDIS_REST_URL, token: raw.UPSTASH_REDIS_REST_TOKEN }
      : undefined

  return {
    supabaseUrl: raw.NEXT_PUBLIC_SUPABASE_URL,
    supabasePublishableKey: raw.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    supabaseSecretKey: raw.SUPABASE_SECRET_KEY,
    siteUrl,
    adminEmails: parseAdminEmails(raw.ADMIN_EMAILS),
    authTestLogin,
    vercelEnv,
    cronSecret: raw.CRON_SECRET,
    upstash,
  }
}

let cached: ServerEnv | undefined

/** Memoised `parseServerEnv(process.env)`. */
export function serverEnv(): ServerEnv {
  if (!cached) cached = parseServerEnv(process.env)
  return cached
}

/**
 * Only the two public Supabase values (the proxy and the session client need nothing else).
 * Reads `process.env.NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` by their
 * literal names, so Next.js can inline them into client bundles.
 */
export function publicSupabaseEnv(): { supabaseUrl: string; supabasePublishableKey: string } {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!supabaseUrl) throw new EnvError('Invalid environment variables: NEXT_PUBLIC_SUPABASE_URL')
  if (!supabasePublishableKey) {
    throw new EnvError('Invalid environment variables: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY')
  }
  return { supabaseUrl, supabasePublishableKey }
}
