import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ItemsGalleryPage from './page'

// The MDX samples compile only under @next/mdx; their rendering is covered by
// app/dev/content/samples.test.tsx and e2e. Here they are stand-ins.
vi.mock('../content/sample-note.mdx', () => ({ default: () => <p>Ghi chú mẫu</p> }))
vi.mock('../content/sample-lesson.mdx', () => ({ default: () => <p>Bài học mẫu</p> }))

const access = vi.hoisted(() => ({ allowed: true, calls: 0 }))
vi.mock('@/lib/auth/dal', () => ({
  requireDevAccess: async () => {
    access.calls += 1
    await Promise.resolve()
    if (!access.allowed) throw new Error('NEXT_HTTP_ERROR_FALLBACK;404')
  },
}))

beforeEach(() => {
  access.allowed = true
  access.calls = 0
})

describe('/dev/items', () => {
  it('awaits requireDevAccess() first, then renders every type’s Page and Row', async () => {
    render(await ItemsGalleryPage())
    expect(access.calls).toBe(1)
    expect(screen.getByRole('heading', { level: 1, name: 'Loại mục học' })).toBeTruthy()
    for (const name of ['ProblemPage', 'LessonRow', 'FlashcardPage', 'ExerciseRow', 'PromptPage']) {
      expect(screen.getByRole('heading', { level: 2, name })).toBeTruthy()
    }
    expect(screen.getByRole('article', { name: 'Two Sum' })).toBeTruthy()
    const rows = screen.getAllByRole('link').filter((link) => link.dataset.slot === 'link-row')
    expect(rows.map((row) => row.getAttribute('href'))).toContain(
      '/t/english/items/explaining-code%3Adsa%3Alc-0001',
    )
  })

  it('renders nothing when requireDevAccess() refuses (a non-admin in production)', async () => {
    access.allowed = false
    await expect(ItemsGalleryPage()).rejects.toThrow('404')
  })
})
