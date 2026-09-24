/**
 * Reads the local Supabase stack's connection details from `supabase status -o env` (decision
 * 15): Playwright reads the local stack explicitly, so a developer's `.env.local` can never point
 * e2e at a remote project — process env wins over `.env*` files.
 */
import { execFileSync } from 'node:child_process'

export type LocalSupabaseEnv = {
  NEXT_PUBLIC_SUPABASE_URL: string
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: string
  SUPABASE_SECRET_KEY: string
}

/** Parses the `KEY="value"` lines `supabase status -o env` prints to stdout. */
export function parseStatusEnv(output: string): LocalSupabaseEnv {
  const values = new Map<string, string>()
  for (const line of output.split('\n')) {
    const match = /^([A-Z_]+)="([^"]*)"$/.exec(line.trim())
    if (match) values.set(match[1]!, match[2]!)
  }
  const requireValue = (statusKey: string): string => {
    const value = values.get(statusKey)
    if (!value) throw new Error(`Missing ${statusKey} in \`supabase status -o env\` output`)
    return value
  }
  return {
    NEXT_PUBLIC_SUPABASE_URL: requireValue('API_URL'),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: requireValue('PUBLISHABLE_KEY'),
    SUPABASE_SECRET_KEY: requireValue('SECRET_KEY'),
  }
}

/** Runs `supabase status -o env` against the local stack. */
export function localSupabaseEnv(): LocalSupabaseEnv {
  let output: string
  try {
    output = execFileSync('pnpm', ['exec', 'supabase', 'status', '-o', 'env'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
  } catch {
    throw new Error('Local Supabase is not running — run `pnpm db:start` first.')
  }
  return parseStatusEnv(output)
}
