import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type * as React from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { TrackOption } from '@/lib/content/track-options'
import type { OnboardingState } from '../schema'
import { OnboardingWizard } from './onboarding-wizard'

const REQUEST_ID = '0f8d6a52-3b1c-4d7e-9a2f-6c5b4e3d2a10'
/** 10:00 in Ho Chi Minh City (local day 2026-09-24); 00:30 in St. John's (still the 23rd at 04:00). */
const NOW = '2026-09-24T03:00:00.000Z'
const DSA_TITLE = 'Cấu trúc dữ liệu & Giải thuật'
const ENGLISH_TITLE = 'Tiếng Anh cho môi trường IT'

const TRACKS: TrackOption[] = [
  {
    id: 'dsa',
    title: DSA_TITLE,
    accent: 'track-1',
    defaultBudgetMinutes: 60,
    roadmaps: [{ id: '8w', recommendedBelowMinutes: 75 }, { id: '10w' }],
    codeLanguages: ['python', 'java', 'go'],
    template: [
      { label: 'Thứ 2 – Thứ 6', blocks: ['Ôn tập (tối đa 15 phút)', 'Bài mới'] },
      { label: 'Thứ 7', blocks: ['Ôn tập'] },
    ],
    throttle: [],
  },
  {
    id: 'english',
    title: ENGLISH_TITLE,
    accent: 'track-2',
    defaultBudgetMinutes: 25,
    roadmaps: [{ id: '10w' }],
    codeLanguages: [],
    template: [{ label: 'Chủ nhật', blocks: ['Nhiệm vụ cuối tuần · 15 phút', 'Ôn tập'] }],
    throttle: ['Tối đa 8 thẻ mới mỗi ngày'],
  },
]

// jsdom runs in America/St_Johns (vitest.config.ts); the wizard preselects the browser's zone
// when the server's list has it.
const TIME_ZONES = ['America/St_Johns', 'Asia/Ho_Chi_Minh', 'Europe/London'] as const

type Action = (state: OnboardingState, formData: FormData) => Promise<OnboardingState>

function setup(props: Partial<React.ComponentProps<typeof OnboardingWizard>> = {}) {
  const action = vi.fn<Action>(async () => ({ status: 'idle' }))
  const view = render(
    <OnboardingWizard
      tracks={TRACKS}
      timeZones={TIME_ZONES}
      now={NOW}
      requestId={REQUEST_ID}
      action={props.action ?? action}
      {...props}
    />,
  )
  return { action, view, user: userEvent.setup() }
}

type User = ReturnType<typeof userEvent.setup>

const stepHeading = (name: string) => screen.getByRole('heading', { level: 2, name })
const currentHeading = () => screen.getByRole('heading', { level: 2 })
const next = (user: User) => user.click(screen.getByRole('button', { name: 'Tiếp tục' }))
const back = (user: User) => user.click(screen.getByRole('button', { name: 'Quay lại' }))
const minutesField = (title: string) => screen.getByRole('spinbutton', { name: title })

/** The card's accessible name is the title followed by the suggested-minutes chip. */
const trackCheckbox = (title: string) =>
  screen.getByRole('checkbox', { name: (name) => name.startsWith(title) })

async function pick(user: User, ...titles: string[]) {
  for (const title of titles) await user.click(trackCheckbox(title))
}

async function setMinutes(user: User, title: string, value: string) {
  const field = minutesField(title)
  await user.clear(field)
  if (value !== '') await user.type(field, value)
}

describe('OnboardingWizard — step 1, tracks', () => {
  it('lists every track as a checkbox card and starts on "Chọn lộ trình"', () => {
    setup()
    expect(currentHeading().textContent).toBe('Chọn lộ trình')
    expect(trackCheckbox(DSA_TITLE).getAttribute('aria-checked')).toBe('false')
    expect(trackCheckbox(DSA_TITLE).closest('label')?.textContent).toContain('60 phút mỗi ngày')
    expect(trackCheckbox(ENGLISH_TITLE).closest('label')?.textContent).toContain('25 phút mỗi ngày')
    expect(screen.queryByRole('button', { name: 'Quay lại' })).toBeNull()
  })

  it('cannot continue with no track', async () => {
    const { user } = setup()
    await next(user)
    expect(currentHeading().textContent).toBe('Chọn lộ trình')
    expect(within(screen.getByRole('alert')).getByText('Chọn ít nhất một lộ trình.')).toBeTruthy()
    // Under the field too (DESIGN_SYSTEM §5): the summary and the field both show it.
    expect(screen.getAllByText('Chọn ít nhất một lộ trình.')).toHaveLength(2)
  })

  it('counts the steps from the selection (variant and language only with DSA)', async () => {
    const { user } = setup()
    await pick(user, ENGLISH_TITLE)
    expect(screen.getByText('Bước 1/4: Chọn lộ trình')).toBeTruthy()
    await pick(user, DSA_TITLE)
    expect(screen.getByText('Bước 1/6: Chọn lộ trình')).toBeTruthy()
  })
})

