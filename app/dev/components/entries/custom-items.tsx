import { LinkRow } from '@/components/patterns/link-row'
import { ItemPageFrame } from '@/features/items/components/item-page-frame'
import {
  CustomItemsTab,
  type CustomItemsTabData,
} from '@/features/roadmap/components/custom-items-tab'
import {
  HideCustomItemButton,
  type HideCustomItemAction,
} from '@/features/roadmap/components/hide-custom-item-button'
import { ItemView } from '@/features/roadmap/components/item-view'
import { TrackTabs } from '@/features/roadmap/components/track-tabs'
import { vi } from '@/lib/i18n/vi'
import type { Entry } from '../types'

/** `/dev/components` entries of custom items (task 6.6a, Part B-M6 decision 3). */

const copy = vi.customItems
const DEMO_REQUEST_ID = '6d1f2e3a-4b5c-4d6e-8f70-81a2b3c4d5e6'

const demoHide: HideCustomItemAction = async () => ({ ok: true, message: copy.hide.done })
const demoHideFailed: HideCustomItemAction = async () => ({
  ok: false,
  message: vi.errors.saveFailed,
})

/** A demo row: what the page's registry row renders for a custom card (its front, its tier). */
function demoRow(slug: string, front: string) {
  return (
    <LinkRow
      href={`/t/english/items/${encodeURIComponent(`user:0123456789abcdef:${slug}`)}`}
      title={front}
      titleLang="en"
      meta={['Mở rộng']}
    />
  )
}

const DEMO_ITEMS: CustomItemsTabData = {
  state: 'ready',
  items: [
    {
      itemId: 'user:0123456789abcdef:on-hold',
      title: 'on hold',
      row: demoRow('on-hold', 'on hold'),
      hidden: false,
    },
    {
      itemId: 'user:0123456789abcdef:heads-down',
      title: 'heads-down',
      row: demoRow('heads-down', 'heads-down'),
      hidden: false,
    },
    {
      itemId: 'user:0123456789abcdef:blocker',
      title: 'blocker',
      row: demoRow('blocker', 'blocker'),
      hidden: true,
    },
  ],
}

export const CUSTOM_ITEMS_ENTRIES: Entry[] = [
  {
    name: 'CustomItemsTab',
    layer: 'features',
    file: 'features/roadmap/components/custom-items-tab.tsx',
    demos: [
      {
        title: 'Các mục riêng: đang dùng (có "Ẩn"), rồi mục đã ẩn',
        render: () => (
          <div className="w-full max-w-2xl">
            <CustomItemsTab data={DEMO_ITEMS} hide={demoHide} requestId={DEMO_REQUEST_ID} />
          </div>
        ),
      },
      {
        title: 'Không đọc được mục riêng (lỗi)',
        render: () => (
          <div className="w-full max-w-2xl">
            <CustomItemsTab data={{ state: 'error' }} hide={demoHide} requestId={DEMO_REQUEST_ID} />
          </div>
        ),
      },
      {
        title: 'Không có mục riêng: không hiện gì (trang không có tab)',
        render: () => (
          <div className="w-full max-w-2xl">
            <CustomItemsTab
              data={{ state: 'ready', items: [] }}
              hide={demoHide}
              requestId={DEMO_REQUEST_ID}
            />
          </div>
        ),
      },
    ],
  },
  {
    name: 'HideCustomItemButton',
    layer: 'features',
    file: 'features/roadmap/components/hide-custom-item-button.tsx',
    demos: [
      {
        title: '"Ẩn": hỏi trước, rồi báo kết quả',
        render: () => (
          <HideCustomItemButton
            action={demoHide}
            requestId={DEMO_REQUEST_ID}
            itemId="user:0123456789abcdef:on-hold"
            title="on hold"
          />
        ),
      },
      {
        title: 'Không ẩn được (lỗi)',
        render: () => (
          <HideCustomItemButton
            action={demoHideFailed}
            requestId={DEMO_REQUEST_ID}
            itemId="user:0123456789abcdef:heads-down"
            title="heads-down"
          />
        ),
      },
    ],
  },
  {
    name: 'TrackTabs',
    layer: 'features',
    file: 'features/roadmap/components/track-tabs.tsx',
    demos: [
      {
        title: 'Lộ trình và "Mục riêng"',
        render: () => (
          <div className="w-full max-w-2xl">
            <TrackTabs
              roadmap={<p className="text-sm">Các tuần của lộ trình.</p>}
              custom={
                <CustomItemsTab data={DEMO_ITEMS} hide={demoHide} requestId={DEMO_REQUEST_ID} />
              }
            />
          </div>
        ),
      },
    ],
  },
  {
    name: 'ItemView (mục riêng)',
    layer: 'features',
    file: 'features/roadmap/components/item-view.tsx',
    demos: [
      {
        title: 'Trang của một mục riêng: nhãn "Mục riêng của bạn"',
        render: () => (
          <div className="flex w-full max-w-prose flex-col gap-6">
            <ItemView
              backHref="/t/english"
              trackTitle="Tiếng Anh cho môi trường IT"
              custom
              page={<ItemPageFrame status="active" title={<span lang="en">on hold</span>} />}
            />
          </div>
        ),
      },
    ],
  },
]
