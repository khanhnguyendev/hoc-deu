'use client'

import { useState } from 'react'
import type * as React from 'react'
import { Button } from '@/components/ui/button'
import type { CheckInResult } from '@/features/checkin/actions'
import { CheckInButton } from '@/features/checkin/components/check-in-button'
import { CheckInSheet, type CheckInSheetBlock } from '@/features/checkin/components/check-in-sheet'
import { CheckInStatus } from '@/features/checkin/components/check-in-status'
import { vi } from '@/lib/i18n/vi'
import type { Entry } from '../types'

/**
 * `/dev/components` entries of features/checkin (tasks 5.2a, 5.2b) — Part B-M5 decision 3: only
 * that task edits this file. The actions answer as `checkInBlock` would and save nothing; the
 * sheet opens from a button here (the page opens it from `/today?block=<id>`), and closing it
 * stays on this page (`onClose`).
 */

const PLAN_ID = '00000000-0000-4000-8000-000000000001'
const BLOCK_ID = '2026-09-28:dsa:new:1'
const DSA = 'Cấu trúc dữ liệu & Giải thuật'
const LABEL = `${vi.today.kind.new} · ${DSA}`
/** The catalog never navigates to /today (the page builds `/today?block=<id>`). */
const EDIT_HREF = '#check-in-sheet'

const answer =
  (result: CheckInResult, delayMs = 600) =>
  () =>
    new Promise<CheckInResult>((resolve) => setTimeout(() => resolve(result), delayMs))

const saved = answer({ ok: true, message: vi.checkIn.checkedIn.done })
const stale = answer({ ok: false, message: vi.checkIn.errors.stale })
const failed = () =>
  new Promise<CheckInResult>((_resolve, reject) =>
    setTimeout(() => reject(new TypeError('Failed to fetch')), 600),
  )

const BLOCK: CheckInSheetBlock = {
  id: BLOCK_ID,
  kindLabel: vi.today.kind.new,
  trackTitle: DSA,
  estMinutes: 19.5,
  defaultMinutes: 20,
  checkIn: null,
}

/** The sheet behind a button: open → the sheet; Esc, "Đóng", "Huỷ" or a save → closed. */
function SheetDemo({
  label,
  block,
  action,
}: {
  label: string
  block: CheckInSheetBlock
  action: () => Promise<CheckInResult>
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        {label}
      </Button>
      {open && (
        <CheckInSheet
          action={action}
          requestId="demo"
          planId={PLAN_ID}
          planVersion={1}
          block={block}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}

const narrow = (node: React.ReactNode) => (
  <div className="flex w-full max-w-xl flex-col gap-4">{node}</div>
)

export const CHECK_IN_ENTRIES: Entry[] = [
  {
    name: 'CheckInButton',
    layer: 'features',
    file: 'features/checkin/components/check-in-button.tsx',
    demos: [
      {
        title:
          'Check-in một chạm: đang lưu, rồi thông báo (nút còn: vùng trạng thái; nút biến mất: toast)',
        render: () =>
          narrow(
            <CheckInButton
              action={saved}
              requestId="demo"
              planId={PLAN_ID}
              planVersion={1}
              blockId={BLOCK_ID}
              blockLabel={LABEL}
            />,
          ),
      },
      {
        title: 'Bị từ chối: thông báo cạnh nút, bấm lại được',
        render: () =>
          narrow(
            <CheckInButton
              action={stale}
              requestId="demo"
              planId={PLAN_ID}
              planVersion={1}
              blockId={BLOCK_ID}
              blockLabel={LABEL}
            />,
          ),
      },
    ],
  },
  {
    name: 'CheckInStatus',
    layer: 'features',
    file: 'features/checkin/components/check-in-status.tsx',
    demos: [
      {
        title: 'Xong',
        render: () =>
          narrow(
            <CheckInStatus
              checkIn={{ status: 'done', minutes: 20, auto: false }}
              editHref={EDIT_HREF}
              blockId={BLOCK_ID}
              blockLabel={LABEL}
            />,
          ),
      },
      {
        title: 'Một phần, tự động',
        render: () =>
          narrow(
            <CheckInStatus
              checkIn={{ status: 'partial', minutes: 25, auto: true }}
              editHref={EDIT_HREF}
              blockId={BLOCK_ID}
              blockLabel={LABEL}
            />,
          ),
      },
      {
        title: 'Bỏ qua, trong kế hoạch tạm dừng (M-6 a)',
        render: () =>
          narrow(
            <CheckInStatus
              checkIn={{ status: 'skipped', minutes: 0, auto: false }}
              editHref={EDIT_HREF}
              blockId={BLOCK_ID}
              blockLabel={LABEL}
              paused
            />,
          ),
      },
    ],
  },
  {
    name: 'CheckInSheet',
    layer: 'features',
    file: 'features/checkin/components/check-in-sheet.tsx',
    demos: [
      {
        title: 'Check-in mới: Xong, số phút điền sẵn (sheet dưới < md, hộp thoại từ md)',
        render: () => <SheetDemo label="Mở check-in mới" block={BLOCK} action={saved} />,
      },
      {
        title: 'Sửa: Một phần, 25 phút, có ghi chú',
        render: () => (
          <SheetDemo
            label="Mở check-in đã có"
            block={{ ...BLOCK, checkIn: { status: 'partial', minutes: 25, note: 'Còn bài 2' } }}
            action={saved}
          />
        ),
      },
      {
        title: 'Lỗi khi lưu: thông báo và "Thử lại"',
        render: () => <SheetDemo label="Mở check-in (lưu lỗi)" block={BLOCK} action={failed} />,
      },
    ],
  },
]
