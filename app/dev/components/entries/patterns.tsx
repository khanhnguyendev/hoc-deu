import { useState } from 'react'
import {
  ActionStatus,
  useActionFeedback,
  type ActionAnswer,
  type ActionFeedback,
} from '@/components/patterns/action-feedback'
import { Section } from '@/components/patterns/section'
import { Button } from '@/components/ui/button'
import { vi } from '@/lib/i18n/vi'
import type { Entry } from '../types'

/**
 * `/dev/components` entries of the patterns the M5 fix pass extracted (UI I-3, m-1, m-2; parked
 * #1): each state shown statically, plus a working demo.
 */

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** A settled `useActionFeedback` for a static demo of one state. */
function settled(answer: ActionAnswer | null, pending = false): ActionFeedback {
  return {
    pending,
    answer: answer === null ? null : { ...answer, seq: 1 },
    run: () => {},
    reset: () => {},
  }
}

function StaticControl({ label, feedback }: { label: string; feedback: ActionFeedback }) {
  return (
    <div className="flex flex-col items-start">
      <Button variant="outline" loading={feedback.pending}>
        {label}
      </Button>
      <ActionStatus feedback={feedback} />
    </div>
  )
}

/** Sends a pretend action (0,6 s): it answers, refuses or fails, as chosen. */
function WorkingDemo() {
  const feedback = useActionFeedback()
  const send = (outcome: 'ok' | 'refused' | 'thrown') =>
    feedback.run(async () => {
      await wait(600)
      if (outcome === 'thrown') throw new TypeError('Failed to fetch')
      return outcome === 'ok'
        ? { ok: true, message: vi.extra.add.added }
        : { ok: false, message: vi.extra.add.nothingToAdd }
    })
  return (
    <div className="flex flex-col items-start gap-2">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" loading={feedback.pending} onClick={() => send('ok')}>
          Thành công
        </Button>
        <Button variant="outline" disabled={feedback.pending} onClick={() => send('refused')}>
          Bị từ chối
        </Button>
        <Button variant="outline" disabled={feedback.pending} onClick={() => send('thrown')}>
          Lỗi mạng
        </Button>
      </div>
      <ActionStatus feedback={feedback} spacing="none" />
    </div>
  )
}

/** The control the answer's re-render removes: a toast, and focus on the section heading. */
function RemovedControl({ onDone }: { onDone: () => void }) {
  const feedback = useActionFeedback()
  return (
    <div className="flex flex-col">
      <Button
        size="lg"
        loading={feedback.pending}
        onClick={() =>
          feedback.run(
            async () => {
              await wait(600)
              return { ok: true, message: vi.checkIn.checkedIn.done }
            },
            () => onDone(),
          )
        }
      >
        {vi.checkIn.oneTap}
      </Button>
      <ActionStatus feedback={feedback} />
    </div>
  )
}

function RemovedDemo() {
  const [done, setDone] = useState(false)
  return (
    <div className="w-full">
      <Section title="Kế hoạch mẫu" focusFallback>
        {done ? (
          <Button variant="ghost" onClick={() => setDone(false)}>
            {vi.common.retry}
          </Button>
        ) : (
          <RemovedControl onDone={() => setDone(true)} />
        )}
      </Section>
    </div>
  )
}

export const PATTERN_ENTRIES: Entry[] = [
  {
    name: 'ActionFeedback',
    layer: 'patterns',
    file: 'components/patterns/action-feedback.tsx',
    demos: [
      {
        title: 'Đang gửi (pending: hành động và lần làm mới trang)',
        render: () => <StaticControl label="Học thêm" feedback={settled(null, true)} />,
      },
      {
        title: 'Thành công, nút vẫn còn: chỉ vùng trạng thái của nút (không kèm toast)',
        render: () => (
          <StaticControl
            label="Học thêm"
            feedback={settled({ ok: true, message: vi.extra.add.added })}
          />
        ),
      },
      {
        title: 'Bị từ chối: lý do bên cạnh nút, bấm lại được',
        render: () => (
          <StaticControl
            label="Học thêm"
            feedback={settled({ ok: false, message: vi.extra.add.nothingToAdd })}
          />
        ),
      },
      {
        title: 'Lỗi mạng (thrown): không bao giờ tới error boundary',
        render: () => (
          <StaticControl
            label="Học thêm"
            feedback={settled({ ok: false, message: vi.errors.saveFailed })}
          />
        ),
      },
      { title: 'Chạy thử: thành công, từ chối, lỗi mạng', render: () => <WorkingDemo /> },
      {
        title: 'Nút biến mất sau khi trang làm mới: toast, focus về tiêu đề mục',
        render: () => <RemovedDemo />,
      },
    ],
  },
]
