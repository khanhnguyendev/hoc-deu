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
  cronSecret: string | undefined
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
  CRON_SECRET: z.string().min(32).optional(),
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

  return {
    supabaseUrl: raw.NEXT_PUBLIC_SUPABASE_URL,
    supabasePublishableKey: raw.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    supabaseSecretKey: raw.SUPABASE_SECRET_KEY,
    siteUrl,
    adminEmails: parseAdminEmails(raw.ADMIN_EMAILS),
    authTestLogin,
    vercelEnv,
    cronSecret: raw.CRON_SECRET,
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
