import { describe, expect, it } from 'vitest'
import { parseStatusEnv } from './local-env'

// A sample of `supabase status -o env` output (values are the local stack's public defaults).
const SAMPLE = `ANON_KEY="legacy-service-role-jwt-test-only"
API_URL="http://127.0.0.1:54321"
DB_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
GRAPHQL_URL="http://127.0.0.1:54321/graphql/v1"
JWT_SECRET="super-secret-jwt-token-with-at-least-32-characters-long"
PUBLISHABLE_KEY="sb_publishable_test-only-value"
REST_URL="http://127.0.0.1:54321/rest/v1"
SECRET_KEY="sb_secret_test-only-value"
SERVICE_ROLE_KEY="legacy-service-role-jwt-test-only"
`

describe('parseStatusEnv', () => {
  it('maps API_URL, PUBLISHABLE_KEY and SECRET_KEY to the three env var names', () => {
    expect(parseStatusEnv(SAMPLE)).toEqual({
      NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test-only-value',
      SUPABASE_SECRET_KEY: 'sb_secret_test-only-value',
    })
  })

  it('throws naming a missing key', () => {
    const withoutSecret = SAMPLE.split('\n')
      .filter((line) => !line.startsWith('SECRET_KEY='))
      .join('\n')
    expect(() => parseStatusEnv(withoutSecret)).toThrow(/SECRET_KEY/)
  })
})
