import { useState } from 'react'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { NotesSharing } from '@/features/settings/components/notes-sharing'
import type { SettingsAction } from '@/features/settings/schema'
import type { Entry } from '../types'

/** `/dev/components` entries of notes sharing (task 6.7b, Part B-M6 decision 3). */

const DEMO_REQUEST_ID = '5c9e3d3f-1a2b-4c5d-8e6f-7a8b9c0d1e2f'

const demoSave: SettingsAction = async () => ({ ok: true, message: 'Đã lưu (bản demo).' })
const demoAiOffFailure: SettingsAction = async () => ({
  ok: false,
  message: 'Tính năng này chỉ dùng được khi tài khoản bật cá nhân hoá AI.',
})

/** components/ui/switch.tsx (task 6.7b, no components/ui entries file of its own — decision 3). */
function SwitchDemo() {
  const [checked, setChecked] = useState(false)
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Switch id="demo-switch-on" checked={checked} onCheckedChange={setChecked} />
        <Label htmlFor="demo-switch-on">Bật/tắt</Label>
      </div>
      <div className="flex items-center gap-2">
        <Switch id="demo-switch-off" checked={false} disabled onCheckedChange={() => {}} />
        <Label htmlFor="demo-switch-off">Đã tắt (disabled), chưa bật</Label>
      </div>
      <div className="flex items-center gap-2">
        <Switch id="demo-switch-checked-disabled" checked disabled onCheckedChange={() => {}} />
        <Label htmlFor="demo-switch-checked-disabled">Đã tắt (disabled), đang bật</Label>
      </div>
    </div>
  )
}

export const NOTES_SHARING_ENTRIES: Entry[] = [
  {
    name: 'Switch',
    layer: 'ui',
    file: 'components/ui/switch.tsx',
    demos: [{ title: 'Bật, tắt, vô hiệu hoá', render: () => <SwitchDemo /> }],
  },
  {
    name: 'NotesSharing',
    layer: 'features',
    file: 'features/settings/components/notes-sharing.tsx',
    demos: [
      {
        title: 'AI cá nhân hoá đang tắt: không hiện gì',
        render: () => (
          <div className="w-full max-w-2xl">
            <NotesSharing
              aiPersonalization={false}
              shareNotesWithAi={false}
              requestId={DEMO_REQUEST_ID}
              updateNotesSharing={demoSave}
            />
          </div>
        ),
      },
      {
        title: 'AI cá nhân hoá đang bật, chưa chia sẻ ghi chú',
        render: () => (
          <div className="w-full max-w-2xl">
            <NotesSharing
              aiPersonalization
              shareNotesWithAi={false}
              requestId={DEMO_REQUEST_ID}
              updateNotesSharing={demoSave}
            />
          </div>
        ),
      },
      {
        title: 'Đang chia sẻ ghi chú',
        render: () => (
          <div className="w-full max-w-2xl">
            <NotesSharing
              aiPersonalization
              shareNotesWithAi
              requestId={DEMO_REQUEST_ID}
              updateNotesSharing={demoSave}
            />
          </div>
        ),
      },
      {
        title: 'Lưu thất bại: trang cũ, AI cá nhân hoá đã tắt ở nơi khác',
        render: () => (
          <div className="w-full max-w-2xl">
            <NotesSharing
              aiPersonalization
              shareNotesWithAi={false}
              requestId={DEMO_REQUEST_ID}
              updateNotesSharing={demoAiOffFailure}
            />
          </div>
        ),
      },
    ],
  },
]