describe('OnboardingWizard — step 2, minutes', () => {
  it('defaults each track to its budget, with the helper "phút mỗi ngày"', async () => {
    const { user } = setup()
    await pick(user, DSA_TITLE, ENGLISH_TITLE)
    await next(user)
    expect(currentHeading().textContent).toBe('Thời gian mỗi ngày')
    const dsa = minutesField(DSA_TITLE) as HTMLInputElement
    expect(dsa.value).toBe('60')
    expect([dsa.min, dsa.max, dsa.step]).toEqual(['10', '240', '5'])
    expect((minutesField(ENGLISH_TITLE) as HTMLInputElement).value).toBe('25')
    expect(screen.getAllByText('phút mỗi ngày')).toHaveLength(2)
  })

  it.each(['62', '5', '245', ''])(
    'refuses %j minutes with the rule under the field',
    async (value) => {
      const { user } = setup()
      await pick(user, DSA_TITLE)
      await next(user)
      await setMinutes(user, DSA_TITLE, value)
      await next(user)
      expect(currentHeading().textContent).toBe('Thời gian mỗi ngày')
      expect(minutesField(DSA_TITLE).getAttribute('aria-invalid')).toBe('true')
      expect(screen.getAllByText('Nhập số phút từ 10 đến 240, bước 5 phút.')).toHaveLength(2)
    },
  )

  it('moves on with Enter instead of submitting the form', async () => {
    const { user, action } = setup()
    await pick(user, DSA_TITLE)
    await next(user)
    await user.type(minutesField(DSA_TITLE), '{Enter}')
    expect(currentHeading().textContent).toBe('Phiên bản lộ trình')
    expect(action).not.toHaveBeenCalled()
  })
})

describe('OnboardingWizard — step 3, the DSA variant (§5.11, ADR-0015)', () => {
  it('60 min/day preselects "8 tuần" and shows the finish with a decimal comma', async () => {
    const { user } = setup()
    await pick(user, DSA_TITLE)
    await next(user)
    await next(user)
    expect(currentHeading().textContent).toBe('Phiên bản lộ trình')
    expect(screen.getByRole('radio', { name: /^8 tuần/ }).getAttribute('aria-checked')).toBe('true')
    expect(
      screen.getByText(
        'Với 60 phút/ngày, lộ trình 8 tuần thường hoàn thành sau ~12 tuần (90 %: ~12,4 tuần)',
      ),
    ).toBeTruthy()
  })

  it('follows the minutes until the learner picks one; then the pick sticks', async () => {
    const { user } = setup()
    await pick(user, DSA_TITLE)
    await next(user)
    await next(user)
    expect(screen.getByRole('radio', { name: /^8 tuần/ }).getAttribute('aria-checked')).toBe('true')

    await back(user)
    await setMinutes(user, DSA_TITLE, '75')
    await next(user)
    expect(screen.getByRole('radio', { name: /^10 tuần/ }).getAttribute('aria-checked')).toBe(
      'true',
    )

    await user.click(screen.getByRole('radio', { name: /^8 tuần/ }))
    await back(user)
    await setMinutes(user, DSA_TITLE, '90')
    await next(user)
    expect(screen.getByRole('radio', { name: /^8 tuần/ }).getAttribute('aria-checked')).toBe('true')
  })

  it('is skipped when no selected track has more than one roadmap', async () => {
    const { user } = setup()
    await pick(user, ENGLISH_TITLE)
    await next(user)
    await next(user)
    expect(currentHeading().textContent).toBe('Lịch học')
  })
})

