import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'

const eslint = new ESLint({ cwd: process.cwd() })
const LAYERS = 'layers/imports'

/**
 * The first lint of a file loads the config and its plugins (Tailwind's included): about a second
 * alone, but over 5 s — Vitest's default — under a parallel `pnpm verify` load (PR A: 5.9–7.1 s at
 * 40 busy processes on 8 cores). Every block here gets 30 s; the global default stays.
 */
const COLD_ESLINT = { timeout: 30_000 }

async function ruleIds(code: string, filePath: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath })
  return (result?.messages ?? []).map((m) => m.ruleId ?? 'fatal')
}

async function layerMessages(code: string, filePath: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath })
  return (result?.messages ?? []).filter((m) => m.ruleId === LAYERS).map((m) => m.message)
}

describe('layer rules (platform design §7.2)', COLD_ESLINT, () => {
  it('forbids ui primitives importing patterns', async () => {
    const ids = await ruleIds(
      "import { PageHeader } from '@/components/patterns/page-header'\nexport const x = PageHeader\n",
      'components/ui/button.tsx',
    )
    expect(ids).toContain(LAYERS)
  })

  it('lets ui primitives use lib/utils', async () => {
    const ids = await ruleIds(
      "import { cn } from '@/lib/utils'\nexport const x = cn\n",
      'components/ui/button.tsx',
    )
    expect(ids).not.toContain(LAYERS)
  })

  it('forbids deep imports into another feature', async () => {
    const ids = await ruleIds(
      "import { X } from '@/features/review/components/x'\nexport const y = X\n",
      'features/today/components/plan.tsx',
    )
    expect(ids).toContain(LAYERS)
  })

  it('forbids pages importing ui primitives', async () => {
    const ids = await ruleIds(
      "import { Button } from '@/components/ui/button'\nexport default function P() { return <Button /> }\n",
      'app/(app)/today/page.tsx',
    )
    expect(ids).toContain(LAYERS)
  })

  it('forbids className in pages', async () => {
    const ids = await ruleIds(
      'export default function P() { return <main className="p-4" /> }\n',
      'app/(app)/today/page.tsx',
    )
    expect(ids).toContain('no-restricted-syntax')
  })

  it("forbids 'use client' in pages", async () => {
    const ids = await ruleIds(
      "'use client'\nexport default function P() { return <main /> }\n",
      'app/(app)/today/page.tsx',
    )
    expect(ids).toContain('no-restricted-syntax')
  })

  it('forbids parent-relative imports that bypass the layer rules', async () => {
    const fromUi = await ruleIds(
      "import { PageHeader } from '../patterns/page-header'\nexport const x = PageHeader\n",
      'components/ui/button.tsx',
    )
    const fromFeature = await ruleIds(
      "import { X } from '../../review/components/x'\nexport const y = X\n",
      'features/today/components/plan.tsx',
    )
    const fromPage = await ruleIds(
      "import { Button } from '../../../components/ui/button'\nexport default function P() { return <Button /> }\n",
      'app/(app)/today/page.tsx',
    )
    expect(fromUi).toContain(LAYERS)
    expect(fromFeature).toContain(LAYERS)
    expect(fromPage).toContain(LAYERS)
  })

  it('lets a feature import its own files through the alias', async () => {
    const ids = await ruleIds(
      "import { loadToday } from '@/features/today/queries'\nexport const x = loadToday\n",
      'features/today/components/plan.tsx',
    )
    expect(ids).not.toContain(LAYERS)
  })

  it('lets any feature use the item registry', async () => {
    const ids = await ruleIds(
      "import { getItemType } from '@/features/items/registry'\nexport const x = getItemType\n",
      'features/review/components/queue.tsx',
    )
    expect(ids).not.toContain(LAYERS)
  })

  it('allows same-folder relative imports', async () => {
    const ids = await ruleIds("import { cn } from './utils'\nexport const x = cn\n", 'lib/other.ts')
    expect(ids).not.toContain(LAYERS)
  })

  it('allows className only in the root layout', async () => {
    const ids = await ruleIds(
      'export default function L({ children }: { children: React.ReactNode }) { return <html lang="vi" className="font-sans"><body>{children}</body></html> }\n',
      'app/layout.tsx',
    )
    expect(ids).not.toContain('no-restricted-syntax')
  })

  it('bans next/font/google (the build must work offline)', async () => {
    const ids = await ruleIds(
      "import { Inter } from 'next/font/google'\nexport const f = Inter\n",
      'app/fonts/fonts.ts',
    )
    expect(ids).toContain('no-restricted-imports')
  })

  it.each([
    [
      'patterns use ui primitives',
      "import { Button } from '@/components/ui/button'",
      'components/patterns/x.tsx',
    ],
    [
      'features use ui',
      "import { Button } from '@/components/ui/button'",
      'features/today/components/plan.tsx',
    ],
    [
      'features use patterns',
      "import { PageHeader } from '@/components/patterns/page-header'",
      'features/today/components/plan.tsx',
    ],
    [
      'features use lib',
      "import { vi } from '@/lib/i18n/vi'",
      'features/today/components/plan.tsx',
    ],
    [
      'features use their own files relatively',
      "import { plan } from '../queries'",
      'features/today/components/plan.tsx',
    ],
    [
      'pages use a feature index',
      "import { TodayPage } from '@/features/today'",
      'app/(app)/today/page.tsx',
    ],
    [
      'pages use patterns',
      "import { PageHeader } from '@/components/patterns/page-header'",
      'app/(app)/today/page.tsx',
    ],
    ['lib uses lib', "import { createClient } from '@/lib/supabase/server'", 'lib/auth/dal.ts'],
    ['tools use lib', "import { schema } from '@/lib/content/schemas'", 'tools/content/build.ts'],
    [
      'the catalog uses ui primitives',
      "import { Button } from '@/components/ui/button'",
      'app/dev/components/catalog.tsx',
    ],
  ])('allows: %s', async (_, importLine, filePath) => {
    const ids = await ruleIds(`${importLine}\nexport const x = 1\n`, filePath)
    expect(ids).not.toContain(LAYERS)
  })

  // M1 deferred #6: route handlers follow their own §7.2 row instead of being exempt.
  it('forbids route handlers importing components', async () => {
    const ids = await ruleIds(
      "import { Button } from '@/components/ui/button'\nexport const x = Button\n",
      'app/api/x/route.ts',
    )
    expect(ids).toContain(LAYERS)
  })

  it('lets route handlers use lib and a feature index', async () => {
    const ids = await ruleIds(
      "import { createClient } from '@/lib/supabase/server'\nimport { TodayPage } from '@/features/today'\nexport const x = [createClient, TodayPage]\n",
      'app/api/x/route.ts',
    )
    expect(ids).not.toContain(LAYERS)
  })

  it('checks .mjs files too', async () => {
    const ids = await ruleIds(
      "import { x } from '@/features/a/internal'\nexport const y = x\n",
      'lib/x.mjs',
    )
    expect(ids).toContain(LAYERS)
  })

  it('lets .mjs files import what their layer allows', async () => {
    const ids = await ruleIds(
      "import { cn } from '@/lib/utils'\nexport const y = cn\n",
      'lib/x.mjs',
    )
    expect(ids).not.toContain(LAYERS)
  })

  it("forbids 'use client' in the catalog's pages", async () => {
    const ids = await ruleIds(
      "'use client'\nexport default function P() { return <main /> }\n",
      'app/dev/x/page.tsx',
    )
    expect(ids).toContain('no-restricted-syntax')
  })

  it('keeps className allowed in the catalog pages', async () => {
    const ids = await ruleIds(
      'export default function P() { return <main className="p-4" /> }\n',
      'app/dev/x/page.tsx',
    )
    expect(ids).not.toContain('no-restricted-syntax')
  })

  it('keeps lib/domain pure', async () => {
    const ids = await ruleIds(
      "import { cookies } from 'next/headers'\nexport const n = () => Date.now() + String(cookies)\n",
      'lib/domain/plan/x.ts',
    )
    expect(
      ids.filter((id) => id === 'no-restricted-imports' || id === 'no-restricted-syntax'),
    ).toHaveLength(2)
  })
})

