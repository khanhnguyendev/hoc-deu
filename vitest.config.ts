import { compile } from '@mdx-js/mdx'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import { remarkPlugins } from './tools/content/mdx/plugins.ts'

// Pin the test time zone to a non-UTC, half-hour-offset zone (task 2.3 / CLAUDE.md §7.2): a
// developer's or CI machine's local zone must never make a local-time bug in `lib/domain` pass by
// accident. Set before the test workers spawn so they inherit it.
process.env.TZ = 'America/St_Johns'

const exclude = ['node_modules/**', '.next/**', 'e2e/**']

export default defineConfig({
  plugins: [
    react(),
    // Content MDX compiled as `@next/mdx` compiles it (the shared remark plugins), so a test can
    // load the generated MDX import map for real (tools/content/runtime-maps.test.ts, review M5).
    {
      name: 'content-mdx',
      enforce: 'pre',
      async transform(source, id) {
        if (!id.endsWith('.mdx')) return null
        return { code: String(await compile({ value: source, path: id }, { remarkPlugins })) }
      },
    },
  ],
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
