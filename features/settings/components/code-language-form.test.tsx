import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type * as React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Toaster } from '@/components/ui/toaster'
import type { SettingsAction, SettingsResult } from '../schema'
import { CodeLanguageForm } from './code-language-form'

const REQUEST_ID = '0f8d6a52-3b1c-4d7e-9a2f-6c5b4e3d2a10'

let run = 0

function setup(
  props: Partial<React.ComponentProps<typeof CodeLanguageForm>> = {},
  result?: SettingsResult,
) {
  run += 1
  const message = `Đã lưu ngôn ngữ (${run}).`
  const updateCodeLanguage = vi.fn<SettingsAction>(async () => result ?? { ok: true, message })
  render(
    <>
      <CodeLanguageForm
        codeLanguage="python"
        requestId={REQUEST_ID}
        updateCodeLanguage={updateCodeLanguage}
        {...props}
      />
      <Toaster />
    </>,
  )
  return { updateCodeLanguage, message, user: userEvent.setup() }
}

const radio = (name: string) => screen.getByRole('radio', { name })

describe('CodeLanguageForm', () => {
  it('offers Python, Java and Go in a named group, with the saved language checked', () => {
    setup({ codeLanguage: 'java' })
    expect(screen.getByRole('form', { name: 'Ngôn ngữ lập trình' })).toBeTruthy()
    expect(screen.getByRole('radiogroup', { name: 'Ngôn ngữ lập trình' })).toBeTruthy()
    expect(screen.getAllByRole('radio')).toHaveLength(3)
    expect(radio('Java').getAttribute('aria-checked')).toBe('true')
    expect(radio('Python').getAttribute('aria-checked')).toBe('false')
  })

  it('reads a profile without a language as Python (the default)', () => {
    setup({ codeLanguage: null })
    expect(radio('Python').getAttribute('aria-checked')).toBe('true')
  })

  it('"Lưu" sends the requestId and the chosen language, then toasts', async () => {
    const { updateCodeLanguage, message, user } = setup()
    await user.click(radio('Go'))
    await user.click(screen.getByRole('button', { name: 'Lưu' }))
    await waitFor(() => expect(updateCodeLanguage).toHaveBeenCalledTimes(1))
    expect(Object.fromEntries(updateCodeLanguage.mock.calls[0]![1].entries())).toEqual({
      requestId: REQUEST_ID,
      codeLanguage: 'go',
    })
    expect(await screen.findByText(message)).toBeTruthy()
  })

  it('shows a failure in an alert and the field error under the group', async () => {
    const { user } = setup(
      {},
      {
        ok: false,
        message: 'Kiểm tra lại các mục được đánh dấu.',
        fieldErrors: { codeLanguage: 'Chọn Python, Java hoặc Go.' },
      },
    )
    await user.click(screen.getByRole('button', { name: 'Lưu' }))
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain(
        'Kiểm tra lại các mục được đánh dấu.',
      ),
    )
    const error = screen.getByText('Chọn Python, Java hoặc Go.').closest('p')!
    expect(screen.getByRole('radiogroup').getAttribute('aria-describedby')).toBe(error.id)
  })
})
