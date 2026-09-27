import { useState } from 'react'
import {
  ActionStatus,
  useActionFeedback,
  type ActionAnswer,
  type ActionFeedback,
} from '@/components/patterns/action-feedback'
import { LinkList } from '@/components/patterns/link-list'
import { LinkRow } from '@/components/patterns/link-row'
import { Section } from '@/components/patterns/section'
import { StatusPill } from '@/components/patterns/status-pill'
import { TrackProgressCard, weekOfWeeks } from '@/components/patterns/track-progress-card'
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

const DSA = 'Cấu trúc dữ liệu & Giải thuật'
const IN_PROGRESS = { week: 2, weeks: 8, introduced: 18, total: 64 }

export const PATTERN_ENTRIES: Entry[] = [
  {
    name: 'TrackProgressCard',
    layer: 'patterns',
    file: 'components/patterns/track-progress-card.tsx',
    demos: [
      {
        title: 'md (/today): tên lộ trình, tuần, số mục cần ôn',
        render: () => (
          <div className="w-full max-w-sm">
            <TrackProgressCard
              title={DSA}
              accent="track-1"
              progress={IN_PROGRESS}
              headline={DSA}
              facts={[weekOfWeeks(IN_PROGRESS), '3 mục cần ôn']}
            />
          </div>
        ),
      },
      {
        title: 'lg (trang lộ trình): tuần, số bài chính, hành động',
        render: () => (
          <div className="w-full max-w-lg">
            <TrackProgressCard
              title={DSA}
              accent="track-1"
              progress={IN_PROGRESS}
              size="lg"
              headline={weekOfWeeks(IN_PROGRESS)}
              facts={['18/64 bài chính đã học']}
              actions={<Button variant="outline">Bắt đầu lại</Button>}
            />
          </div>
        ),
      },
      {
        title: 'Người học mới (0 %) và lộ trình chưa có roadmap (không có dòng tuần)',
        render: () => (
          <div className="flex w-full max-w-sm flex-col gap-3">
            <TrackProgressCard
              title={DSA}
              accent="track-1"
              progress={{ week: 1, weeks: 8, introduced: 0, total: 64 }}
              headline={DSA}
              facts={['Tuần 1/8', '0 mục cần ôn']}
            />
            <TrackProgressCard
              title={DSA}
              accent="track-1"
              progress={{ week: 1, weeks: 0, introduced: 0, total: 0 }}
              headline={DSA}
              facts={[weekOfWeeks({ week: 1, weeks: 0, introduced: 0, total: 0 })]}
            />
          </div>
        ),
      },
    ],
  },
  {
    name: 'LinkList',
    layer: 'patterns',
    file: 'components/patterns/link-list.tsx',
    demos: [
      {
        title: 'spaced (mặc định): chủ đề yếu, liên kết quản trị, bản nháp, bài liên quan',
        render: () => (
          <div className="w-full max-w-md">
            <LinkList aria-label="Chủ đề cần củng cố (mẫu)">
              <li>
                <LinkRow
                  href="/t/dsa"
                  title="Arrays & Hashing"
                  meta={['Cấu trúc dữ liệu & Giải thuật', '3 mục yếu']}
                  trailing={<StatusPill status="weak" />}
                />
              </li>
              <li>
                <LinkRow href="/t/dsa" title="Two Pointers" meta={['2 mục yếu']} />
              </li>
            </LinkList>
          </div>
        ),
      },
      {
        title: 'divided: các dòng của một tuần lộ trình, mục yếu',
        render: () => (
          <div className="w-full max-w-md">
            <LinkList variant="divided" aria-label="Bài của tuần (mẫu)">
              <li>
                <LinkRow href="/t/dsa/items/lc-0001" title="Two Sum" titleLang="en" />
              </li>
              <li>
                <LinkRow href="/t/dsa/items/lc-0217" title="Contains Duplicate" titleLang="en" />
              </li>
            </LinkList>
          </div>
        ),
      },
    ],
  },
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
