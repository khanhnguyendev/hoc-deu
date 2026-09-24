import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type * as React from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { TestLoginState } from '../actions'
import { SignInPanel } from './sign-in-panel'

const OAUTH_ERROR = 'Đăng nhập không thành công. Bạn thử lại nhé.'
const WRONG_CREDENTIALS = 'Email hoặc mật khẩu không đúng.'

function renderPanel(props: Partial<React.ComponentProps<typeof SignInPanel>> = {}) {
  const signInWithProvider = vi.fn<(formData: FormData) => Promise<void>>(async () => {})
  const signInWithTestLogin = vi.fn<
    (state: TestLoginState, formData: FormData) => Promise<TestLoginState>
  >(async () => ({ error: null }))
  render(
    <SignInPanel
      next={null}
      oauthError={false}
      testLogin={false}
      signInWithProvider={signInWithProvider}
      signInWithTestLogin={signInWithTestLogin}
      {...props}
    />,
  )
  return { signInWithProvider, signInWithTestLogin }
}

const hiddenValue = (form: HTMLFormElement, name: string) =>
  (form.elements.namedItem(name) as HTMLInputElement | null)?.value

describe('SignInPanel', () => {
  it('offers Google and GitHub, each a form that posts its provider and the next path', () => {
    renderPanel({ next: '/today' })
    for (const [label, provider] of [
      ['Tiếp tục với Google', 'google'],
      ['Tiếp tục với GitHub', 'github'],
    ] as const) {
      const button = screen.getByRole('button', { name: label })
      expect(button.getAttribute('type')).toBe('submit')
      const form = button.closest('form')!
      expect(hiddenValue(form, 'provider')).toBe(provider)
      expect(hiddenValue(form, 'next')).toBe('/today')
    }
  })

  it('sends no next path when there is none', () => {
    renderPanel()
    const form = screen.getByRole('button', { name: 'Tiếp tục với Google' }).closest('form')!
    expect(hiddenValue(form, 'next')).toBeUndefined()
  })

  it('calls the provider action with the form data', async () => {
    const { signInWithProvider } = renderPanel({ next: '/today' })
    await userEvent.setup().click(screen.getByRole('button', { name: 'Tiếp tục với GitHub' }))
    expect(signInWithProvider).toHaveBeenCalledTimes(1)
    const formData = signInWithProvider.mock.calls[0]![0]
    expect(formData.get('provider')).toBe('github')
    expect(formData.get('next')).toBe('/today')
  })

  it('shows the test-login form only when test login is enabled', () => {
    renderPanel({ testLogin: false })
    expect(screen.queryByRole('form', { name: 'Đăng nhập thử nghiệm' })).toBeNull()
    expect(screen.queryByLabelText(/Mật khẩu/)).toBeNull()
  })

  it('renders the test-login form with labelled e-mail and password fields', () => {
    renderPanel({ testLogin: true, next: '/today' })
    const form = screen.getByRole('form', { name: 'Đăng nhập thử nghiệm' }) as HTMLFormElement
    const email = within(form).getByLabelText(/Email/) as HTMLInputElement
    const password = within(form).getByLabelText(/Mật khẩu/) as HTMLInputElement
    expect(email.type).toBe('email')
    expect(email.required).toBe(true)
    expect(password.type).toBe('password')
    expect(password.required).toBe(true)
    expect(hiddenValue(form, 'next')).toBe('/today')
    expect(within(form).getByRole('button', { name: 'Đăng nhập' }).getAttribute('type')).toBe(
      'submit',
    )
  })

  it('shows the error the test-login action returns', async () => {
    const { signInWithTestLogin } = renderPanel({ testLogin: true })
    signInWithTestLogin.mockResolvedValueOnce({ error: WRONG_CREDENTIALS })
    const user = userEvent.setup()
    const form = screen.getByRole('form', { name: 'Đăng nhập thử nghiệm' })
    await user.type(within(form).getByLabelText(/Email/), 'learner@example.test')
    await user.type(within(form).getByLabelText(/Mật khẩu/), 'wrong-password')
    await user.click(within(form).getByRole('button', { name: 'Đăng nhập' }))
    const alert = await screen.findByRole('alert')
    expect(await within(alert).findByText(WRONG_CREDENTIALS)).toBeTruthy()
    const formData = signInWithTestLogin.mock.calls[0]![1]
    expect(formData.get('email')).toBe('learner@example.test')
    expect(formData.get('password')).toBe('wrong-password')
  })

  it('shows the error banner after a failed OAuth sign-in', () => {
    renderPanel({ oauthError: true })
    expect(screen.getByText(OAUTH_ERROR)).toBeTruthy()
  })

  it('shows no error banner otherwise', () => {
    renderPanel({ oauthError: false, testLogin: true })
    expect(screen.queryByText(OAUTH_ERROR)).toBeNull()
    expect(screen.queryByText(WRONG_CREDENTIALS)).toBeNull()
  })

  it('has one page heading', () => {
    renderPanel({ testLogin: true })
    expect(screen.getByRole('heading', { level: 1, name: 'Đăng nhập' })).toBeTruthy()
    expect(screen.getByRole('heading', { level: 2, name: 'Đăng nhập thử nghiệm' })).toBeTruthy()
  })
})
