import { defineConfig, devices } from '@playwright/test'
import { localSupabaseEnv } from './tools/db/local-env'

const PORT = 3100

/**
 * The bot API is on for e2e (task 6.3): the env lock open, so the specs exercise the row lock and
 * the token (6.8). A fixed, obviously fake 43-character HMAC key for the per-run user refs.
 */
const E2E_BOT_REF_SECRET = 'e2e-bot-ref-secret-0123456789abcdefghijklmn'

// Workers inherit process.env from the runner, so `supabase status` runs once.
if (!process.env.E2E_STACK_READY) {
  Object.assign(process.env, {
    ...localSupabaseEnv(),
    NEXT_PUBLIC_SITE_URL: `http://localhost:${PORT}`,
    AUTH_TEST_LOGIN: 'true',
    // One listed address per bootstrap scenario, so the scenarios never race (2.7a).
    ADMIN_EMAILS:
      'bootstrap-admin@example.test,bootstrap-rejected@example.test,bootstrap-demoted@example.test',
    E2E_STACK_READY: '1',
  })
}

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: `http://localhost:${PORT}`, trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: `pnpm build && pnpm start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL!,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY!,
      NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL!,
      AUTH_TEST_LOGIN: process.env.AUTH_TEST_LOGIN!,
      ADMIN_EMAILS: process.env.ADMIN_EMAILS!,
      BOT_API_ENABLED: 'true',
      BOT_REF_SECRET: E2E_BOT_REF_SECRET,
    },
  },
})
