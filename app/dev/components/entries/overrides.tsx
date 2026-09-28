import { AiOverrides, type AiOverrideView } from '@/features/settings/components/ai-overrides'
import {
  RevokeOverrideButton,
  type RevokeAiOverrideAction,
} from '@/features/settings/components/revoke-override-button'
import { vi } from '@/lib/i18n/vi'
import type { Entry } from '../types'

/** `/dev/components` entries of AI roadmap overrides (task 6.6c, Part B-M6 decision 3). */

const copy = vi.overrides
const DEMO_REQUEST_ID = '7e2a3b4c-5d6e-4f70-8a91-b2c3d4e5f607'
const DSA = 'Cấu trúc dữ liệu & Giải thuật'

const demoRevoke: RevokeAiOverrideAction = async () => ({ ok: true, message: copy.revoke.done })
const demoRevokeFailed: RevokeAiOverrideAction = async () => ({
  ok: false,
  message: vi.errors.saveFailed,
})

const DEMO: AiOverrideView[] = [
  {
    trackId: 'dsa',
    key: 'ah-extra-practice',
    trackTitle: DSA,
    text: 'Thêm 15 phút luyện Arrays & Hashing vào T2, T4, T6 đến 19/10',
    suspended: false,
  },
  {
    trackId: 'dsa',
    key: 'ah-extra-week',
    trackTitle: DSA,
    text: 'Một tuần luyện thêm chủ đề Arrays & Hashing: còn 3 ngày học',
    suspended: false,
  },
  {
    trackId: 'dsa',
    key: 'backtracking-before-heap',
    trackTitle: DSA,
    text: copy.kinds.reorder,
    suspended: false,
  },
]

export const OVERRIDES_ENTRIES: Entry[] = [
  {
    name: 'AiOverrides',
    layer: 'features',
    file: 'features/settings/components/ai-overrides.tsx',
    demos: [
      {
        title: 'Ba điều chỉnh đang áp dụng',
        render: () => (
          <div className="w-full max-w-2xl">
            <AiOverrides
              overrides={DEMO}
              requestId={DEMO_REQUEST_ID}
              revokeAiOverride={demoRevoke}
            />
          </div>
        ),
      },
      {
        title: 'Tạm dừng: đã tắt cá nhân hoá AI',
        render: () => (
          <div className="w-full max-w-2xl">
            <AiOverrides
              overrides={DEMO.map((o) => ({ ...o, suspended: true }))}
              requestId={DEMO_REQUEST_ID}
              revokeAiOverride={demoRevoke}
            />
          </div>
        ),
      },
      {
        title: 'Không có điều chỉnh: không hiện gì',
        render: () => (
          <div className="w-full max-w-2xl">
            <AiOverrides overrides={[]} requestId={DEMO_REQUEST_ID} revokeAiOverride={demoRevoke} />
          </div>
        ),
      },
      {
        title: 'Lỗi: không tải được danh sách',
        render: () => (
          <div className="w-full max-w-2xl">
            <AiOverrides
              overrides={null}
              requestId={DEMO_REQUEST_ID}
              revokeAiOverride={demoRevoke}
            />
          </div>
        ),
      },
    ],
  },
  {
    name: 'RevokeOverrideButton',
    layer: 'features',
    file: 'features/settings/components/revoke-override-button.tsx',
    demos: [
      {
        title: 'Hỏi trước, rồi thu hồi',
        render: () => (
          <RevokeOverrideButton
            action={demoRevoke}
            requestId={DEMO_REQUEST_ID}
            trackId="dsa"
            overrideKey="ah-extra-practice"
            title={DEMO[0]!.text}
          />
        ),
      },
      {
        title: 'Thu hồi thất bại',
        render: () => (
          <RevokeOverrideButton
            action={demoRevokeFailed}
            requestId={DEMO_REQUEST_ID}
            trackId="dsa"
            overrideKey="ah-extra-practice"
            title={DEMO[0]!.text}
          />
        ),
      },
    ],
  },
]
