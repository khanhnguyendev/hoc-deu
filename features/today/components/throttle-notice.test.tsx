import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ENGLISH_TITLE, trackView } from '../__tests__/fixtures'
import { ThrottleNotice } from './throttle-notice'

describe('ThrottleNotice (§5.5)', () => {
  it('says why, in a warning banner, with a link to the track’s reviews', () => {
    const { container } = render(
      <ThrottleNotice
        track={trackView({
          trackId: 'english',
          title: ENGLISH_TITLE,
          throttleMessage: 'Đang có 52 thẻ cần ôn — tạm giảm thẻ mới.',
        })}
      />,
    )
    const banner = container.querySelector('[data-slot="banner"]')!
    expect(banner.getAttribute('data-tone')).toBe('warning')
    expect(banner.textContent).toContain('Đang có 52 thẻ cần ôn — tạm giảm thẻ mới.')
    const link = screen.getByRole('link', { name: `Ôn tập ${ENGLISH_TITLE}` })
    expect(link.getAttribute('href')).toBe('/review?track=english')
  })

  it('renders nothing when the track is not throttled', () => {
    const { container } = render(<ThrottleNotice track={trackView()} />)
    expect(container.innerHTML).toBe('')
  })
})