// Owner review SF7: server configuration and the secret-key client never reach a client bundle.
describe('client modules (owner review SF7)', COLD_ESLINT, () => {
  const CLIENT_FILE = 'features/x/components/c.tsx'
  const MESSAGE = 'Client modules must not import server configuration or the secret-key client.'

  it.each([
    ["import { serverEnv } from '@/lib/env'", '@/lib/env'],
    [
      "import { createAdminClient } from '../../../lib/supabase/admin'",
      '../../../lib/supabase/admin',
    ],
    ["export { serverEnv } from '@/lib/env.ts'", '@/lib/env.ts'],
    ["const m = import('@/lib/supabase/admin')", '@/lib/supabase/admin'],
  ])("rejects %s in a 'use client' module", async (importLine, spec) => {
    const messages = await layerMessages(
      `'use client'\n${importLine}\nexport const x = 1\n`,
      CLIENT_FILE,
    )
    expect(messages).toEqual([`'${spec}': ${MESSAGE}`])
  })

  it.each([
    "import { serverEnv } from '@/lib/env'",
    "import { createAdminClient } from '../../../lib/supabase/admin'",
  ])('allows %s without the directive', async (importLine) => {
    const ids = await ruleIds(`${importLine}\nexport const x = 1\n`, CLIENT_FILE)
    expect(ids).not.toContain(LAYERS)
  })

  it("lets a 'use client' module import lib/utils", async () => {
    const ids = await ruleIds(
      "'use client'\nimport { cn } from '@/lib/utils'\nexport const x = cn\n",
      CLIENT_FILE,
    )
    expect(ids).not.toContain(LAYERS)
  })

  it("finds 'use client' anywhere in the directive prologue", async () => {
    const messages = await layerMessages(
      "'use strict'\n'use client'\nimport { serverEnv } from '@/lib/env'\nexport const x = serverEnv\n",
      CLIENT_FILE,
    )
    expect(messages).toEqual([`'@/lib/env': ${MESSAGE}`])
  })

  it("only treats a leading 'use client' as the directive", async () => {
    const ids = await ruleIds(
      "import { serverEnv } from '@/lib/env'\n'use client'\nexport const x = serverEnv\n",
      CLIENT_FILE,
    )
    expect(ids).not.toContain(LAYERS)
  })
})

