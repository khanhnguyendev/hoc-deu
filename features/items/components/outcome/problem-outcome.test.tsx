import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { outcomeBinding, REQUEST_ID, SAVED } from '../../fixtures'
import type { OutcomeBinding, RecordOutcome } from '../../outcome'
import { SolutionTabs } from '../mdx/solution-tabs'
import { ProblemOutcome } from './problem-outcome'

const NOTE = (
  <div data-testid="note">
    <p>Ý tưởng chính của bài.</p>
    <SolutionTabs
      solutions={{ python: { lang: 'python', lines: [['class Solution: ...']] } }}
      defaultLanguage="python"
    />
  </div>
)

function setup(patch: Partial<Omit<OutcomeBinding, 'record'>> = {}, hasNote = true) {
  const user = userEvent.setup()
  const record = vi.fn<RecordOutcome>(async () => SAVED)
  render(
    <ProblemOutcome binding={outcomeBinding(record, patch)} hasNote={hasNote}>
      {NOTE}
    </ProblemOutcome>,
  )
  return { user, record }
}

const grades = (name: string) => screen.getByRole('group', { name })
const SOLVE = 'Bạn giải bài này thế nào?'
const RECALL = 'Bạn nhớ bài này đến đâu?'

describe('ProblemOutcome — a new problem', () => {
  it('shows the note, then "Tự giải được" / "Cần gợi ý" / "Chưa giải được"', () => {
    setup()
    expect(screen.getByTestId('note')).toBeTruthy()
    expect(
      within(grades(SOLVE))
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['Tự giải được', 'Cần gợi ý', 'Chưa giải được'])
  })

  it('"Tự giải được" sends item.result { result: solved } — no mode — with the block', async () => {
    const { user, record } = setup({ blockId: 'b-new', plan: { blockId: 'b-new', label: 'x' } })
    await user.click(screen.getByRole('button', { name: 'Tự giải được' }))
    expect(record).toHaveBeenCalledExactlyOnceWith({
      requestId: REQUEST_ID,
      itemId: 'dsa:lc-0001',
      blockId: 'b-new',
      outcome: { type: 'item.result', result: 'solved' },
    })
    await screen.findByText('Đã lưu kết quả.')
    expect(screen.getByRole('status').textContent).toBe('Tự giải được: Đã lưu kết quả.')
    expect(screen.getByRole('button', { name: 'Tự giải được' }).getAttribute('aria-pressed')).toBe(
      'true',
    )
    // The saved grade again (the page re-rendered with a new request id) records nothing more,
    // but says so — never a silent press (m-10).
    await user.click(screen.getByRole('button', { name: 'Tự giải được' }))
    expect(record).toHaveBeenCalledOnce()
    expect(screen.getByRole('status').textContent).toBe('Tự giải được: Kết quả này đã được lưu.')
  })

  it('a failure says so and leaves every grade available', async () => {
    const user = userEvent.setup()
    const record = vi.fn<RecordOutcome>().mockRejectedValueOnce(new Error('offline'))
    render(
      <ProblemOutcome binding={outcomeBinding(record)} hasNote>
        {NOTE}
      </ProblemOutcome>,
    )
    await user.click(screen.getByRole('button', { name: 'Chưa giải được' }))
    await screen.findByText('Chưa lưu được kết quả. Bạn thử lại nhé.')
    expect(screen.getByRole('status').textContent).toBe(
      'Chưa giải được: Chưa lưu được kết quả. Bạn thử lại nhé.',
    )
    for (const button of within(grades(SOLVE)).getAllByRole('button')) {
      expect((button as HTMLButtonElement).disabled).toBe(false)
      expect(button.getAttribute('aria-pressed')).toBe('false')
    }
  })
})

describe('ProblemOutcome — a navigation from the action (M1)', () => {
  it('a guard redirect says nothing: the router is already navigating', async () => {
    const user = userEvent.setup()
    const redirect = Object.assign(new Error('NEXT_REDIRECT'), {
      digest: 'NEXT_REDIRECT;replace;/sign-in;307;',
    })
    const record = vi.fn<RecordOutcome>().mockRejectedValueOnce(redirect)
    render(
      <ProblemOutcome binding={outcomeBinding(record)} hasNote>
        {NOTE}
      </ProblemOutcome>,
    )
    await user.click(screen.getByRole('button', { name: 'Chưa giải được' }))
    await vi.waitFor(() => expect(record).toHaveBeenCalledOnce())
    expect(screen.getByRole('status').textContent).toBe('')
    // Not stuck busy: every grade is available again.
    await vi.waitFor(() =>
      expect(screen.getByRole('button', { name: 'Tự giải được' })).toHaveProperty(
        'disabled',
        false,
      ),
    )
  })
})

describe('ProblemOutcome — the solution-reveal nudge (decision 18)', () => {
  it('"Xem lời giải" before grading preselects "Cần gợi ý"; another grade is still possible', async () => {
    const { user, record } = setup()
    const hint = screen.getByRole('button', { name: 'Cần gợi ý' })
    expect(hint.getAttribute('aria-pressed')).toBe('false')
    await user.click(screen.getByRole('button', { name: 'Xem lời giải' }))
    expect(hint.getAttribute('aria-pressed')).toBe('true')
    expect(hint.dataset.variant).toBe('primary')
    expect(
      screen.getByText(
        'Bạn đã xem lời giải nên "Cần gợi ý" được chọn sẵn — bấm để lưu, hoặc chọn mức khác.',
      ),
    ).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Tự giải được' }))
    expect(record.mock.calls[0]![0].outcome).toEqual({ type: 'item.result', result: 'solved' })
  })

  it('pressing the preselected "Cần gợi ý" records hint', async () => {
    const { user, record } = setup()
    await user.click(screen.getByRole('button', { name: 'Xem lời giải' }))
    await user.click(screen.getByRole('button', { name: 'Cần gợi ý' }))
    expect(record.mock.calls[0]![0].outcome).toEqual({ type: 'item.result', result: 'hint' })
  })

  it('a reveal after grading changes nothing', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: 'Tự giải được' }))
    await screen.findByText('Đã lưu kết quả.')
    await user.click(screen.getByRole('button', { name: 'Xem lời giải' }))
    expect(screen.getByRole('button', { name: 'Tự giải được' }).getAttribute('aria-pressed')).toBe(
      'true',
    )
    expect(screen.getByRole('button', { name: 'Cần gợi ý' }).getAttribute('aria-pressed')).toBe(
      'false',
    )
  })
})

