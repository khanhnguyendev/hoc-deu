'use client'

import { Clock, Inbox, Info, Plus, Settings, Trophy } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import type * as React from 'react'
import { AppShell } from '@/components/patterns/app-shell'
import { Banner } from '@/components/patterns/banner'
import { CalendarHeatmap, type HeatmapDay } from '@/components/patterns/calendar-heatmap'
import { ChoiceCard } from '@/components/patterns/choice-card'
import { CodeBlock } from '@/components/patterns/code-block'
import { ConfirmDialog } from '@/components/patterns/confirm-dialog'
import { DataList } from '@/components/patterns/data-list'
import { DataState } from '@/components/patterns/data-state'
import { EmptyState } from '@/components/patterns/empty-state'
import { FilterChip, FilterChipGroup } from '@/components/patterns/filter-chip'
import { FocusLayout } from '@/components/patterns/focus-layout'
import { FormActions } from '@/components/patterns/form-actions'
import { FormErrorSummary } from '@/components/patterns/form-error-summary'
import { FormField } from '@/components/patterns/form-field'
import { ErrorState } from '@/components/patterns/error-state'
import { LoadingState } from '@/components/patterns/loading-state'
import { PageHeader } from '@/components/patterns/page-header'
import { ProgressRing } from '@/components/patterns/progress-ring'
import { Section } from '@/components/patterns/section'
import { StatCard } from '@/components/patterns/stat-card'
import { StepIndicator } from '@/components/patterns/step-indicator'
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
import { Checkbox } from '@/components/ui/checkbox'
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
import { NativeSelect } from '@/components/ui/native-select'
import { Progress } from '@/components/ui/progress'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
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
import type { AdminActionResult } from '@/features/admin/actions'
import { UserQueue } from '@/features/admin/components/user-queue'
import { UserRowActions } from '@/features/admin/components/user-row-actions'
import type { AdminUserRow } from '@/features/admin/queries'
import { Landing } from '@/features/auth/components/landing'
import { PendingStatus, SignOutButton } from '@/features/auth/components/pending-status'
import { SignInPanel } from '@/features/auth/components/sign-in-panel'
import { StatusWatcher } from '@/features/auth/components/status-watcher'
import { Bilingual } from '@/features/items/components/mdx/bilingual'
import { Callout } from '@/features/items/components/mdx/callout'
import { CodePre } from '@/features/items/components/mdx/code-pre'
import { Complexity } from '@/features/items/components/mdx/complexity'
import { ContentImage } from '@/features/items/components/mdx/content-image'
import { ExternalLink } from '@/features/items/components/mdx/external-link'
import { PracticeCard } from '@/features/items/components/mdx/practice-card'
import { Choice, Question, Quiz } from '@/features/items/components/mdx/quiz'
import { Reveal } from '@/features/items/components/mdx/reveal'
import { Section as MdxSection } from '@/features/items/components/mdx/section'
import { SolutionTabs } from '@/features/items/components/mdx/solution-tabs'
import { Step, Steps } from '@/features/items/components/mdx/steps'
import { Term } from '@/features/items/components/mdx/term'
import { VarTable } from '@/features/items/components/mdx/var-table'
import { mdxComponents as Md } from '@/features/items/mdx/components'
import { OnboardingWizard } from '@/features/onboarding/components/onboarding-wizard'
import type { OnboardingState } from '@/features/onboarding/schema'
import { AddTrackForm } from '@/features/settings/components/add-track-form'
import { AdminLink } from '@/features/settings/components/admin-link'
import { CodeLanguageForm } from '@/features/settings/components/code-language-form'
import { DeleteAccount } from '@/features/settings/components/delete-account'
import { ScheduleForm } from '@/features/settings/components/schedule-form'
import { TrackBudgetFields } from '@/features/settings/components/track-budget-fields'
import { TrackSettings } from '@/features/settings/components/track-settings'
import type { SettingsAction, SettingsTrack } from '@/features/settings/schema'
import { VariantPicker } from '@/features/tracks/components/variant-picker'
import { WeeklyTemplatePreview } from '@/features/tracks/components/weekly-template-preview'
import { codeBlockKey, type CodeBundle } from '@/lib/content/code-tokens'
import type { TrackOption } from '@/lib/content/track-options'
import { vi } from '@/lib/i18n/vi'
import { GO_SAMPLE, JAVA_SAMPLE, LONG_LINE_SAMPLE, PYTHON_SAMPLE } from './code-samples'

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

const FILTERS: PillStatus[] = ['not-started', 'weak', 'ok', 'strong', 'mastered', 'skipped']