describe('token rules (platform design §7.3)', COLD_ESLINT, () => {
  it('rejects arbitrary values', async () => {
    const ids = await ruleIds(
      'export const C = () => <div className="p-[13px]" />\n',
      'components/patterns/c.tsx',
    )
    expect(ids).toContain('better-tailwindcss/no-restricted-classes')
  })

  it('rejects raw palette colours', async () => {
    const ids = await ruleIds(
      'export const C = () => <div className="bg-red-500 hover:text-slate-700" />\n',
      'components/patterns/c.tsx',
    )
    expect(ids.filter((id) => id === 'better-tailwindcss/no-restricted-classes')).toHaveLength(2)
  })

  it('rejects unknown classes', async () => {
    const ids = await ruleIds(
      'export const C = () => <div className="bg-brand-blue" />\n',
      'components/patterns/c.tsx',
    )
    expect(ids).toContain('better-tailwindcss/no-unknown-classes')
  })

  it.each([
    'bg-black/50',
    'text-white/80',
    'bg-red-500/50',
    'from-red-500/20',
    'border-t-red-500',
    'ring-offset-red-500',
    'fill-white',
    'stroke-black',
    'max-[600px]:p-4',
    '!p-4',
    'p-4!',
    'duration-700',
  ])('rejects the raw or escaping form %s', async (cls) => {
    const ids = await ruleIds(
      `export const C = () => <div className="${cls}" />\n`,
      'components/patterns/c.tsx',
    )
    expect(ids).toContain('better-tailwindcss/no-restricted-classes')
  })

  it.each(['shadow-lg', 'text-5xl', 'rounded-3xl', 'font-serif', 'ease-in', 'drop-shadow-lg'])(
    'treats Tailwind default theme value %s as unknown',
    async (cls) => {
      const ids = await ruleIds(
        `export const C = () => <div className="${cls}" />\n`,
        'components/patterns/c.tsx',
      )
      expect(ids).toContain('better-tailwindcss/no-unknown-classes')
    },
  )

  it('accepts token utilities with opacity, weights and motion tokens', async () => {
    const ids = await ruleIds(
      'export const C = () => <div className="bg-background/50 font-sans font-semibold text-sm shadow-sm rounded-lg ease-standard duration-(--duration-fast) motion-reduce:transition-none" />\n',
      'components/patterns/c.tsx',
    )
    expect(ids).toEqual([])
  })

  it('accepts semantic token classes', async () => {
    const ids = await ruleIds(
      'export const C = () => <div data-accent="track-1" className="rounded-lg border bg-surface p-4 text-muted-foreground hover:bg-surface-muted data-[state=open]:bg-track-soft" />\n',
      'components/patterns/c.tsx',
    )
    expect(ids).toEqual([])
  })
})

