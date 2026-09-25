import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ADMIN, fillBlankItem, pagePropsFor, respondItem, rewriteItem } from '../fixtures'
import { ExercisePage } from './Page'

describe('ExercisePage', () => {
  it('shows the Vietnamese instruction as the h1, the English one in lang="en", and the kind', () => {
    render(<ExercisePage {...pagePropsFor(fillBlankItem())} />)
    expect(screen.getByRole('heading', { level: 1, name: 'Điền từ còn thiếu' })).toBeTruthy()
    expect(screen.getByText('Fill in the blank').getAttribute('lang')).toBe('en')
    expect(screen.getByText('Điền từ')).toBeTruthy()
  })

  it('fill-blank: the blank is a labelled input and "Kiểm tra" grades it', async () => {
    const user = userEvent.setup()
    render(<ExercisePage {...pagePropsFor(fillBlankItem())} />)
    await user.type(screen.getByRole('textbox', { name: 'Từ còn thiếu' }), 'blocked')
    await user.click(screen.getByRole('button', { name: 'Kiểm tra' }))
    expect(screen.getByRole('status').textContent).toBe('Chính xác')
  })

  it.each([
    ['respond', respondItem, 'Trả lời'],
    ['rewrite', rewriteItem, 'Viết lại'],
  ] as const)('%s: an answer box and hidden sample answers', async (_kind, make, label) => {
    const user = userEvent.setup()
    const item = make()
    render(<ExercisePage {...pagePropsFor(item)} />)
    expect(screen.getByText(label)).toBeTruthy()
    expect(screen.getByRole('textbox', { name: 'Câu trả lời của bạn' })).toBeTruthy()
    const [sample = ''] = 'sampleAnswers' in item.content ? item.content.sampleAnswers : []
    expect(screen.queryByText(sample)).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Xem câu trả lời mẫu' }))
    expect(screen.getByText(sample)).toBeTruthy()
  })

  it.each([
    ['en', 'en'],
    ['vi', null],
  ] as const)(
    'passes the rubric language %s to the samples panel (M3-R5)',
    async (rubric, attribute) => {
      const user = userEvent.setup()
      render(<ExercisePage {...pagePropsFor(rewriteItem({ content: { lang: { rubric } } }))} />)
      await user.click(screen.getByRole('button', { name: 'Xem câu trả lời mẫu' }))
      expect(screen.getByRole('list', { name: 'Tiêu chí' }).getAttribute('lang')).toBe(attribute)
    },
  )

  it('a draft exercise starts with the draft notice', () => {
    const { container } = render(
      <ExercisePage {...pagePropsFor(fillBlankItem({ status: 'draft' }), { viewer: ADMIN })} />,
    )
    const main = container.firstElementChild as HTMLElement
    expect(main.firstElementChild?.getAttribute('data-slot')).toBe('banner')
  })
})