function FilterChipDemo() {
  const [on, setOn] = useState<PillStatus[]>(['weak'])
  return (
    <div className="max-w-xs">
      <FilterChipGroup label="Lọc theo trạng thái">
        {FILTERS.map((status) => (
          <FilterChip
            key={status}
            status={status}
            pressed={on.includes(status)}
            onPressedChange={(pressed) =>
              setOn((current) =>
                pressed ? [...current, status] : current.filter((s) => s !== status),
              )
            }
          />
        ))}
      </FilterChipGroup>
    </div>
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

function CheckboxDemo() {
  const [checked, setChecked] = useState(true)
  return (
    <div className="flex items-center gap-2">
      <Checkbox
        id="demo-checkbox"
        checked={checked}
        onCheckedChange={(v) => setChecked(v === true)}
      />
      <Label htmlFor="demo-checkbox">Nhận email nhắc học</Label>
    </div>
  )
}

const PRIORITY_LABEL = { low: 'Thấp', medium: 'Vừa', high: 'Cao' } as const

function RadioGroupDemo() {
  const [value, setValue] = useState<keyof typeof PRIORITY_LABEL>('low')
  return (
    <RadioGroup
      aria-label="Mức độ ưu tiên"
      value={value}
      onValueChange={(next) => setValue(next as keyof typeof PRIORITY_LABEL)}
    >
      {(Object.keys(PRIORITY_LABEL) as (keyof typeof PRIORITY_LABEL)[]).map((option) => (
        <div key={option} className="flex items-center gap-2">
          <RadioGroupItem id={`demo-radio-${option}`} value={option} disabled={option === 'high'} />
          <Label htmlFor={`demo-radio-${option}`}>{PRIORITY_LABEL[option]}</Label>
        </div>
      ))}
    </RadioGroup>
  )
}

function FormFieldDemo() {
  return (
    <div className="grid w-full max-w-sm gap-4">
      <FormField id="demo-form-field" label="Email" description="Dùng để đăng nhập" required>
        {(control) => <Input {...control} type="email" placeholder="ban@vidu.com" />}
      </FormField>
      <FormField
        id="demo-form-field-error"
        label="Số phút mỗi ngày"
        error="Chọn từ 10 đến 240 phút."
      >
        {(control) => <Input {...control} inputMode="numeric" defaultValue="5" />}
      </FormField>
    </div>
  )
}

function ChoiceCardDemo() {
  const [checked, setChecked] = useState(true)
  return (
    <div className="grid w-full max-w-sm gap-3">
      <ChoiceCard
        htmlFor="demo-choice-dsa"
        control={
          <Checkbox
            id="demo-choice-dsa"
            checked={checked}
            onCheckedChange={(v) => setChecked(v === true)}
          />
        }
        title="DSA"
        description="Cấu trúc dữ liệu và giải thuật"
      />
      <ChoiceCard
        htmlFor="demo-choice-eng"
        control={<Checkbox id="demo-choice-eng" checked={false} onCheckedChange={() => {}} />}
        title="English for IT"
        description="Từ vựng và giao tiếp kỹ thuật"
      />
    </div>
  )
}

const PROBLEMS = [
  { id: 'dsa:lc-0001', title: 'Two Sum', status: 'strong' as PillStatus },
  { id: 'dsa:lc-0242', title: 'Valid Anagram', status: 'weak' as PillStatus },
  { id: 'dsa:lc-0049', title: 'Group Anagrams', status: 'not-started' as PillStatus },
]

const emptyCards = <EmptyState icon={Inbox} title="Không có thẻ nào đến hạn" />

/** The admin actions as no-ops: they "succeed" and toast, but nothing changes. */
const demoSetUserStatus = async (): Promise<AdminActionResult> => ({
  ok: true,
  message: vi.admin.results.approved,
})
const demoSetUserRole = async (): Promise<AdminActionResult> => ({
  ok: true,
  message: vi.admin.results.promoted,
})
const demoFailure = async (): Promise<AdminActionResult> => ({
  ok: false,
  message: vi.admin.errors.changed,
})

const demoUser = (user: Partial<AdminUserRow> & Pick<AdminUserRow, 'id'>): AdminUserRow => ({
  email: `${user.id}@example.test`,
  displayName: null,
  role: 'learner',
  status: 'active',
  createdAt: '2026-01-12T02:00:00Z',
  approvedAt: null,
  onboardedAt: null,
  isSelf: false,
  ...user,
})

// Row names are constants: e2e/components.spec.ts reads every quoted `name` property in this
// file as a catalog entry name.
const DEMO_LEARNER = 'Trần Thị Bình'
const DEMO_OTHER_ADMIN = 'Lê Văn Dũng'

const DEMO_ADMIN_USERS: AdminUserRow[] = [
  demoUser({
    id: 'binh',
    displayName: DEMO_LEARNER,
    status: 'pending',
    createdAt: '2026-02-02T09:30:00Z',
  }),
  demoUser({ id: 'cuong', status: 'pending', createdAt: '2026-02-03T20:00:00Z' }),
  demoUser({ id: 'an', displayName: DEMO_USER, role: 'admin', isSelf: true }),
  demoUser({ id: 'dung', displayName: DEMO_OTHER_ADMIN, role: 'admin' }),
  demoUser({ id: 'giang', displayName: 'Phạm Thu Giang' }),
  demoUser({ id: 'hai', displayName: 'Hoàng Minh Hải', status: 'suspended' }),
]

/** The two real tracks as the onboarding loader returns them (`loadTrackOptions()`). */
const DEMO_TRACKS: TrackOption[] = [
  {
    id: 'dsa',
    title: 'Cấu trúc dữ liệu & Giải thuật',
    accent: 'track-1',
    defaultBudgetMinutes: 60,
    roadmaps: [{ id: '8w', recommendedBelowMinutes: 75 }, { id: '10w' }],
    codeLanguages: ['python', 'java', 'go'],
    template: [
      { label: 'Thứ 2 – Thứ 6', blocks: ['Ôn tập (tối đa 15 phút)', 'Bài mới'] },
      { label: 'Thứ 7', blocks: ['Ôn tập'] },
      { label: 'Chủ nhật', blocks: ['Phỏng vấn thử · 45 phút (từ tuần 3)', 'Ôn lại 3 bài'] },
    ],
    throttle: [],
  },
  {
    id: 'english',
    title: 'Tiếng Anh cho môi trường IT',
    accent: 'track-2',
    defaultBudgetMinutes: 25,
    roadmaps: [{ id: '10w' }],
    codeLanguages: [],
    template: [
      {
        label: 'Thứ 2 – Thứ 6',
        blocks: ['Bài tập · 5 phút', 'Shadowing · 3 phút', 'Ôn tập', 'Bài mới'],
      },
      { label: 'Thứ 7', blocks: ['Ôn tập'] },
      { label: 'Chủ nhật', blocks: ['Nhiệm vụ cuối tuần · 15 phút', 'Ôn tập'] },
    ],
    throttle: [
      'Tối đa 8 thẻ mới mỗi ngày',
      'Trên 40 thẻ cần ôn: 4 thẻ mới mỗi ngày',
      'Trên 60 thẻ cần ôn: tạm dừng thẻ mới',
    ],
  },
]
const [DEMO_DSA, DEMO_ENGLISH] = DEMO_TRACKS as [TrackOption, TrackOption]
const DEMO_TIME_ZONES = ['Asia/Bangkok', 'Asia/Ho_Chi_Minh', 'Asia/Singapore', 'Europe/London']
const DEMO_NOW = `${DEMO_TODAY}T03:00:00.000Z`
const DEMO_REQUEST_ID = '0f8d6a52-3b1c-4d7e-9a2f-6c5b4e3d2a10'
const DEMO_ONBOARDING_ERROR: OnboardingState = {
  status: 'error',
  formError: vi.errors.quotaExceeded,
  fieldErrors: { startDate: vi.onboarding.errors.startDateTooLate },
}

/** The onboarding action as a no-op: "Bắt đầu học" returns to the wizard unchanged. */
const demoCompleteOnboarding = async (): Promise<OnboardingState> => ({ status: 'idle' })
const demoFailOnboarding = async (): Promise<OnboardingState> => DEMO_ONBOARDING_ERROR

/** The settings actions as no-ops: they "succeed" (a toast), or fail with a field error. */
const demoSettingsSave: SettingsAction = async () => ({ ok: true, message: 'Đã lưu (bản demo).' })
const demoSettingsFailure: SettingsAction = async () => ({
  ok: false,
  message: vi.settings.errors.fields,
  fieldErrors: { budgetMinutes: vi.onboarding.errors.minutes },
})
const demoDeleteAccountFailure: SettingsAction = async () => ({
  ok: false,
  message: vi.settings.deleteAccount.failed,
})
const DEMO_VN_SCHEDULE = { timezone: 'Asia/Ho_Chi_Minh', dayStartsAt: '04:00' }
const DEMO_SETTINGS_TRACKS: SettingsTrack[] = [
  {
    option: DEMO_DSA,
    enrollment: {
      status: 'active',
      budgetMinutes: 60,
      roadmapVariant: '8w',
      startDate: DEMO_TODAY,
    },
  },
  {
    option: DEMO_ENGLISH,
    enrollment: {
      status: 'paused',
      budgetMinutes: 25,
      roadmapVariant: '10w',
      startDate: DEMO_TODAY,
    },
  },
]
/** DSA removed, English never enrolled: both are offered under "Thêm lộ trình". */
const DEMO_ADDABLE_TRACKS: SettingsTrack[] = [
  {
    option: DEMO_DSA,
    enrollment: {
      status: 'removed',
      budgetMinutes: 90,
      roadmapVariant: '10w',
      startDate: DEMO_TODAY,
    },
  },
  { option: DEMO_ENGLISH, enrollment: null },
]

function TrackBudgetFieldsDemo({ track, minutes }: { track: TrackOption; minutes: string }) {
  const [typed, setTyped] = useState(minutes)
  const [variant, setVariant] = useState(track.roadmaps[0]?.id ?? '')
  return (
    <form aria-label={track.title} className="flex w-full max-w-xl flex-col gap-4">
      <TrackBudgetFields
        track={track}
        minutes={typed}
        onMinutesChange={setTyped}
        variant={variant}
        onVariantChange={setVariant}
        fallbackMinutes={Number(minutes)}
        errors={{}}
      />
    </form>
  )
}

function VariantPickerDemo({
  track,
  budgetMinutes,
}: {
  track: TrackOption
  budgetMinutes: number
}) {
  const [value, setValue] = useState(track.roadmaps[0]?.id ?? '')
  return (
    <div className="flex w-full max-w-xl flex-col gap-2">
      <p id={`demo-variant-${track.id}`} className="font-medium">
        {track.title} · {budgetMinutes} phút/ngày
      </p>
      <VariantPicker
        trackId={track.id}
        name={`demo-variant-${track.id}`}
        roadmaps={track.roadmaps}
        budgetMinutes={budgetMinutes}
        value={value}
        onValueChange={setValue}
        aria-labelledby={`demo-variant-${track.id}`}
      />
    </div>
  )
}

/** MDX content demos (task 3.3b): a highlighted fence and the widths content renders at. */
const DEMO_FENCE = 'seen = {}\nfor i, n in enumerate(nums):\n    seen[n] = i'
const DEMO_CODE: CodeBundle = {
  solutions: {},
  blocks: {
    [codeBlockKey('python', DEMO_FENCE)]: {
      lang: 'python',
      lines: [
        ['seen = ', ['{}', 'constant']],
        [['for', 'keyword'], ' i, n ', ['in', 'keyword'], ' enumerate(nums):'],
        ['    seen[n] = i'],
      ],
    },
  },
}
const PROSE = 'w-full max-w-prose space-y-4'
/** MDX marks a fence's language on its `code` element (not a Tailwind class). */
const fenceClass = (lang: string) => `language-${lang}`

function VarTableDemo({ caption }: { caption?: string }) {
  return (
    <VarTable caption={caption}>
      <Md.table>
        <Md.thead>
          <Md.tr>
            <Md.th>i</Md.th>
            <Md.th>x</Md.th>
            <Md.th>Phần bù</Md.th>
            <Md.th>map</Md.th>
          </Md.tr>
        </Md.thead>
        <Md.tbody>
          <Md.tr>
            <Md.td>0</Md.td>
            <Md.td>2</Md.td>
            <Md.td>7</Md.td>
            <Md.td>
              <Md.code>{'{}'}</Md.code>
            </Md.td>
          </Md.tr>
          <Md.tr>
            <Md.td>1</Md.td>
            <Md.td>7</Md.td>
            <Md.td>2</Md.td>
            <Md.td>
              <Md.code>{'{2: 0}'}</Md.code>
            </Md.td>
          </Md.tr>
        </Md.tbody>
      </Md.table>
    </VarTable>
  )
}

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
    name: 'Checkbox',
    layer: 'ui',
    file: 'components/ui/checkbox.tsx',
    demos: [
      {
        title: 'Checked, unchecked, disabled, invalid',
        render: () => (
          <div className="flex flex-col gap-3">
            <CheckboxDemo />
            <div className="flex items-center gap-2">
              <Checkbox id="demo-checkbox-off" />
              <Label htmlFor="demo-checkbox-off">Chưa chọn</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="demo-checkbox-disabled" disabled checked />
              <Label htmlFor="demo-checkbox-disabled">Đã tắt</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="demo-checkbox-invalid" aria-invalid />
              <Label htmlFor="demo-checkbox-invalid">Bắt buộc chọn</Label>
            </div>
          </div>
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
    name: 'NativeSelect',
    layer: 'ui',
    file: 'components/ui/native-select.tsx',
    demos: [
      {
        title: 'Default, invalid, disabled',
        render: () => (
          <div className="grid w-full max-w-sm gap-4">
            <div className="grid gap-2">
              <Label htmlFor="demo-select-tz">Múi giờ</Label>
              <NativeSelect id="demo-select-tz" defaultValue="Asia/Ho_Chi_Minh">
                <option value="Asia/Ho_Chi_Minh">Asia/Ho_Chi_Minh</option>
                <option value="Asia/Bangkok">Asia/Bangkok</option>
                <option value="America/St_Johns">America/St_Johns</option>
              </NativeSelect>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="demo-select-invalid">Múi giờ</Label>
              <NativeSelect id="demo-select-invalid" aria-invalid defaultValue="">
                <option value="" disabled>
                  Chọn múi giờ
                </option>
                <option value="Asia/Ho_Chi_Minh">Asia/Ho_Chi_Minh</option>
              </NativeSelect>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="demo-select-disabled">Múi giờ (khoá)</Label>
              <NativeSelect id="demo-select-disabled" disabled defaultValue="Asia/Ho_Chi_Minh">
                <option value="Asia/Ho_Chi_Minh">Asia/Ho_Chi_Minh</option>
              </NativeSelect>
            </div>
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
    name: 'RadioGroup',
    layer: 'ui',
    file: 'components/ui/radio-group.tsx',
    demos: [{ title: 'Vertical stack of options, one disabled', render: () => <RadioGroupDemo /> }],
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
            <AppShell user={{ name: DEMO_USER }} isAdmin onSignOut={async () => {}}>
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
    name: 'ChoiceCard',
    layer: 'patterns',
    file: 'components/patterns/choice-card.tsx',
    demos: [{ title: 'Selected and unselected', render: () => <ChoiceCardDemo /> }],
  },
  {
    name: 'CodeBlock',
    layer: 'patterns',
    file: 'components/patterns/code-block.tsx',
    demos: [
      { title: 'Python', render: () => <CodeBlock code={PYTHON_SAMPLE} label="Lời giải Python" /> },
      { title: 'Java', render: () => <CodeBlock code={JAVA_SAMPLE} label="Lời giải Java" /> },
      { title: 'Go', render: () => <CodeBlock code={GO_SAMPLE} label="Lời giải Go" /> },
      {
        title: 'Dòng dài (cuộn ngang, không xuống dòng)',
        render: () => <CodeBlock code={LONG_LINE_SAMPLE} label="Ví dụ dòng dài" />,
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
    name: 'FilterChip',
    layer: 'patterns',
    file: 'components/patterns/filter-chip.tsx',
    demos: [
      {
        title: 'Status filters: 32 px chips, 44 px hit areas, wrapping',
        render: () => <FilterChipDemo />,
      },
    ],
  },
  {
    name: 'FocusLayout',
    layer: 'patterns',
    file: 'components/patterns/focus-layout.tsx',
    demos: [
      {
        title: 'Wordmark, skip link, centred main (narrow)',
        render: () => (
          <div className="h-64 w-full overflow-hidden rounded-lg border border-border">
            <FocusLayout>
              <p className="text-center text-sm text-muted-foreground">Nội dung trang.</p>
            </FocusLayout>
          </div>
        ),
      },
      {
        title: 'Wide, with header actions',
        render: () => (
          <div className="h-64 w-full overflow-hidden rounded-lg border border-border">
            <FocusLayout width="wide" headerActions={<Button variant="outline">Trợ giúp</Button>}>
              <p className="text-center text-sm text-muted-foreground">Nội dung trang rộng.</p>
            </FocusLayout>
          </div>
        ),
      },
    ],
  },
  {
    name: 'FormActions',
    layer: 'patterns',
    file: 'components/patterns/form-actions.tsx',
    demos: [
      {
        title: 'Không có lỗi: chỉ các nút',
        render: () => (
          <FormActions error={null}>
            <Button>Lưu</Button>
          </FormActions>
        ),
      },
      {
        title: 'Lưu thất bại: thông báo ngay trên các nút',
        render: () => (
          <FormActions error={vi.errors.saveFailed} label="Thao tác với DSA">
            <Button variant="outline">Tạm dừng</Button>
            <Button variant="outline">Gỡ lộ trình</Button>
          </FormActions>
        ),
      },
    ],
  },
  {
    name: 'FormErrorSummary',
    layer: 'patterns',
    file: 'components/patterns/form-error-summary.tsx',
    demos: [
      {
        title: 'Two errors',
        render: () => (
          <div className="w-full max-w-sm">
            <FormErrorSummary
              title={vi.forms.errorSummaryTitle}
              errors={[
                { fieldId: 'demo-form-field-error', message: 'Chọn từ 10 đến 240 phút.' },
                { fieldId: 'demo-select-invalid', message: 'Chọn một múi giờ hợp lệ.' },
              ]}
            />
          </div>
        ),
      },
    ],
  },
  {
    name: 'FormField',
    layer: 'patterns',
    file: 'components/patterns/form-field.tsx',
    demos: [{ title: 'Required, description and error', render: () => <FormFieldDemo /> }],
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
    name: 'StepIndicator',
    layer: 'patterns',
    file: 'components/patterns/step-indicator.tsx',
    demos: [
      {
        title: 'Step 2 of 4',
        render: () => (
          <StepIndicator steps={['Thông tin', 'Lộ trình', 'Lịch học', 'Xác nhận']} current={1} />
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
  {
    name: 'SignInPanel',
    layer: 'features',
    file: 'features/auth/components/sign-in-panel.tsx',
    demos: [
      {
        title: 'Providers only (production)',
        render: () => (
          <div className="w-full max-w-md">
            <SignInPanel
              next={null}
              oauthError={false}
              testLogin={false}
              signInWithProvider={async () => {}}
              signInWithTestLogin={async () => ({ error: null })}
            />
          </div>
        ),
      },
      {
        title: 'OAuth error and the test login (submitting shows the wrong-password error)',
        render: () => (
          <div className="w-full max-w-md">
            <SignInPanel
              next="/today"
              oauthError
              testLogin
              signInWithProvider={async () => {}}
              signInWithTestLogin={async () => ({ error: vi.auth.wrongCredentials })}
            />
          </div>
        ),
      },
    ],
  },
  {
    name: 'Landing',
    layer: 'features',
    file: 'features/auth/components/landing.tsx',
    demos: [
      {
        title: 'Wordmark, positioning line, "Đăng nhập"',
        render: () => (
          <div className="w-full max-w-md">
            <Landing />
          </div>
        ),
      },
      {
        title: 'Với thông báo đã xoá tài khoản (?account=deleted)',
        render: () => (
          <div className="w-full max-w-md">
            <Landing deleted />
          </div>
        ),
      },
    ],
  },
  {
    name: 'PendingStatus',
    layer: 'features',
    file: 'features/auth/components/pending-status.tsx',
    demos: [
      {
        title: 'Chờ duyệt, kèm nút đăng xuất (headerActions)',
        render: () => (
          <div className="flex w-full max-w-md flex-col gap-4">
            <SignOutButton signOut={async () => {}} />
            <PendingStatus status="pending" />
          </div>
        ),
      },
      {
        title: 'Bị từ chối và tạm khoá',
        render: () => (
          <div className="flex w-full max-w-md flex-col gap-6">
            <PendingStatus status="rejected" />
            <PendingStatus status="suspended" />
          </div>
        ),
      },
    ],
  },
  {
    name: 'UserQueue',
    layer: 'features',
    file: 'features/admin/components/user-queue.tsx',
    demos: [
      {
        title: 'Chờ duyệt trước, rồi các mục khác; hàng của bạn không có thao tác',
        render: () => (
          <div className="flex w-full flex-col gap-6">
            <UserQueue
              users={DEMO_ADMIN_USERS}
              setUserStatus={demoSetUserStatus}
              setUserRole={demoSetUserRole}
            />
          </div>
        ),
      },
      {
        title: 'Không có tài khoản nào chờ duyệt',
        render: () => (
          <div className="flex w-full flex-col gap-6">
            <UserQueue
              // Own ids: each row's id is its focus target, and ids are unique on the page.
              users={DEMO_ADMIN_USERS.filter((user) => user.status !== 'pending').map((user) => ({
                ...user,
                id: `empty-queue-${user.id}`,
              }))}
              setUserStatus={demoSetUserStatus}
              setUserRole={demoSetUserRole}
            />
          </div>
        ),
      },
    ],
  },
  {
    name: 'UserRowActions',
    layer: 'features',
    file: 'features/admin/components/user-row-actions.tsx',
    demos: [
      {
        title:
          'Theo trạng thái: chờ duyệt, đang hoạt động (học viên, quản trị), tạm khoá, bị từ chối',
        render: () => (
          <div className="flex flex-col gap-4">
            {(
              [
                ['pending', 'learner'],
                ['active', 'learner'],
                ['active', 'admin'],
                ['suspended', 'learner'],
                ['rejected', 'learner'],
              ] as const
            ).map(([status, role]) => (
              <UserRowActions
                key={`${status}-${role}`}
                user={{ id: `${status}-${role}`, name: DEMO_LEARNER, status, role }}
                setUserStatus={demoSetUserStatus}
                setUserRole={demoSetUserRole}
              />
            ))}
          </div>
        ),
      },
      {
        title: 'Thao tác thất bại: thông báo trong hàng và toast',
        render: () => (
          <UserRowActions
            user={{ id: 'failed', name: DEMO_OTHER_ADMIN, status: 'pending', role: 'learner' }}
            setUserStatus={demoFailure}
            setUserRole={demoFailure}
          />
        ),
      },
    ],
  },
  {
    name: 'StatusWatcher',
    layer: 'features',
    file: 'features/auth/components/status-watcher.tsx',
    demos: [
      {
        title: 'Không có giao diện — làm mới trang mỗi 30 giây, khi focus lại hoặc hiện lại',
        render: () => (
          <div className="text-sm text-muted-foreground">
            <StatusWatcher />
            <p>Không hiển thị gì (features/auth/components/status-watcher.tsx).</p>
          </div>
        ),
      },
    ],
  },
  {
    name: 'OnboardingWizard',
    layer: 'features',
    file: 'features/onboarding/components/onboarding-wizard.tsx',
    demos: [
      {
        title: 'Bước 1: chọn lộ trình (các bước sau mở khi bấm "Tiếp tục")',
        render: () => (
          <div className="w-full max-w-2xl">
            <OnboardingWizard
              tracks={DEMO_TRACKS}
              timeZones={DEMO_TIME_ZONES}
              now={DEMO_NOW}
              requestId={DEMO_REQUEST_ID}
              action={demoCompleteOnboarding}
            />
          </div>
        ),
      },
      {
        title: 'Lỗi từ máy chủ: tóm tắt ở đầu, quay về bước có lỗi đầu tiên',
        render: () => (
          <div className="w-full max-w-2xl">
            <OnboardingWizard
              tracks={DEMO_TRACKS}
              timeZones={DEMO_TIME_ZONES}
              now={DEMO_NOW}
              requestId={DEMO_REQUEST_ID}
              action={demoFailOnboarding}
              initialState={DEMO_ONBOARDING_ERROR}
            />
          </div>
        ),
      },
    ],
  },
  {
    name: 'VariantPicker',
    layer: 'features',
    file: 'features/tracks/components/variant-picker.tsx',
    demos: [
      {
        title: 'DSA với 60 phút/ngày: thời gian hoàn thành mô phỏng cho từng phiên bản',
        render: () => <VariantPickerDemo track={DEMO_DSA} budgetMinutes={60} />,
      },
      {
        title: 'Lộ trình không có bảng mô phỏng (English): không có dòng hoàn thành',
        render: () => <VariantPickerDemo track={DEMO_ENGLISH} budgetMinutes={25} />,
      },
    ],
  },
  {
    name: 'WeeklyTemplatePreview',
    layer: 'features',
    file: 'features/tracks/components/weekly-template-preview.tsx',
    demos: [
      {
        title: 'DSA (không giới hạn thẻ mới) và English (có giới hạn thẻ mới)',
        render: () => (
          <div className="grid w-full gap-4 md:grid-cols-2">
            {DEMO_TRACKS.map((track) => (
              <WeeklyTemplatePreview
                key={track.id}
                title={track.title}
                accent={track.accent}
                days={track.template}
                throttle={track.throttle}
              />
            ))}
          </div>
        ),
      },
    ],
  },
  {
    name: 'AdminLink',
    layer: 'features',
    file: 'features/settings/components/admin-link.tsx',
    demos: [
      {
        title: 'Hàng "Quản trị" ở đầu Cài đặt (chỉ quản trị viên; học viên không thấy gì)',
        render: () => (
          <div className="w-full max-w-xl">
            <AdminLink isAdmin />
            <AdminLink isAdmin={false} />
          </div>
        ),
      },
    ],
  },
  {
    name: 'ScheduleForm',
    layer: 'features',
    file: 'features/settings/components/schedule-form.tsx',
    demos: [
      {
        title: 'Lịch đang áp dụng, không có thay đổi chờ',
        render: () => (
          <div className="w-full max-w-2xl">
            <ScheduleForm
              schedule={DEMO_VN_SCHEDULE}
              pendingSchedule={null}
              timeZones={DEMO_TIME_ZONES}
              requestId={DEMO_REQUEST_ID}
              updateSchedule={demoSettingsSave}
            />
          </div>
        ),
      },
      {
        title: 'Có thay đổi đang chờ: thông báo ngày và giờ áp dụng theo múi giờ cũ',
        render: () => (
          <div className="w-full max-w-2xl">
            <ScheduleForm
              schedule={DEMO_VN_SCHEDULE}
              pendingSchedule={{
                timezone: 'Europe/London',
                dayStartsAt: '05:00',
                effectiveAt: '2026-02-04T21:00:00.000Z',
              }}
              timeZones={DEMO_TIME_ZONES}
              requestId={DEMO_REQUEST_ID}
              updateSchedule={demoSettingsSave}
            />
          </div>
        ),
      },
    ],
  },
  {
    name: 'TrackSettings',
    layer: 'features',
    file: 'features/settings/components/track-settings.tsx',
    demos: [
      {
        title: 'DSA đang học, English tạm dừng ("Lưu" bị lỗi để xem thông báo lỗi)',
        render: () => (
          <div className="w-full">
            <TrackSettings
              tracks={DEMO_SETTINGS_TRACKS}
              requestId={DEMO_REQUEST_ID}
              updateTrack={demoSettingsFailure}
              setTrackStatus={demoSettingsSave}
            />
          </div>
        ),
      },
      {
        title: 'Chưa học lộ trình nào',
        render: () => (
          <div className="w-full">
            <TrackSettings
              tracks={DEMO_ADDABLE_TRACKS}
              requestId={DEMO_REQUEST_ID}
              updateTrack={demoSettingsSave}
              setTrackStatus={demoSettingsSave}
            />
          </div>
        ),
      },
    ],
  },
  {
    name: 'TrackBudgetFields',
    layer: 'features',
    file: 'features/settings/components/track-budget-fields.tsx',
    demos: [
      {
        title: 'DSA: số phút và phiên bản với thời gian hoàn thành mô phỏng',
        render: () => <TrackBudgetFieldsDemo track={DEMO_DSA} minutes="60" />,
      },
      {
        title: 'English: một phiên bản, hiện dạng chữ',
        render: () => <TrackBudgetFieldsDemo track={DEMO_ENGLISH} minutes="25" />,
      },
    ],
  },
  {
    name: 'AddTrackForm',
    layer: 'features',
    file: 'features/settings/components/add-track-form.tsx',
    demos: [
      {
        title: 'Lộ trình đã gỡ (DSA) và lộ trình chưa học (English)',
        render: () => (
          <div className="w-full max-w-2xl">
            <AddTrackForm
              tracks={DEMO_ADDABLE_TRACKS}
              schedule={DEMO_VN_SCHEDULE}
              now={DEMO_NOW}
              requestId={DEMO_REQUEST_ID}
              enrollTrack={demoSettingsSave}
            />
          </div>
        ),
      },
      {
        title: 'Đang học tất cả lộ trình',
        render: () => (
          <div className="w-full max-w-2xl">
            <AddTrackForm
              tracks={DEMO_SETTINGS_TRACKS}
              schedule={DEMO_VN_SCHEDULE}
              now={DEMO_NOW}
              requestId={DEMO_REQUEST_ID}
              enrollTrack={demoSettingsSave}
            />
          </div>
        ),
      },
    ],
  },
  {
    name: 'CodeLanguageForm',
    layer: 'features',
    file: 'features/settings/components/code-language-form.tsx',
    demos: [
      {
        title: 'Java đã lưu (chưa lưu ngôn ngữ nào thì hiện Python)',
        render: () => (
          <div className="w-full max-w-2xl">
            <CodeLanguageForm
              codeLanguage="java"
              requestId={DEMO_REQUEST_ID}
              updateCodeLanguage={demoSettingsSave}
            />
          </div>
        ),
      },
    ],
  },
  {
    name: 'DeleteAccount',
    layer: 'features',
    file: 'features/settings/components/delete-account.tsx',
    demos: [
      {
        title: 'Mặc định (bấm "Xoá vĩnh viễn" để mở hộp thoại xác nhận)',
        render: () => (
          <div className="w-full max-w-2xl">
            <DeleteAccount deleteAccount={demoSettingsSave} />
          </div>
        ),
      },
      {
        title: 'Xoá thất bại',
        render: () => (
          <div className="w-full max-w-2xl">
            <DeleteAccount deleteAccount={demoDeleteAccountFailure} />
          </div>
        ),
      },
    ],
  },
  {
    name: 'MdxSection',
    layer: 'features',
    file: 'features/items/components/mdx/section.tsx',
    demos: [
      {
        title: '<Section kind="signals">: h2 từ vi.content.sections',
        render: () => (
          <div className={PROSE}>
            <MdxSection kind="signals">
              <Md.p>Mảng đã sắp xếp và đề hỏi về một cặp phần tử.</Md.p>
            </MdxSection>
          </div>
        ),
      },
      {
        title: 'Kind chưa có nhãn: hiện ID',
        render: () => (
          <div className={PROSE}>
            <MdxSection kind="deep-dive-notes">
              <Md.p>Một định dạng bài học mới vẫn hiển thị được.</Md.p>
            </MdxSection>
          </div>
        ),
      },
    ],
  },
  {
    name: 'Callout',
    layer: 'features',
    file: 'features/items/components/mdx/callout.tsx',
    demos: [
      {
        title: 'Ba tone: info, tip (có title), warning',
        render: () => (
          <div className={PROSE}>
            <Callout tone="info">
              <Md.p>
                Mỗi phần tử chỉ được duyệt <Md.strong>một lần</Md.strong>.
              </Md.p>
            </Callout>
            <Callout tone="tip" title="Dấu hiệu">
              <Md.p>
                Đề có chữ &ldquo;sorted&rdquo; và hỏi một cặp có tổng bằng <Md.code>target</Md.code>{' '}
                — xem <Md.a href="https://leetcode.com/problems/two-sum/">ví dụ</Md.a>.
              </Md.p>
            </Callout>
            <Callout tone="warning">
              <Md.p>
                Tra phần bù <Md.em>trước</Md.em> khi thêm <Md.code>x</Md.code> vào map.
              </Md.p>
            </Callout>
          </div>
        ),
      },
    ],
  },
  {
    name: 'Steps',
    layer: 'features',
    file: 'features/items/components/mdx/steps.tsx',
    demos: [
      {
        title: 'Bước có và không có title',
        render: () => (
          <div className={PROSE}>
            <Steps>
              <Step title="Khởi tạo">
                Đặt <Md.code>left = 0</Md.code> và <Md.code>right = n - 1</Md.code>.
              </Step>
              <Step title="Thu hẹp">
                <Md.p>So sánh tổng với target: nhỏ hơn thì tăng left, lớn hơn thì giảm right.</Md.p>
              </Step>
              <Step>Dừng khi left gặp right.</Step>
            </Steps>
          </div>
        ),
      },
    ],
  },
  {
    name: 'VarTable',
    layer: 'features',
    file: 'features/items/components/mdx/var-table.tsx',
    demos: [
      {
        title: 'Có caption (vùng cuộn, focus bằng bàn phím)',
        render: () => (
          <div className={PROSE}>
            <VarTableDemo caption="nums = [2, 7, 11, 15], target = 9" />
          </div>
        ),
      },
      {
        title: 'Không caption: nhãn "Bảng biến"',
        render: () => (
          <div className={PROSE}>
            <VarTableDemo />
          </div>
        ),
      },
    ],
  },
  {
    name: 'Complexity',
    layer: 'features',
    file: 'features/items/components/mdx/complexity.tsx',
    demos: [
      {
        title: 'Thời gian và bộ nhớ',
        render: () => (
          <div className={PROSE}>
            <Complexity time="O(n log n)" space="O(1)" />
          </div>
        ),
      },
    ],
  },
  {
    name: 'Bilingual',
    layer: 'features',
    file: 'features/items/components/mdx/bilingual.tsx',
    demos: [
      {
        title: 'Tiếng Việt, rồi English (lang="en")',
        render: () => (
          <div className={PROSE}>
            <Bilingual
              vi="Lưu mỗi số vào hash map để tìm phần bù trong O(1)."
              en="Store each number in a hash map to look up its complement in O(1)."
            />
          </div>
        ),
      },
    ],
  },
  {
    name: 'Term',
    layer: 'features',
    file: 'features/items/components/mdx/term.tsx',
    demos: [
      {
        title: 'Có và không có chú thích tiếng Việt',
        render: () => (
          <div className={PROSE}>
            <Md.p>
              Thử <Term vi="hai con trỏ">two pointers</Term> trước khi dùng <Term>hash map</Term>.
            </Md.p>
          </div>
        ),
      },
    ],
  },
  {
    name: 'PracticeCard',
    layer: 'features',
    file: 'features/items/components/mdx/practice-card.tsx',
    demos: [
      {
        title: 'Đủ thông tin; không số LeetCode và độ khó',
        render: () => (
          <div className={PROSE}>
            <PracticeCard title="3Sum" href="/t/dsa/items/lc-0015" leetcode={15} difficulty="M" />
            <PracticeCard
              title="Valid Parentheses"
              href="/t/dsa/items/lc-0020"
              leetcode={20}
              difficulty="E"
            />
            <PracticeCard title="Custom drill" href="/t/dsa" leetcode={null} difficulty={null} />
          </div>
        ),
      },
    ],
  },
  {
    name: 'Quiz',
    layer: 'features',
    file: 'features/items/components/mdx/quiz.tsx',
    demos: [
      {
        title: 'Chọn đáp án rồi bấm "Kiểm tra"; "Làm lại" để xoá',
        render: () => (
          <div className={PROSE}>
            <Quiz>
              <Question prompt="Mảng chưa sắp xếp thì dùng hai con trỏ ngay được không?" answer="b">
                <Choice id="a">Được, luôn luôn</Choice>
                <Choice id="b">Không, phải sắp xếp trước hoặc dùng hash map</Choice>
              </Question>
              <Question prompt="Độ phức tạp thời gian là bao nhiêu?" answer="n">
                <Choice id="n">
                  <Md.code>O(n)</Md.code>
                </Choice>
                <Choice id="n2">
                  <Md.code>O(n^2)</Md.code>
                </Choice>
              </Question>
            </Quiz>
          </div>
        ),
      },
    ],
  },
  {
    name: 'Reveal',
    layer: 'features',
    file: 'features/items/components/mdx/reveal.tsx',
    demos: [
      {
        title: 'Nhãn mặc định ("Xem" / "Ẩn") và nhãn riêng',
        render: () => (
          <div className={PROSE}>
            <Reveal>
              <Md.p>Sắp xếp làm mất chỉ số gốc.</Md.p>
            </Reveal>
            <Reveal label="Gợi ý">
              <Md.p>Khi tổng quá lớn, phần tử nào chắc chắn không thuộc đáp án?</Md.p>
            </Reveal>
          </div>
        ),
      },
    ],
  },
  {
    name: 'SolutionTabs',
    layer: 'features',
    file: 'features/items/components/mdx/solution-tabs.tsx',
    demos: [
      {
        title: 'Ba ngôn ngữ, mở ở Java (ngôn ngữ của người học)',
        render: () => (
          <div className={PROSE}>
            <SolutionTabs
              solutions={{ python: PYTHON_SAMPLE, java: JAVA_SAMPLE, go: GO_SAMPLE }}
              defaultLanguage="java"
            />
          </div>
        ),
      },
      {
        title: 'Thiếu ngôn ngữ của người học (Go): mở ở tab đầu tiên',
        render: () => (
          <div className={PROSE}>
            <SolutionTabs
              solutions={{ python: PYTHON_SAMPLE, java: JAVA_SAMPLE }}
              defaultLanguage="go"
            />
          </div>
        ),
      },
    ],
  },
  {
    name: 'CodePre',
    layer: 'features',
    file: 'features/items/components/mdx/code-pre.tsx',
    demos: [
      {
        title: 'Khối đã tô màu lúc build; khối không có trong bundle (chữ thường)',
        render: () => (
          <div className={PROSE}>
            <CodePre code={DEMO_CODE}>
              <code className={fenceClass('python')}>{`${DEMO_FENCE}\n`}</code>
            </CodePre>
            <CodePre code={DEMO_CODE}>
              <code className={fenceClass('text')}>{'[3, 2, 4] -> [2, 3, 4]\n'}</code>
            </CodePre>
          </div>
        ),
      },
    ],
  },
  {
    name: 'ExternalLink',
    layer: 'features',
    file: 'features/items/components/mdx/external-link.tsx',
    demos: [
      {
        title: 'Link https (tab mới) và link không hợp lệ (chỉ hiện chữ)',
        render: () => (
          <div className={PROSE}>
            <Md.p>
              Đọc thêm{' '}
              <ExternalLink href="https://leetcode.com/problems/two-sum/">
                Two Sum trên LeetCode
              </ExternalLink>
              .
            </Md.p>
            <Md.p>
              <ExternalLink href="http://x.test/">Link http bị bỏ</ExternalLink>
            </Md.p>
          </div>
        ),
      },
    ],
  },
  {
    name: 'ContentImage',
    layer: 'features',
    file: 'features/items/components/mdx/content-image.tsx',
    demos: [
      {
        title: 'SVG 320x180 (unoptimized); nội dung thật lấy từ bucket content-images',
        render: () => (
          <div className={PROSE}>
            <ContentImage
              src="/dev/content-image-sample.svg"
              alt="Hai con trỏ đi từ hai đầu mảng lại gần nhau"
              title="320x180"
            />
          </div>
        ),
      },
    ],
  },
]