describe('style props (platform design §7.3)', COLD_ESLINT, () => {
  it('rejects style properties that are not custom properties', async () => {
    const ids = await ruleIds(
      'export const C = () => (\n  <div\n    style={{\n      width: 240,\n    }}\n  />\n)\n',
      'components/patterns/c.tsx',
    )
    expect(ids).toContain('no-restricted-syntax')
  })

  it('rejects style objects passed by reference or spread', async () => {
    const byRef = await ruleIds(
      'const s = { color: "red" }\nexport const C = () => <div style={s} />\n',
      'features/x/components/c.tsx',
    )
    const spread = await ruleIds(
      'export const C = (p: object) => <div style={{ ...p }} />\n',
      'features/x/components/c.tsx',
    )
    expect(byRef).toContain('no-restricted-syntax')
    expect(spread).toContain('no-restricted-syntax')
  })

  it('allows custom properties that carry data', async () => {
    const ids = await ruleIds(
      "export const C = ({ v }: { v: number }) => <div style={{ '--progress': v }} />\n",
      'components/patterns/ring.tsx',
    )
    expect(ids).toEqual([])
  })
})

// Task 3.3b review: tools/ is build-time code (content:build, guards, CLIs); the running app —
// components, features and routes — reaches shared rules through lib/ (spec §7.2). Only the
// catalog (app/dev) may import tools/ for its fixtures and tests.
describe('app code never imports tools/', COLD_ESLINT, () => {
  const MESSAGE = 'tools/ is build-time code; the app imports shared rules from lib/.'

  it.each([
    [
      'features/items/components/mdx/x.tsx',
      "import { parseImageSize } from '@/tools/content/allowlist'",
    ],
    [
      'features/items/components/mdx/x.tsx',
      "import { x } from '../../../../tools/content/allowlist'",
    ],
    ['components/patterns/x.tsx', "import { x } from '@/tools/content/highlight'"],
    ['app/(app)/today/page.tsx', "import { x } from '@/tools/content/allowlist'"],
    ['app/api/x/route.ts', "const m = import('@/tools/content/allowlist')"],
  ])('%s: rejects %s', async (file, importLine) => {
    const messages = await layerMessages(`${importLine}\nexport const y = 1\n`, file)
    expect(messages).toHaveLength(1)
    expect(messages[0]).toContain(MESSAGE)
  })

  it.each([
    ['app/dev/content/fixtures.test.ts', "import { x } from '@/tools/content/mdx/parse'"],
    ['tools/content/cli.ts', "import { x } from '@/tools/content/allowlist'"],
    ['features/items/components/mdx/x.tsx', "import { x } from '@/lib/content/images'"],
  ])('%s: allows %s', async (file, importLine) => {
    const ids = await ruleIds(`${importLine}\nexport const y = x\n`, file)
    expect(ids).not.toContain(LAYERS)
  })
})
