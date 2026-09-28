import type { AdminActionResult } from '@/features/admin/actions'
import type { BotControlsView } from '@/features/admin/bot'
import { AiFlagToggle } from '@/features/admin/components/ai-flag-toggle'
import { BotControls } from '@/features/admin/components/bot-controls'
import { BotToken } from '@/features/admin/components/bot-token'
import { vi } from '@/lib/i18n/vi'
import type { Entry } from '../types'

/** `/dev/components` entries of `/admin/bot` (task 6.3, 6.4a, Part B-M6 decision 3). */

const copy = vi.adminBot

// Row names are constants: e2e/components.spec.ts reads every quoted `name` property in the
// catalog files as a catalog entry name.
const DEMO_LEARNER = 'Trần Thị Bình'

const demoSaved = async (): Promise<AdminActionResult> => ({
  ok: true,
  message: copy.results.saved,
})
const demoFailed = async (): Promise<AdminActionResult> => ({
  ok: false,
  message: copy.errors.failed,
})
const demoAiOn = async (): Promise<AdminActionResult> => ({
  ok: true,
  message: copy.results.aiOn,
})
/** A demo token: `hdb_` + 43 characters, obviously fake (never a real credential). */
const demoRotate = async () => ({
  ok: true as const,
  token: `hdb_${'x'.repeat(43)}`,
  message: copy.results.rotated,
})
const demoRotateFailed = async () => ({ ok: false as const, message: copy.errors.rotateFailed })

const SEEDED: BotControlsView = {
  enabled: false,
  dryRun: true,
  contentProposals: false,
  perRunUserCap: 10,
  capMax: 100,
}

export const ADMIN_BOT_ENTRIES: Entry[] = [
  {
    name: 'BotControls',
    layer: 'features',
    file: 'features/admin/components/bot-controls.tsx',
    demos: [
      {
        title: 'Như lúc mới cài (bot tắt, chạy thử, 10 người mỗi lần)',
        render: () => <BotControls controls={SEEDED} updateBotSettings={demoSaved} />,
      },
      {
        title: 'Lưu thất bại: công tắc trở lại, thông báo bên cạnh và toast',
        render: () => (
          <BotControls
            controls={{ ...SEEDED, enabled: true, dryRun: false, perRunUserCap: 25 }}
            updateBotSettings={demoFailed}
          />
        ),
      },
    ],
  },
  {
    name: 'BotToken',
    layer: 'features',
    file: 'features/admin/components/bot-token.tsx',
    demos: [
      {
        title: 'Chưa có token (bấm "Tạo token mới" để xem token hiện một lần)',
        render: () => <BotToken token={{ state: 'none' }} rotateBotToken={demoRotate} />,
      },
      {
        title: 'Đang có token',
        render: () => (
          <BotToken
            token={{ state: 'set', createdAt: '09:30, 28 tháng 9, 2026', previousValidUntil: null }}
            rotateBotToken={demoRotate}
          />
        ),
      },
      {
        title: 'Trong 24 giờ chuyển tiếp; tạo token thất bại',
        render: () => (
          <BotToken
            token={{
              state: 'set',
              createdAt: '09:30, 28 tháng 9, 2026',
              previousValidUntil: '09:30, 29 tháng 9, 2026',
            }}
            rotateBotToken={demoRotateFailed}
          />
        ),
      },
    ],
  },
  {
    name: 'AiFlagToggle',
    layer: 'features',
    file: 'features/admin/components/ai-flag-toggle.tsx',
    demos: [
      {
        title: 'Tài khoản đang hoạt động: tắt, bật',
        render: () => (
          <div className="flex flex-col gap-4">
            <AiFlagToggle
              user={{
                id: 'demo-ai-off',
                name: DEMO_LEARNER,
                status: 'active',
                aiPersonalization: false,
              }}
              setAiFlag={demoAiOn}
            />
            <AiFlagToggle
              user={{
                id: 'demo-ai-on',
                name: DEMO_LEARNER,
                status: 'active',
                aiPersonalization: true,
              }}
              setAiFlag={demoAiOn}
            />
          </div>
        ),
      },
      {
        title: 'Tài khoản tạm khoá (vô hiệu); lưu thất bại',
        render: () => (
          <div className="flex flex-col gap-4">
            <AiFlagToggle
              user={{
                id: 'demo-ai-suspended',
                name: DEMO_LEARNER,
                status: 'suspended',
                aiPersonalization: true,
              }}
              setAiFlag={demoAiOn}
            />
            <AiFlagToggle
              user={{
                id: 'demo-ai-failed',
                name: DEMO_LEARNER,
                status: 'active',
                aiPersonalization: false,
              }}
              setAiFlag={demoFailed}
            />
          </div>
        ),
      },
    ],
  },
]
