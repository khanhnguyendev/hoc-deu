import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const exclude = ['node_modules/**', '.next/**', 'e2e/**']

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': import.meta.dirname } },
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
