import { describe, expect, it, vi } from 'vitest'

// `next/font/local` is a build-time macro (Next's compiler rewrites the call); under Vitest it is
// only ever a plain function, so it needs a stand-in here (same reason as app/global-error.test.tsx).
vi.mock('next/font/local', () => ({
  default: () => ({ variable: '--mock-font', className: 'mock-font' }),
}))

const { metadata } = await import('./layout')

/** Fix round 1 (review): app/layout.tsx's metadata (Part B-M6 decision 26). */
describe('app/layout.tsx metadata', () => {
  it('resolves file-convention URLs (icons, the Open Graph image) absolutely', () => {
    expect(metadata.metadataBase).toBeInstanceOf(URL)
  })

  it('sets applicationName', () => {
    expect(metadata.applicationName).toBe('Học Đều')
  })

  it('sets an openGraph object with no images (the opengraph-image.png file convention supplies it)', () => {
    expect(metadata.openGraph).toMatchObject({
      type: 'website',
      locale: 'vi_VN',
      siteName: 'Học Đều',
      title: 'Học Đều',
      description: 'Nền tảng học tập dẫn dắt bởi AI — mỗi ngày một chút, AI giúp bạn tiến đều.',
    })
    expect(metadata.openGraph).not.toHaveProperty('images')
  })

  it('uses one description for the page and its Open Graph card', () => {
    expect(metadata.description).toBe(metadata.openGraph?.description)
  })
})
