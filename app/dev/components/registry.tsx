'use client'

import { Clock, Inbox, Info, Plus, Settings, Trophy } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import type * as React from 'react'
import { AppShell } from '@/components/patterns/app-shell'
import { Banner } from '@/components/patterns/banner'
import { CalendarHeatmap, type HeatmapDay } from '@/components/patterns/calendar-heatmap'
import { ConfirmDialog } from '@/components/patterns/confirm-dialog'
import { DataList } from '@/components/patterns/data-list'
import { DataState } from '@/components/patterns/data-state'
import { EmptyState } from '@/components/patterns/empty-state'
import { ErrorState } from '@/components/patterns/error-state'
import { LoadingState } from '@/components/patterns/loading-state'
import { PageHeader } from '@/components/patterns/page-header'
import { ProgressRing } from '@/components/patterns/progress-ring'
import { Section } from '@/components/patterns/section'
import { StatCard } from '@/components/patterns/stat-card'
import { STATUS_PILL, StatusPill, type PillStatus } from '@/components/patterns/status-pill'
import { StreakBadge } from '@/components/patterns/streak-badge'
import { ThemeToggle } from '@/components/patterns/theme-toggle'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/toaster'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

/**
 * Every component with its variants and states (platform design §7.7). `file` must match the
 * component's path: tools/guards/component-catalog.test.ts checks both directions, and
 * e2e/components.spec.ts runs axe over the rendered page in light and dark mode.
 */
type Demo = { title: string; render: () => React.ReactNode }
type Entry = { name: string; layer: 'ui' | 'patterns' | 'features'; file: string; demos: Demo[] }

const DEMO_TODAY = '2026-02-04'
const DEMO_USER = 'Nguyễn Văn An'

/** Deterministic sample activity for the 180 days before the demo date. */
const DEMO_DAYS: HeatmapDay[] = Array.from({ length: 180 }, (_, i) => {
  const date = new Date(Date.UTC(2026, 1, 4 - i)).toISOString().slice(0, 10)
  return { day: date, minutes: i % 6 === 5 ? 0 : (i * 37) % 110 }
})

function DialogDemo() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Mở hộp thoại</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Check-in khối học</DialogTitle>
          <DialogDescription>Chọn trạng thái và số phút bạn đã học.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Huỷ</Button>
          </DialogClose>
          <Button>Lưu</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function MenuDemo() {
  const [language, setLanguage] = useState('python')
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">Mở menu mẫu</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>Ngôn ngữ lời giải</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={language} onValueChange={setLanguage}>
          <DropdownMenuRadioItem value="python">Python</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="java">Java</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="go">Go</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <Settings aria-hidden="true" strokeWidth={1.75} />
          Cài đặt
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive">Xoá ghi chú</DropdownMenuItem>
        <DropdownMenuItem disabled>Không khả dụng</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function SheetDemo({ side }: { side: 'bottom' | 'right' }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline">{side === 'bottom' ? 'Mở sheet dưới' : 'Mở sheet phải'}</Button>
      </SheetTrigger>
      <SheetContent side={side}>
        <SheetHeader>
          <SheetTitle>Bộ lọc</SheetTitle>
          <SheetDescription>Lọc thẻ theo trạng thái.</SheetDescription>
        </SheetHeader>
      </SheetContent>
    </Sheet>
  )
}

function ConfirmDemo() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="destructive" onClick={() => setOpen(true)}>
        Xoá tài khoản
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Xoá tài khoản?"
        description="Dữ liệu học của bạn sẽ bị xoá và không thể khôi phục."
        confirmLabel="Xoá"
        tone="destructive"
        onConfirm={() => setOpen(false)}
      />
    </>
  )
}

const PROBLEMS = [
  { id: 'dsa:lc-0001', title: 'Two Sum', status: 'strong' as PillStatus },
  { id: 'dsa:lc-0242', title: 'Valid Anagram', status: 'weak' as PillStatus },
  { id: 'dsa:lc-0049', title: 'Group Anagrams', status: 'not-started' as PillStatus },
]

const emptyCards = <EmptyState icon={Inbox} title="Không có thẻ nào đến hạn" />

