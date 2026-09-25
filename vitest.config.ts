import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// Pin the test time zone to a non-UTC, half-hour-offset zone (task 2.3 / CLAUDE.md §7.2): a
// developer's or CI machine's local zone must never make a local-time bug in `lib/domain` pass by
// accident. Set before the test workers spawn so they inherit it.
process.env.TZ = 'America/St_Johns'

const exclude = ['node_modules/**', '.next/**', 'e2e/**']

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': import.meta.dirname,
      'server-only': new URL('tools/test/server-only.ts', import.meta.url).pathname,
    },
  },
  test: {
    projects: [
      // Pure TypeScript (guards, lib, tools) runs in Node; components (*.test.tsx) run in jsdom.
      {
        extends: true,
        test: { name: 'node', environment: 'node', include: ['**/*.test.ts'], exclude },
      },
      {
        extends: true,
        test: {
          name: 'dom',
          environment: 'jsdom',
          include: ['**/*.test.tsx'],
          exclude,
          setupFiles: ['tools/test/setup-dom.ts'],
        },
      },
    ],
  },
})
