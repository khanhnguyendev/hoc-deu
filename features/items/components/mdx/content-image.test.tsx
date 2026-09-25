import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CONTENT_IMAGE_BASE_URL } from '@/lib/content/images'
import { ContentImage } from './content-image'

const url = (path: string) => `${CONTENT_IMAGE_BASE_URL}dsa/lesson-two-pointers/${path}`

describe('ContentImage (OD3)', () => {
  it('renders next/image with the size from the title and the alt text', () => {
    render(
      <ContentImage src={url('walk.svg')} alt="Hai con trỏ tiến lại gần nhau" title="640x360" />,
    )
    const image = screen.getByRole('img', { name: 'Hai con trỏ tiến lại gần nhau' })
    expect(image.getAttribute('width')).toBe('640')
    expect(image.getAttribute('height')).toBe('360')
    expect(image.getAttribute('loading')).toBe('lazy')
    expect(image.getAttribute('title')).toBeNull()
    expect(image.className).toContain('max-w-full')
  })

  it('serves an SVG unoptimized, straight from the bucket', () => {
    render(<ContentImage src={url('walk.svg')} alt="a" title="640x360" />)
    expect(screen.getByRole('img').getAttribute('src')).toBe(url('walk.svg'))
    expect(screen.getByRole('img').getAttribute('srcset')).toBeNull()
  })

  it.each(['png', 'webp', 'jpg'])('sends a .%s through the Next image optimiser', (ext) => {
    render(<ContentImage src={url(`walk.${ext}`)} alt="a" title="320x200" />)
    const src = screen.getByRole('img').getAttribute('src') ?? ''
    expect(src.startsWith('/_next/image?url=')).toBe(true)
    expect(src).toContain(encodeURIComponent(url(`walk.${ext}`)))
  })

  it.each([undefined, '', '640', '640x', '0x10', 'wide'])(
    'renders nothing for the title %s (the check rejects it)',
    (title) => {
      const { container } = render(<ContentImage src={url('walk.png')} alt="a" title={title} />)
      expect(container.innerHTML).toBe('')
    },
  )

  it.each([
    'https://evil.test/storage/v1/object/public/content-images/dsa/x/a.svg',
    'https://oelgwbxukbgaqqvociwi.supabase.co/storage/v1/object/public/content-images-evil/a.svg',
    'http://oelgwbxukbgaqqvociwi.supabase.co/storage/v1/object/public/content-images/dsa/x/a.svg',
    '/dev/content-image-sample.svg',
  ])('fails closed: renders nothing for %s (outside the bucket)', (src) => {
    const { container } = render(<ContentImage src={src} alt="a" title="10x10" />)
    expect(container.innerHTML).toBe('')
  })

  it('lets code (the catalog) name another base; content cannot pass props', () => {
    render(
      <ContentImage src="/dev/content-image-sample.svg" alt="a" title="320x180" baseUrl="/dev/" />,
    )
    expect(screen.getByRole('img').getAttribute('src')).toBe('/dev/content-image-sample.svg')
  })

  it('renders nothing when the base is empty (every image rejected)', () => {
    const { container } = render(
      <ContentImage src={url('walk.svg')} alt="a" title="10x10" baseUrl="" />,
    )
    expect(container.innerHTML).toBe('')
  })

  it('renders nothing without a source', () => {
    const { container } = render(<ContentImage alt="a" title="10x10" />)
    expect(container.innerHTML).toBe('')
  })
})
