import 'server-only'
import { createServerClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { publicSupabaseEnv } from '@/lib/env'
import type { Database } from './database.types'

/**
 * Per-request client with the user's session cookies and the publishable key: RLS applies
 * (§2.1). Create one per request — never share it across requests.
 */
export async function createClient(): Promise<SupabaseClient<Database>> {
  const cookieStore = await cookies()
  const { supabaseUrl, supabasePublishableKey } = publicSupabaseEnv()
  return createServerClient<Database>(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        for (const { name, value, options } of cookiesToSet) {
          try {
            cookieStore.set(name, value, options)
          } catch {
            // Server Components cannot set cookies; proxy.ts refreshes the session instead.
          }
        }
      },
    },
  })
}