describe('OnboardingWizard — step 4, schedule', () => {
  async function toSchedule(user: User) {
    await pick(user, ENGLISH_TITLE)
    await next(user)
    await next(user)
  }

  it("preselects the browser's zone when the list has it, day start 04:00 and today", async () => {
    const { user } = setup()
    await toSchedule(user)
    expect((screen.getByLabelText('Múi giờ') as HTMLSelectElement).value).toBe('America/St_Johns')
    const dayStart = screen.getByLabelText('Ngày mới bắt đầu lúc') as HTMLSelectElement
    expect(dayStart.value).toBe('04:00')
    expect(dayStart.options).toHaveLength(25)
    expect(
      screen.getByText('Học lúc 01:30 vẫn tính cho ngày hôm trước khi ngày mới bắt đầu lúc 04:00.'),
    ).toBeTruthy()
    const start = screen.getByLabelText('Ngày bắt đầu') as HTMLInputElement
    expect([start.value, start.min, start.max]).toEqual(['2026-09-23', '2026-09-23', '2026-11-22'])
  })

  it('keeps Asia/Ho_Chi_Minh when the browser zone is not in the list', async () => {
    const { user } = setup({ timeZones: ['Asia/Ho_Chi_Minh', 'Europe/London'] })
    await toSchedule(user)
    expect((screen.getByLabelText('Múi giờ') as HTMLSelectElement).value).toBe('Asia/Ho_Chi_Minh')
    expect((screen.getByLabelText('Ngày bắt đầu') as HTMLInputElement).value).toBe('2026-09-24')
  })

  it('refuses a start date more than 60 days ahead', async () => {
    const { user } = setup()
    await toSchedule(user)
    fireEvent.change(screen.getByLabelText('Ngày bắt đầu'), { target: { value: '2026-11-23' } })
    await next(user)
    expect(currentHeading().textContent).toBe('Lịch học')
    expect(
      screen.getAllByText('Ngày bắt đầu chỉ được muộn nhất 60 ngày kể từ hôm nay.'),
    ).toHaveLength(2)
  })
})

describe('OnboardingWizard — step 5, code language', () => {
  it('asks for a language with DSA, Python by default', async () => {
    const { user } = setup()
    await pick(user, DSA_TITLE)
    for (let i = 0; i < 4; i++) await next(user)
    expect(currentHeading().textContent).toBe('Ngôn ngữ lập trình')
    expect(screen.getAllByRole('radio')).toHaveLength(3)
    for (const language of ['Java', 'Go']) {
      expect(screen.getByRole('radio', { name: language }).getAttribute('aria-checked')).toBe(
        'false',
      )
    }
    expect(screen.getByRole('radio', { name: 'Python' }).getAttribute('aria-checked')).toBe('true')
  })

  it('is skipped for English only', async () => {
    const { user } = setup()
    await pick(user, ENGLISH_TITLE)
    for (let i = 0; i < 3; i++) await next(user)
    expect(currentHeading().textContent).toBe('Xem trước tuần học')
    expect(screen.getByText('Bước 4/4: Xem trước tuần học')).toBeTruthy()
  })
})

