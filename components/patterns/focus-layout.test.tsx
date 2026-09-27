import { act, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { toast } from '@/components/ui/toaster'
import { FocusLayout } from './focus-layout'

describe('FocusLayout', () => {
  it('renders the wordmark link and a landmark main#main', () => {
    render(
      <FocusLayout>
        <p>Nội dung</p>
      </FocusLayout>,
    )
    const link = screen.getByRole('link', { name: 'Học Đều' })
    expect(link.getAttribute('href')).toBe('/')
    const main = screen.getByRole('main')
    expect(main.getAttribute('id')).toBe('main')
    expect(main.textContent).toContain('Nội dung')
  })

  it('renders header actions when given', () => {
    render(
      <FocusLayout headerActions={<button type="button">Trợ giúp</button>}>
        <p>Nội dung</p>
      </FocusLayout>,
    )
    expect(screen.getByRole('button', { name: 'Trợ giúp' })).toBeTruthy()
  })

  it('switches the main max-width between narrow (default) and wide', () => {
    const { rerender } = render(
      <FocusLayout>
        <p>Nội dung</p>
      </FocusLayout>,
    )
    expect(screen.getByRole('main').className).toContain('max-w-md')
    rerender(
      <FocusLayout width="wide">
        <p>Nội dung</p>
      </FocusLayout>,
    )
    expect(screen.getByRole('main').className).toContain('max-w-2xl')
  })

  it('stacks the page sections with the section spacing (DESIGN_SYSTEM §5)', () => {
    render(
      <FocusLayout>
        <p>Tiêu đề</p>
        <p>Nội dung</p>
      </FocusLayout>,
    )
    const main = screen.getByRole('main')
    for (const token of ['flex-col', 'gap-6', 'md:gap-8', 'lg:gap-10']) {
      expect(main.className.split(' ')).toContain(token)
    }
  })

  // Task 5.6 (the M2 2.8 minor): /sign-in, /pending and /onboarding render outside the AppShell,
  // whose Toaster they never had. Sonner keeps toasts in module state: each test its own message.
  it('renders the Toaster, so pages outside the AppShell show toasts', async () => {
    render(
      <FocusLayout>
        <p>Nội dung</p>
      </FocusLayout>,
    )
    act(() => {
      toast('Đã gửi (FocusLayout).')
    })
    expect(await screen.findByText('Đã gửi (FocusLayout).')).toBeTruthy()
    expect(screen.getByRole('region', { name: /Thông báo/ })).toBeTruthy()
  })

  it('leaves the Toaster out with toaster={false}, for a page that mounts its own (the catalog)', () => {
    render(
      <FocusLayout toaster={false}>
        <p>Nội dung</p>
      </FocusLayout>,
    )
    expect(screen.queryByRole('region', { name: /Thông báo/ })).toBeNull()
  })
})