export const CATALOG: Entry[] = [
  {
    name: 'Badge',
    layer: 'ui',
    file: 'components/ui/badge.tsx',
    demos: [
      {
        title: 'Tones',
        render: () => (
          <>
            <Badge>Neutral</Badge>
            <Badge tone="primary">Primary</Badge>
            <Badge tone="success">Success</Badge>
            <Badge tone="warning">Warning</Badge>
            <Badge tone="danger">Danger</Badge>
            <Badge tone="outline">Outline</Badge>
            <span data-accent="track-1">
              <Badge tone="track">DSA</Badge>
            </span>
            <span data-accent="track-2">
              <Badge tone="track">English for IT</Badge>
            </span>
          </>
        ),
      },
    ],
  },
  {
    name: 'Button',
    layer: 'ui',
    file: 'components/ui/button.tsx',
    demos: [
      {
        title: 'Variants',
        render: () => (
          <>
            <Button>Check-in</Button>
            <Button variant="secondary">Học thêm</Button>
            <Button variant="outline">Xem lời giải</Button>
            <Button variant="ghost">Bỏ qua</Button>
            <Button variant="destructive">Xoá</Button>
            <Button variant="link">Xem tất cả</Button>
          </>
        ),
      },
      {
        title: 'Sizes',
        render: () => (
          <>
            <Button size="sm">Nhỏ (desktop)</Button>
            <Button size="md">Vừa</Button>
            <Button size="lg">Lớn</Button>
            <Button size="icon" aria-label="Thêm mục">
              <Plus aria-hidden="true" strokeWidth={1.75} />
            </Button>
          </>
        ),
      },
      {
        title: 'States',
        render: () => (
          <>
            <Button disabled>Đã tắt</Button>
            <Button loading>Đang lưu</Button>
            <Button asChild variant="outline">
              <Link href="#button">Liên kết dạng nút</Link>
            </Button>
          </>
        ),
      },
    ],
  },
  {
    name: 'Card',
    layer: 'ui',
    file: 'components/ui/card.tsx',
    demos: [
      {
        title: 'Plain and interactive',
        render: () => (
          <>
            <Card className="w-full max-w-sm">
              <CardHeader>
                <CardTitle>Two Pointers</CardTitle>
                <CardAction>
                  <Badge tone="warning">Tuần 2</Badge>
                </CardAction>
                <CardDescription>Bài học + 1 bài tập · khoảng 55 phút</CardDescription>
              </CardHeader>
              <CardContent>125 Valid Palindrome · 167 Two Sum II</CardContent>
              <CardFooter>
                <Button className="w-full">Check-in</Button>
              </CardFooter>
            </Card>
            <Card interactive className="w-full max-w-sm">
              <CardTitle asChild>
                <h3>
                  <Link href="#card">Thẻ có thể bấm</Link>
                </h3>
              </CardTitle>
              <CardDescription>Di chuột để thấy bóng.</CardDescription>
            </Card>
          </>
        ),
      },
    ],
  },
  {
    name: 'Dialog',
    layer: 'ui',
    file: 'components/ui/dialog.tsx',
    demos: [{ title: 'Trigger and content', render: () => <DialogDemo /> }],
  },
  {
    name: 'DropdownMenu',
    layer: 'ui',
    file: 'components/ui/dropdown-menu.tsx',
    demos: [
      { title: 'Label, radio items, destructive and disabled items', render: () => <MenuDemo /> },
    ],
  },
  {
    name: 'Input',
    layer: 'ui',
    file: 'components/ui/input.tsx',
    demos: [
      {
        title: 'Default, disabled, invalid',
        render: () => (
          <div className="grid w-full max-w-sm gap-4">
            <div className="grid gap-2">
              <Label htmlFor="demo-minutes">Số phút mỗi ngày</Label>
              <Input id="demo-minutes" inputMode="numeric" placeholder="60" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="demo-disabled">Múi giờ</Label>
              <Input id="demo-disabled" disabled value="Asia/Ho_Chi_Minh" readOnly />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="demo-invalid">Email</Label>
              <Input
                id="demo-invalid"
                aria-invalid
                aria-describedby="demo-invalid-error"
                defaultValue="an@"
              />
              <p id="demo-invalid-error" className="text-sm text-danger">
                Email chưa đúng định dạng.
              </p>
            </div>
          </div>
        ),
      },
    ],
  },
  {
    name: 'Label',
    layer: 'ui',
    file: 'components/ui/label.tsx',
    demos: [
      {
        title: 'Label above its field',
        render: () => (
          <div className="grid w-full max-w-sm gap-2">
            <Label htmlFor="demo-label">Tên hiển thị</Label>
            <Input id="demo-label" defaultValue={DEMO_USER} />
          </div>
        ),
      },
    ],
  },
  {
    name: 'Progress',
    layer: 'ui',
    file: 'components/ui/progress.tsx',
    demos: [
      {
        title: '0, 40, 100 and track tone',
        render: () => (
          <div className="grid w-full max-w-sm gap-3">
            <Progress value={0} aria-label="Chưa bắt đầu" />
            <Progress value={40} aria-label="Tiến độ tuần" />
            <Progress value={100} aria-label="Hoàn thành" />
            <div data-accent="track-2">
              <Progress value={65} tone="track" aria-label="English for IT" />
            </div>
          </div>
        ),
      },
    ],
  },
  {
    name: 'Separator',
    layer: 'ui',
    file: 'components/ui/separator.tsx',
    demos: [
      {
        title: 'Horizontal and vertical',
        render: () => (
          <div className="flex w-full max-w-sm flex-col gap-3">
            <p>Trên</p>
            <Separator />
            <div className="flex h-6 items-center gap-3">
              <span>Trái</span>
              <Separator orientation="vertical" />
              <span>Phải</span>
            </div>
          </div>
        ),
      },
    ],
  },
  {
    name: 'Sheet',
    layer: 'ui',
    file: 'components/ui/sheet.tsx',
    demos: [
      {
        title: 'Bottom (mobile) and right',
        render: () => (
          <>
            <SheetDemo side="bottom" />
            <SheetDemo side="right" />
          </>
        ),
      },
    ],
  },
  {
    name: 'Skeleton',
    layer: 'ui',
    file: 'components/ui/skeleton.tsx',
    demos: [
      {
        title: 'Shapes',
        render: () => (
          <div className="flex w-full max-w-sm flex-col gap-2">
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="size-12 rounded-full" />
          </div>
        ),
      },
    ],
  },
  {
    name: 'Tabs',
    layer: 'ui',
    file: 'components/ui/tabs.tsx',
    demos: [
      {
        title: 'Code language tabs',
        render: () => (
          <Tabs defaultValue="python" className="w-full max-w-md">
            <TabsList>
              <TabsTrigger value="python">Python</TabsTrigger>
              <TabsTrigger value="java">Java</TabsTrigger>
              <TabsTrigger value="go">Go</TabsTrigger>
            </TabsList>
            <TabsContent value="python">
              <pre className="overflow-x-auto rounded-md bg-surface-muted p-3 font-mono text-sm">
                def two_sum(nums, target): ...
              </pre>
            </TabsContent>
            <TabsContent value="java">
              <pre className="overflow-x-auto rounded-md bg-surface-muted p-3 font-mono text-sm">
                int[] twoSum(int[] nums, int target) {'{ … }'}
              </pre>
            </TabsContent>
            <TabsContent value="go">
              <pre className="overflow-x-auto rounded-md bg-surface-muted p-3 font-mono text-sm">
                func twoSum(nums []int, target int) []int {'{ … }'}
              </pre>
            </TabsContent>
          </Tabs>
        ),
      },
    ],
  },
  {
    name: 'Textarea',
    layer: 'ui',
    file: 'components/ui/textarea.tsx',
    demos: [
      {
        title: 'Default and disabled',
        render: () => (
          <div className="grid w-full max-w-sm gap-4">
            <div className="grid gap-2">
              <Label htmlFor="demo-note">Ghi chú</Label>
              <Textarea id="demo-note" placeholder="Điều bạn học được hôm nay…" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="demo-note-off">Ghi chú (khoá)</Label>
              <Textarea id="demo-note-off" disabled defaultValue="Đã nộp." />
            </div>
          </div>
        ),
      },
    ],
  },
  {
    name: 'Toaster',
    layer: 'ui',
    file: 'components/ui/toaster.tsx',
    demos: [
      {
        title: 'Show a toast',
        render: () => (
          <Button variant="outline" onClick={() => toast('Đã lưu tiến độ')}>
            Hiện thông báo
          </Button>
        ),
      },
    ],
  },
  {
    name: 'ToggleGroup',
    layer: 'ui',
    file: 'components/ui/toggle-group.tsx',
    demos: [
      {
        title: 'Check-in status (single choice)',
        render: () => (
          <ToggleGroup type="single" defaultValue="done" aria-label="Trạng thái khối học">
            <ToggleGroupItem value="done">Xong</ToggleGroupItem>
            <ToggleGroupItem value="partial">Một phần</ToggleGroupItem>
            <ToggleGroupItem value="skipped">Bỏ qua</ToggleGroupItem>
          </ToggleGroup>
        ),
      },
    ],
  },
  {
    name: 'Tooltip',
    layer: 'ui',
    file: 'components/ui/tooltip.tsx',
    demos: [
      {
        title: 'Icon button with a tooltip',
        render: () => (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon" variant="outline" aria-label="Thông tin">
                <Info aria-hidden="true" strokeWidth={1.75} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>24 thẻ đến hạn hôm nay</TooltipContent>
          </Tooltip>
        ),
      },
    ],
  },
  {
    name: 'AppShell',
    layer: 'patterns',
    file: 'components/patterns/app-shell/index.tsx',
    demos: [
      {
        title: 'Admin (sidebar ≥ 1024 px, bottom nav below)',
        render: () => (
          // transform-gpu makes this box the containing block of the fixed bottom navigation.
          <div className="relative h-96 w-full transform-gpu overflow-hidden rounded-lg border border-border">
            <AppShell user={{ name: DEMO_USER }} isAdmin title="Hôm nay" onSignOut={() => {}}>
              <PageHeader title="Hôm nay học gì?" />
            </AppShell>
          </div>
        ),
      },
    ],
  },
  {
    name: 'Banner',
    layer: 'patterns',
    file: 'components/patterns/banner.tsx',
    demos: [
      {
        title: 'Warning, danger, info',
        render: () => (
          <div className="flex w-full flex-col gap-3">
            <Banner
              tone="warning"
              action={
                <Button size="sm" variant="outline">
                  Học tiếp hôm nay
                </Button>
              }
            >
              Lộ trình đang tạm dừng — hoàn thành ít nhất một phần để tiếp tục.
            </Banner>
            <Banner tone="danger">
              Tuần 4 (DSA) chưa có ghi chú — 1 học viên sẽ tới trong 9 ngày.
            </Banner>
            <Banner tone="info">Đang có 52 thẻ cần ôn — tạm giảm thẻ mới.</Banner>
          </div>
        ),
      },
    ],
  },
  {
    name: 'CalendarHeatmap',
    layer: 'patterns',
    file: 'components/patterns/calendar-heatmap/index.tsx',
    demos: [
      {
        title: 'Year view (≥ 1024 px, mouse) and month view (below, or touch)',
        render: () => <CalendarHeatmap days={DEMO_DAYS} today={DEMO_TODAY} label="Lịch học mẫu" />,
      },
    ],
  },
  {
    name: 'ConfirmDialog',
    layer: 'patterns',
    file: 'components/patterns/confirm-dialog.tsx',
    demos: [{ title: 'Destructive confirmation', render: () => <ConfirmDemo /> }],
  },
  {
    name: 'DataList',
    layer: 'patterns',
    file: 'components/patterns/data-list.tsx',
    demos: [
      {
        title: 'Items and empty',
        render: () => (
          <div className="grid w-full gap-4 md:grid-cols-2">
            <DataList
              label="Bài tập tuần 1"
              items={PROBLEMS}
              getKey={(p) => p.id}
              renderItem={(p) => (
                <>
                  <span className="flex-1">{p.title}</span>
                  <StatusPill status={p.status} />
                </>
              )}
              empty={emptyCards}
            />
            <DataList items={[]} getKey={String} renderItem={String} empty={emptyCards} />
          </div>
        ),
      },
    ],
  },
  {
    name: 'DataState',
    layer: 'patterns',
    file: 'components/patterns/data-state.tsx',
    demos: [
      {
        title: 'Loading, empty, error, ready',
        render: () => (
          <div className="grid w-full gap-4 md:grid-cols-2">
            <DataState state={{ status: 'loading' }} empty={emptyCards}>
              {() => null}
            </DataState>
            <DataState state={{ status: 'empty' }} empty={emptyCards}>
              {() => null}
            </DataState>
            <DataState state={{ status: 'error', retry: () => {} }} empty={emptyCards}>
              {() => null}
            </DataState>
            <DataState state={{ status: 'ready', data: 24 }} empty={emptyCards}>
              {(count) => <p>{count} thẻ đến hạn</p>}
            </DataState>
          </div>
        ),
      },
    ],
  },
  {
    name: 'EmptyState',
    layer: 'patterns',
    file: 'components/patterns/empty-state.tsx',
    demos: [
      {
        title: 'Link and button actions',
        render: () => (
          <div className="grid w-full gap-4 md:grid-cols-2">
            <EmptyState
              icon={Inbox}
              title="Chưa có ghi chú"
              description="Ghi chú giúp bạn nhớ lâu hơn."
              action={{ label: 'Về hôm nay', href: '#empty-state' }}
            />
            <EmptyState
              icon={Trophy}
              title="Tuần này chưa có bài"
              action={{ label: 'Học thêm', onClick: () => {} }}
            />
          </div>
        ),
      },
    ],
  },
  {
    name: 'ErrorState',
    layer: 'patterns',
    file: 'components/patterns/error-state.tsx',
    demos: [
      {
        title: 'With and without retry',
        render: () => (
          <div className="grid w-full gap-4 md:grid-cols-2">
            <ErrorState onRetry={() => {}} />
            <ErrorState title="Không lưu được check-in" description="Kết nối bị gián đoạn." />
          </div>
        ),
      },
    ],
  },
  {
    name: 'LoadingState',
    layer: 'patterns',
    file: 'components/patterns/loading-state.tsx',
    demos: [
      {
        title: 'List, card, page',
        render: () => (
          <div className="grid w-full gap-6">
            <LoadingState variant="list" />
            <LoadingState variant="card" rows={2} />
            <LoadingState variant="page" rows={2} />
          </div>
        ),
      },
    ],
  },
  {
    name: 'PageHeader',
    layer: 'patterns',
    file: 'components/patterns/page-header.tsx',
    demos: [
      {
        title: 'Title, description, actions',
        render: () => (
          <div className="w-full">
            <PageHeader
              title="Tiến độ"
              description="Thứ Ba, 3 tháng 2, 2026"
              actions={<Button variant="outline">Xuất dữ liệu</Button>}
            />
          </div>
        ),
      },
    ],
  },
  {
    name: 'ProgressRing',
    layer: 'patterns',
    file: 'components/patterns/progress-ring.tsx',
    demos: [
      {
        title: 'Sizes and tones',
        render: () => (
          <>
            <ProgressRing value={25} label="Tổng tiến độ" size="sm" />
            <ProgressRing value={60} label="Tiến độ tuần" />
            <span data-accent="track-1">
              <ProgressRing value={85} label="Tiến độ DSA" tone="track" size="lg" />
            </span>
          </>
        ),
      },
    ],
  },
  {
    name: 'Section',
    layer: 'patterns',
    file: 'components/patterns/section.tsx',
    demos: [
      {
        title: 'Titled region',
        render: () => (
          <div className="w-full">
            <Section
              title="Ôn tập đến hạn"
              description="Ưu tiên thẻ Yếu trước."
              actions={<Button variant="ghost">Xem tất cả</Button>}
            >
              <p>24 thẻ</p>
            </Section>
          </div>
        ),
      },
    ],
  },
  {
    name: 'StatCard',
    layer: 'patterns',
    file: 'components/patterns/stat-card.tsx',
    demos: [
      {
        title: 'Number and text values',
        render: () => (
          <div className="grid w-full gap-3 md:grid-cols-3">
            <StatCard label="Phút tuần này" value={245} icon={Clock} hint="Mục tiêu 300 phút" />
            <StatCard label="Thẻ đã thuộc" value={1234} />
            <StatCard label="Dự kiến xong" value="12,4 tuần" />
          </div>
        ),
      },
    ],
  },
  {
    name: 'StatusPill',
    layer: 'patterns',
    file: 'components/patterns/status-pill.tsx',
    demos: [
      {
        title: 'Every status (24 px)',
        render: () =>
          (Object.keys(STATUS_PILL) as PillStatus[]).map((status) => (
            <StatusPill key={status} status={status} />
          )),
      },
      {
        title: 'Filter chip size (32 px)',
        render: () => (
          <>
            <StatusPill status="weak" size="md" />
            <StatusPill status="mastered" size="md" />
          </>
        ),
      },
    ],
  },
  {
    name: 'StreakBadge',
    layer: 'patterns',
    file: 'components/patterns/streak-badge.tsx',
    demos: [{ title: 'Twelve days', render: () => <StreakBadge days={12} /> }],
  },
  {
    name: 'ThemeToggle',
    layer: 'patterns',
    file: 'components/patterns/theme-toggle.tsx',
    demos: [{ title: 'Light, dark, system', render: () => <ThemeToggle /> }],
  },
]