describe('OnboardingWizard — step 6, preview and submit', () => {
  async function toPreview(user: User) {
    await pick(user, DSA_TITLE, ENGLISH_TITLE)
    await next(user) // minutes
    await setMinutes(user, DSA_TITLE, '75')
    await next(user) // variant
    await next(user) // schedule
    await next(user) // language
    await user.click(screen.getByRole('radio', { name: 'Go' }))
    await next(user) // preview
  }

  it('reaching the last step does not submit: "Tiếp tục" never turns into the submit button', async () => {
    // If React re-typed the clicked "Tiếp tục" <button> to type="submit" while handling the click,
    // the browser's activation behaviour would then submit the form (jsdom does not, so the test
    // checks the element: the submit button must be a new one).
    const { user, action } = setup()
    await pick(user, ENGLISH_TITLE)
    await next(user) // minutes
    await next(user) // schedule
    const nextButton = screen.getByRole('button', { name: 'Tiếp tục' })
    await user.click(nextButton)
    expect(currentHeading().textContent).toBe('Xem trước tuần học')
    expect(screen.getByRole('button', { name: 'Bắt đầu học' })).not.toBe(nextButton)
    expect(action).not.toHaveBeenCalled()
  })

  it('shows the weekly template and throttle of every selected track', async () => {
    const { user } = setup()
    await toPreview(user)
    expect(currentHeading().textContent).toBe('Xem trước tuần học')
    expect(screen.getByRole('heading', { level: 3, name: DSA_TITLE })).toBeTruthy()
    expect(screen.getByRole('heading', { level: 3, name: ENGLISH_TITLE })).toBeTruthy()
    expect(screen.getByText('Thứ 2 – Thứ 6')).toBeTruthy()
    expect(screen.getByText('Tối đa 8 thẻ mới mỗi ngày')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Tiếp tục' })).toBeNull()
  })

  it('submits the whole setup as one payload with the page request id', async () => {
    const { user, action } = setup()
    await toPreview(user)
    await user.click(screen.getByRole('button', { name: 'Bắt đầu học' }))
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1))
    const formData = action.mock.calls[0]![1]
    expect(JSON.parse(String(formData.get('payload')))).toEqual({
      requestId: REQUEST_ID,
      tracks: [
        { trackId: 'dsa', budgetMinutes: 75, roadmapVariant: '10w' },
        { trackId: 'english', budgetMinutes: 25, roadmapVariant: '10w' },
      ],
      startDate: '2026-09-23',
      timezone: 'America/St_Johns',
      dayStartsAt: '04:00',
      codeLanguage: 'go',
    })
  })

  it('leaves the code language out for English only', async () => {
    const { user, action } = setup()
    await pick(user, ENGLISH_TITLE)
    for (let i = 0; i < 3; i++) await next(user)
    await user.click(screen.getByRole('button', { name: 'Bắt đầu học' }))
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1))
    const payload = JSON.parse(String(action.mock.calls[0]![1].get('payload')))
    expect(payload).not.toHaveProperty('codeLanguage')
  })

  it('keeps the pressed button busy and ignores a second submit while saving', async () => {
    // Resolved at the end: React entangles every later transition with a pending async action,
    // so a promise left pending would stall the following tests.
    let finish: (state: OnboardingState) => void = () => {}
    const action = vi.fn<Action>(
      () => new Promise<OnboardingState>((resolve) => (finish = resolve)),
    )
    const { user } = setup({ action })
    await toPreview(user)
    const submit = screen.getByRole('button', { name: 'Bắt đầu học' })
    await user.click(submit)
    await waitFor(() => expect(submit.getAttribute('aria-busy')).toBe('true'))
    await user.click(submit)
    expect(action).toHaveBeenCalledTimes(1)
    expect(document.activeElement).toBe(submit)
    finish({ status: 'idle' })
    await waitFor(() => expect(submit.getAttribute('aria-busy')).toBeNull())
  })

  it('shows a server error in the summary and returns to the step of its field', async () => {
    const action = vi.fn<Action>(async () => ({
      status: 'error',
      formError: null,
      fieldErrors: { timezone: 'Múi giờ không hợp lệ.' },
    }))
    const { user } = setup({ action })
    await toPreview(user)
    await user.click(screen.getByRole('button', { name: 'Bắt đầu học' }))
    await waitFor(() => expect(currentHeading().textContent).toBe('Lịch học'))
    const summary = screen.getByRole('alert')
    expect(within(summary).getByText('Múi giờ không hợp lệ.')).toBeTruthy()
    expect(screen.getByLabelText('Múi giờ').getAttribute('aria-invalid')).toBe('true')
    expect(document.activeElement).toBe(summary)
  })

  it('shows a form-level error (quota) in the summary on the last step', async () => {
    const quota = 'Bạn đã ghi nhận quá nhiều hoạt động hôm nay. Hãy thử lại vào ngày mai.'
    const action = vi.fn<Action>(async () => ({
      status: 'error',
      formError: quota,
      fieldErrors: {},
    }))
    const { user } = setup({ action })
    await toPreview(user)
    await user.click(screen.getByRole('button', { name: 'Bắt đầu học' }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain(quota))
    expect(currentHeading().textContent).toBe('Xem trước tuần học')
  })

  it('renders an initial error state on the step of its first field (catalog)', () => {
    setup({
      initialState: {
        status: 'error',
        formError: null,
        fieldErrors: { startDate: 'Ngày bắt đầu chỉ được muộn nhất 60 ngày kể từ hôm nay.' },
      },
    })
    expect(currentHeading().textContent).toBe('Lịch học')
    expect(within(screen.getByRole('alert')).getByRole('link').getAttribute('href')).toMatch(
      /^#.+-start-date$/,
    )
  })
})

describe('OnboardingWizard — focus', () => {
  it('moves focus to the step heading on every step change', async () => {
    const { user } = setup()
    await pick(user, DSA_TITLE)
    await next(user)
    expect(document.activeElement).toBe(stepHeading('Thời gian mỗi ngày'))
    await next(user)
    expect(document.activeElement).toBe(stepHeading('Phiên bản lộ trình'))
    await back(user)
    expect(document.activeElement).toBe(stepHeading('Thời gian mỗi ngày'))
  })

  it('does not steal focus on the first render', () => {
    setup()
    expect(document.activeElement).toBe(document.body)
  })
})

describe('OnboardingWizard — no active track (RF-4)', () => {
  it('shows an empty state instead of a wizard that cannot be completed', () => {
    const { view } = setup({ tracks: [] })
    expect(
      screen.getByRole('heading', { level: 2, name: 'Chưa có lộ trình nào để học' }),
    ).toBeTruthy()
    expect(
      screen.getByText('Các lộ trình sẽ xuất hiện ở đây khi được mở. Bạn quay lại sau nhé.'),
    ).toBeTruthy()
    expect(view.container.querySelector('form')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Tiếp tục' })).toBeNull()
  })
})
