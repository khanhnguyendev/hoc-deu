import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loadCode, loadMdx } from '@/lib/content/catalog'
import type { CodeBundle } from '@/lib/content/code-tokens'
import { ITEM_TYPE_CORES } from '@/lib/content/item-types'
import { ITEM_TYPES, type ItemType } from '@/lib/content/schemas/common'
import {
  cardItem,
  fillBlankItem,
  lessonItem,
  NOTE,
  premiumProblemItem,
  problemItem,
  promptItem,
} from './fixtures'
import { getItemType, ITEM_REGISTRY } from './registry'

// The loaders stay the real ones (bound to the generated catalog) unless a test says otherwise.
vi.mock('@/lib/content/catalog', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/content/catalog')>()
  return { ...real, loadMdx: vi.fn(real.loadMdx), loadCode: vi.fn(real.loadCode) }
})

const Body = () => null
const BUNDLE: CodeBundle = { solutions: {}, blocks: {} }
const mdx = vi.mocked(loadMdx)
const code = vi.mocked(loadCode)

beforeEach(() => {
  mdx.mockClear()
  code.mockClear()
})

describe('ITEM_REGISTRY (platform design §3.2, §7.6)', () => {
  it('registers every item type, and nothing else', () => {
    expect(Object.keys(ITEM_REGISTRY).sort()).toEqual([...ITEM_TYPES].sort())
  })

  it.each([...ITEM_TYPES])('%s has a Page, a Row and load()', (type) => {
    const def = getItemType(type)
    expect(def.type).toBe(type)
    expect(typeof def.Page).toBe('function')
    expect(typeof def.Row).toBe('function')
    expect(typeof def.load).toBe('function')
  })

  it.each([...ITEM_TYPES])('%s keeps its core: schema, outcomes, srs, estimates', (type) => {
    const def = getItemType(type)
    const core = ITEM_TYPE_CORES[type]
    expect(def.schema).toBe(core.schema)
    expect(def.outcomes).toBe(core.outcomes)
    expect(def.srs).toBe(core.srs)
    expect(def.estimateMinutes).toBe(core.estimateMinutes)
  })

  it('srs comes from the core: problems and flashcards only', () => {
    const srs = ITEM_TYPES.filter((type) => getItemType(type).srs)
    expect(srs.sort()).toEqual(['flashcard', 'problem'])
  })

  it('throws for an unknown type, and for Object.prototype keys', () => {
    expect(() => getItemType('video' as ItemType)).toThrow(/Unknown item type: video/)
    expect(() => getItemType('constructor' as ItemType)).toThrow(/Unknown item type/)
  })
})

describe('load()', () => {
  it('problem: the note’s MDX and the problem’s code', async () => {
    mdx.mockResolvedValueOnce(Body)
    code.mockResolvedValueOnce(BUNDLE)
    await expect(getItemType('problem').load(problemItem())).resolves.toEqual({
      Body,
      code: BUNDLE,
    })
    expect(mdx).toHaveBeenCalledWith(NOTE.mdxKey)
    expect(code).toHaveBeenCalledWith('dsa:lc-0001')
  })

  it('problem without a note: no body, and no MDX load', async () => {
    // The fixture reuses a real problem ID; pin the code loader so real content can't leak in.
    code.mockResolvedValueOnce(null)
    await expect(getItemType('problem').load(premiumProblemItem())).resolves.toEqual({
      Body: null,
      code: null,
    })
    expect(mdx).not.toHaveBeenCalled()
    expect(code).toHaveBeenCalledWith('dsa:lc-0271')
  })

  it('lesson: its MDX and code', async () => {
    mdx.mockResolvedValueOnce(Body)
    code.mockResolvedValueOnce(BUNDLE)
    await expect(getItemType('lesson').load(lessonItem())).resolves.toEqual({
      Body,
      code: BUNDLE,
    })
    expect(mdx).toHaveBeenCalledWith('dsa:lesson-two-pointers')
    expect(code).toHaveBeenCalledWith('dsa:lesson-two-pointers')
  })

  it('flashcard, exercise, prompt: nothing to load', async () => {
    const none = { Body: null, code: null }
    await expect(getItemType('flashcard').load(cardItem())).resolves.toEqual(none)
    await expect(getItemType('exercise').load(fillBlankItem())).resolves.toEqual(none)
    await expect(getItemType('prompt').load(promptItem())).resolves.toEqual(none)
    expect(mdx).not.toHaveBeenCalled()
    expect(code).not.toHaveBeenCalled()
  })

  it('the real generated catalog: an unknown key loads nothing', async () => {
    const ghost = problemItem({
      id: 'dsa:lc-9999',
      localId: 'lc-9999',
      content: { note: { ...NOTE, mdxKey: 'dsa:lc-9999#note' } },
    })
    await expect(getItemType('problem').load(ghost)).resolves.toEqual({ Body: null, code: null })
  })
})
