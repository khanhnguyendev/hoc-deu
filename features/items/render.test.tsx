import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CatalogItem } from '@/lib/content/catalog-types'
import type { ItemType } from '@/lib/content/schemas/common'
import { cardItem, derivedCardItem, outcomeBinding, problemItem, REQUEST_ID } from './fixtures'
import { renderItemPage, renderItemRow } from './render'
import type { ItemPageData, ItemPageProps, ItemRowProps } from './types'

/** A stand-in registry: each type's Row and Page print what they received. */
const fake = vi.hoisted(() => {
  const data = { Body: () => null, code: { solutions: {}, blocks: {} } }
  const row = (type: string) =>
    function FakeRow({
      item,
      href,
      state,
      mode,
      showStatus,
      showNoteHint,
    }: ItemRowProps<ItemType>) {
      return (
        <a
          href={href}
          data-row={type}
          data-state={state?.status ?? 'none'}
          data-mode={mode ?? 'none'}
          data-show-status={String(showStatus ?? false)}
          data-note-hint={String(showNoteHint ?? false)}
        >
          {item.title}
        </a>
      )
    }
  const page = (type: string) =>
    function FakePage({
      item,
      data: loaded,
      state,
      viewer,
      outcome,
      mockInterviewProblem,
    }: ItemPageProps<ItemType>) {
      return (
        <article
          data-page={type}
          data-loaded={String(loaded === data)}
          data-state={state?.status ?? 'none'}
          data-admin={String(viewer.isAdmin)}
          data-mode={outcome?.mode ?? 'none'}
          data-request={outcome?.requestId ?? 'none'}
          data-mock={
            mockInterviewProblem === undefined ? 'none' : (mockInterviewProblem?.id ?? 'null')
          }
        >
          {item.title}
        </article>
      )
    }
  const load = vi.fn(async (): Promise<ItemPageData> => data)
  const def = (type: string) => ({ Row: row(type), Page: page(type), load })
  return { data, load, def }
})

vi.mock('./registry', () => ({
  getItemType: (type: string) => fake.def(type),
}))

beforeEach(() => {
  fake.load.mockClear()
})

describe('renderItemRow (fix 5)', () => {
  it("renders the registered Row of the item's type with its href", () => {
    render(<ul>{renderItemRow(problemItem(), {})}</ul>)
    const row = screen.getByRole('link', { name: 'Two Sum' })
    expect(row.dataset.row).toBe('problem')
    expect(row.getAttribute('href')).toBe('/t/dsa/items/lc-0001')
    expect(row.dataset.state).toBe('none')
    expect(row.dataset.showStatus).toBe('false')
  })

  it('passes state, mode and showStatus through; a derived card gets its encoded href', () => {
    const item: CatalogItem = derivedCardItem()
    render(
      <ul>
        {renderItemRow(item, {
          state: { status: 'weak', level: 1, dueOn: '2026-10-01' },
          mode: 'review',
          showStatus: true,
        })}
      </ul>,
    )
    const row = screen.getByRole('link')
    expect(row.dataset.row).toBe('flashcard')
    expect(row.getAttribute('href')).toBe('/t/english/items/explaining-code%3Adsa%3Alc-0001')
    expect(row.dataset.state).toBe('weak')
    expect(row.dataset.mode).toBe('review')
    expect(row.dataset.showStatus).toBe('true')
  })

  it('ruling M5-R26: an href of the caller’s (a plan block’s ?block=&mode=) and showNoteHint', () => {
    render(
      <ul>
        {renderItemRow(problemItem(), {
          href: '/t/dsa/items/lc-0001?block=b&mode=new',
          showNoteHint: true,
        })}
      </ul>,
    )
    const row = screen.getByRole('link')
    expect(row.getAttribute('href')).toBe('/t/dsa/items/lc-0001?block=b&mode=new')
    expect(row.dataset.noteHint).toBe('true')
  })

  it('keys the row by item ID, so lists of rows need no extra key', () => {
    const element = renderItemRow(cardItem(), {}) as { key: string | null }
    expect(element.key).toBe('english:w01-blocker')
  })
})

describe('renderItemPage (fix 5)', () => {
  it('awaits the type’s load() and passes the loaded data to its Page', async () => {
    const item = problemItem()
    const page = await renderItemPage(item, {
      state: null,
      viewer: { codeLanguage: 'java', isAdmin: true },
      resolveItem: () => null,
      outcome: outcomeBinding(vi.fn(), { mode: 'redo' }),
      mockInterviewProblem: null,
    })
    expect(fake.load).toHaveBeenCalledExactlyOnceWith(item)
    render(<>{page}</>)
    const article = screen.getByRole('article')
    expect(article.dataset.page).toBe('problem')
    expect(article.dataset.loaded).toBe('true')
    expect(article.dataset.admin).toBe('true')
    expect(article.dataset.mode).toBe('redo')
    expect(article.dataset.request).toBe(REQUEST_ID)
    expect(article.dataset.mock).toBe('null')
    expect(article.textContent).toBe('Two Sum')
  })
})
