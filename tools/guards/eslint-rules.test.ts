import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'

const eslint = new ESLint({ cwd: process.cwd() })

async function ruleIds(code: string, filePath: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath })
  return (result?.messages ?? []).map((m) => m.ruleId ?? 'fatal')
}

describe('layer rules (platform design §7.2)', () => {
  it('forbids ui primitives importing patterns', async () => {
    const ids = await ruleIds(
      "import { PageHeader } from '@/components/patterns/page-header'\nexport const x = PageHeader\n",
      'components/ui/button.tsx',
    )
    expect(ids).toContain('no-restricted-imports')
  })

  it('lets ui primitives use lib/utils', async () => {
    const ids = await ruleIds(
      "import { cn } from '@/lib/utils'\nexport const x = cn\n",
      'components/ui/button.tsx',
    )
    expect(ids).not.toContain('no-restricted-imports')
  })

  it('forbids deep imports into another feature', async () => {
    const ids = await ruleIds(
      "import { X } from '@/features/review/components/x'\nexport const y = X\n",
      'features/today/components/plan.tsx',
    )
    expect(ids).toContain('no-restricted-imports')
  })

  it('forbids pages importing ui primitives', async () => {
    const ids = await ruleIds(
      "import { Button } from '@/components/ui/button'\nexport default function P() { return <Button /> }\n",
      'app/(app)/today/page.tsx',
    )
    expect(ids).toContain('no-restricted-imports')
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

describe('token rules (platform design §7.3)', () => {
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

  it('accepts semantic token classes', async () => {
    const ids = await ruleIds(
      'export const C = () => <div data-accent="track-1" className="rounded-lg border bg-surface p-4 text-muted-foreground hover:bg-surface-muted data-[state=open]:bg-track-soft" />\n',
      'components/patterns/c.tsx',
    )
    expect(ids).toEqual([])
  })
})