describe('ProblemOutcome — redo', () => {
  it('uses the solve labels and sends mode: redo', async () => {
    const { user, record } = setup({ mode: 'redo' })
    expect(screen.getByTestId('note')).toBeTruthy()
    expect(
      screen.getByText('Giải lại trên LeetCode từ đầu, không mở lời giải, rồi tự chấm.'),
    ).toBeTruthy()
    await user.click(within(grades(SOLVE)).getByRole('button', { name: 'Cần gợi ý' }))
    expect(record.mock.calls[0]![0].outcome).toEqual({
      type: 'item.result',
      result: 'hint',
      mode: 'redo',
    })
  })
})

describe('ProblemOutcome — quick recall and explain-aloud (decision 17)', () => {
  it.each(['recall', 'explain-aloud'] as const)(
    '%s: first the prompt, the note behind "Xem ghi chú", then the recall grades with mode: recall',
    async (mode) => {
      const { user, record } = setup({ mode })
      expect(
        screen.getByRole('heading', { name: 'Nêu pattern, cách làm và độ phức tạp' }),
      ).toBeTruthy()
      expect(screen.queryByTestId('note')).toBeNull()
      expect(screen.queryByRole('group', { name: RECALL })).toBeNull()
      const show = screen.getByRole('button', { name: 'Xem ghi chú' })
      expect(show.getAttribute('aria-expanded')).toBe('false')
      await user.click(show)
      expect(screen.getByTestId('note')).toBeTruthy()
      expect(
        within(grades(RECALL))
          .getAllByRole('button')
          .map((button) => button.textContent),
      ).toEqual(['Nhớ rõ', 'Nhớ một phần', 'Không nhớ'])
      await user.click(screen.getByRole('button', { name: 'Nhớ một phần' }))
      expect(record).toHaveBeenCalledExactlyOnceWith({
        requestId: REQUEST_ID,
        itemId: 'dsa:lc-0001',
        outcome: { type: 'item.result', result: 'hint', mode: 'recall' },
      })
    },
  )

  it('without a visible note the recall grades show at once', () => {
    setup({ mode: 'recall' }, false)
    expect(screen.queryByRole('button', { name: 'Xem ghi chú' })).toBeNull()
    expect(grades(RECALL)).toBeTruthy()
    // The page's "Chưa có ghi chú" (the children) shows as it is.
    expect(screen.getByTestId('note')).toBeTruthy()
  })

  it('the nudge preselects "Nhớ một phần" once the solution is revealed', async () => {
    const { user } = setup({ mode: 'recall' })
    await user.click(screen.getByRole('button', { name: 'Xem ghi chú' }))
    await user.click(screen.getByRole('button', { name: 'Xem lời giải' }))
    expect(screen.getByRole('button', { name: 'Nhớ một phần' }).getAttribute('aria-pressed')).toBe(
      'true',
    )
  })

  it('"Làm lại từ đầu" switches a recall to redo (§5.5)', async () => {
    const { user, record } = setup({ mode: 'recall' })
    await user.click(screen.getByRole('button', { name: 'Làm lại từ đầu' }))
    expect(
      screen.queryByRole('heading', { name: 'Nêu pattern, cách làm và độ phức tạp' }),
    ).toBeNull()
    expect(screen.getByTestId('note')).toBeTruthy()
    await user.click(within(grades(SOLVE)).getByRole('button', { name: 'Tự giải được' }))
    expect(record.mock.calls[0]![0].outcome).toEqual({
      type: 'item.result',
      result: 'solved',
      mode: 'redo',
    })
  })

  it('a recall graded, then "Làm lại từ đầu": the answer keeps the recall label; the same grade in the redo is a new result (parked #2)', async () => {
    const { user, record } = setup({ mode: 'recall' }, false)
    await user.click(within(grades(RECALL)).getByRole('button', { name: 'Nhớ rõ' }))
    await screen.findByText('Đã lưu kết quả.')
    await user.click(screen.getByRole('button', { name: 'Làm lại từ đầu' }))
    // The answer was a recall: its label stays "Nhớ rõ", not the redo's "Tự giải được".
    expect(screen.getByRole('status').textContent).toBe('Nhớ rõ: Đã lưu kết quả.')
    // Nothing of the redo is saved yet: no redo grade is pressed.
    const solve = grades(SOLVE)
    expect(
      within(solve)
        .getAllByRole('button')
        .map((button) => button.getAttribute('aria-pressed')),
    ).toEqual(['false', 'false', 'false'])
    // The redo's "Tự giải được" is its own result (mode: redo), not the recall's again.
    await user.click(within(solve).getByRole('button', { name: 'Tự giải được' }))
    expect(record).toHaveBeenCalledTimes(2)
    expect(record.mock.calls[1]![0].outcome).toEqual({
      type: 'item.result',
      result: 'solved',
      mode: 'redo',
    })
    await vi.waitFor(() =>
      expect(screen.getByRole('status').textContent).toBe('Tự giải được: Đã lưu kết quả.'),
    )
  })
})
