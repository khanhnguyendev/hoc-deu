# Component catalog

The single list of every component in `components/ui`, `components/patterns` and
`features/*/components`. **Search here before creating a component.** Add or update the entry in
the same commit as the component; `tools/guards/component-catalog.test.ts` fails when an entry is
missing here or in the `/dev/components` registry (`app/dev/components/registry.tsx`), which
renders every variant and state in light and dark mode (axe-checked in CI).

## Entry format

### ComponentName

- **Layer:** ui | pattern | feature (`features/<domain>`)
- **File:** the repo path of the component file (a folder pattern's `index.tsx`)
- **Props:** `prop: Type` — what it does (required props first)
- **Variants:** cva variants and sizes
- **States:** default, hover, focus-visible, disabled, loading; for data-driven components:
  loading, empty, error, ready
- **Usage:** a short TSX example
- **Accessibility:** roles, labels, keyboard behaviour

All components use token utilities only, keep the global focus ring, and read Vietnamese labels
from `lib/i18n/vi.ts`.

## ui

### Badge

- **Layer:** ui
- **File:** `components/ui/badge.tsx`
- **Props:** `tone?: 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'track' | 'outline'`,
  `asChild?: boolean`, span props
- **Variants:** the seven tones (soft semantic pairs; `track` needs a `data-accent` ancestor)
- **States:** static
- **Usage:** `<Badge tone="track">DSA</Badge>`
- **Accessibility:** text label always present; not for status (use StatusPill)

### Button

- **Layer:** ui
- **File:** `components/ui/button.tsx`
- **Props:** `variant?`, `size?`, `loading?: boolean`, `asChild?: boolean`, button props
- **Variants:** `primary` (default) · `secondary` · `outline` · `ghost` · `destructive` · `link`;
  sizes `sm` 36 px (desktop only) · `md` 44 px (default) · `lg` 48 px · `icon` 44 × 44
- **States:** default, hover, focus-visible, disabled, loading (spinner, width kept, `aria-busy`)
- **Usage:** `<Button size="lg">Check-in</Button>` · `<Button asChild><Link href="/">…</Link></Button>`
- **Accessibility:** `type="button"` by default; icon-only buttons need a Vietnamese `aria-label`;
  one primary per view

### Card

- **Layer:** ui
- **File:** `components/ui/card.tsx`
- **Props:** `interactive?: boolean`; slots `CardHeader`, `CardTitle` (h3, `asChild`),
  `CardDescription`, `CardAction`, `CardContent`, `CardFooter`
- **Variants:** plain · interactive (`hover:shadow-sm`)
- **States:** default, hover (interactive)
- **Usage:** `<Card><CardHeader><CardTitle>…</CardTitle></CardHeader><CardContent>…</CardContent></Card>`
- **Accessibility:** title is a heading; interactive cards wrap a link or button

### Dialog

- **Layer:** ui
- **File:** `components/ui/dialog.tsx`
- **Props:** Radix Dialog; `DialogContent` `showCloseButton?: boolean`; slots `DialogHeader`,
  `DialogTitle`, `DialogDescription`, `DialogFooter`, `DialogClose`, `DialogTrigger`
- **Variants:** —
- **States:** closed, open (enter 300 ms, exit 150 ms; instant under reduced motion)
- **Usage:** `<Dialog><DialogTrigger asChild><Button>…</Button></DialogTrigger><DialogContent>…</DialogContent></Dialog>`
- **Accessibility:** focus trapped and restored; `Esc` closes; close button "Đóng"; needs a title

### DropdownMenu

- **Layer:** ui
- **File:** `components/ui/dropdown-menu.tsx`
- **Props:** Radix DropdownMenu; `DropdownMenuItem` `variant?: 'default' | 'destructive'`; `Label`,
  `Separator`, `Group`, `RadioGroup`, `RadioItem`
- **Variants:** default · destructive item
- **States:** closed, open, item focus, item disabled, radio checked
- **Usage:** `<DropdownMenu><DropdownMenuTrigger asChild>…</DropdownMenuTrigger><DropdownMenuContent>…</DropdownMenuContent></DropdownMenu>`
- **Accessibility:** menu roles, arrow-key navigation, `Esc` closes; rows 44 px

### Input

- **Layer:** ui
- **File:** `components/ui/input.tsx`
- **Props:** input props (`aria-invalid` for errors)
- **Variants:** —
- **States:** default, focus-visible, disabled, invalid (`border-danger`)
- **Usage:** `<Label htmlFor="m">Số phút</Label><Input id="m" inputMode="numeric" />`
- **Accessibility:** always paired with a visible Label; 16 px text (no iOS zoom); errors below
  the field

### Label

- **Layer:** ui
- **File:** `components/ui/label.tsx`
- **Props:** Radix Label props (`htmlFor`)
- **Variants:** —
- **States:** default, peer-disabled
- **Usage:** `<Label htmlFor="note">Ghi chú</Label>`
- **Accessibility:** clicking focuses the control; never replace with a placeholder

### Progress

- **Layer:** ui
- **File:** `components/ui/progress.tsx`
- **Props:** `value: number` (clamped 0–100), `tone?: 'primary' | 'track'`, `aria-label`
- **Variants:** primary · track
- **States:** 0–100 %
- **Usage:** `<Progress value={40} aria-label="Tiến độ tuần" />`
- **Accessibility:** `progressbar` with `aria-valuenow`; needs a label

### Separator

- **Layer:** ui
- **File:** `components/ui/separator.tsx`
- **Props:** `orientation?: 'horizontal' | 'vertical'`, `decorative?: boolean` (default true)
- **Variants:** horizontal · vertical
- **States:** static
- **Usage:** `<Separator />`
- **Accessibility:** decorative by default (hidden); `decorative={false}` exposes a separator

### Sheet

- **Layer:** ui
- **File:** `components/ui/sheet.tsx`
- **Props:** Radix Dialog; `SheetContent` `side?: 'bottom' | 'top' | 'right' | 'left'`,
  `showCloseButton?`; slots like Dialog
- **Variants:** bottom (default; the mobile form of a dialog) · top · right · left
- **States:** closed, open (slides in)
- **Usage:** `<Sheet><SheetTrigger>…</SheetTrigger><SheetContent side="bottom">…</SheetContent></Sheet>`
- **Accessibility:** as Dialog

### Skeleton

- **Layer:** ui
- **File:** `components/ui/skeleton.tsx`
- **Props:** div props (size with classes)
- **Variants:** —
- **States:** pulsing (static under reduced motion)
- **Usage:** `<Skeleton className="h-4 w-32" />`
- **Accessibility:** `aria-hidden`; wrap in LoadingState for the status text

### Tabs

- **Layer:** ui
- **File:** `components/ui/tabs.tsx`
- **Props:** Radix Tabs; `TabsList`, `TabsTrigger`, `TabsContent`
- **Variants:** —
- **States:** active, inactive, hover, disabled
- **Usage:** `<Tabs defaultValue="python">…</Tabs>` (code language tabs)
- **Accessibility:** tablist/tab/tabpanel; arrow keys move; triggers 44 px

### Textarea

- **Layer:** ui
- **File:** `components/ui/textarea.tsx`
- **Props:** textarea props
- **Variants:** —
- **States:** default, focus-visible, disabled, invalid
- **Usage:** `<Textarea id="note" />`
- **Accessibility:** as Input

### Toaster

- **Layer:** ui
- **File:** `components/ui/toaster.tsx`
- **Props:** none; `toast(message)` re-exported from sonner
- **Variants:** bottom-centre (< 768 px) · bottom-right (≥ 768 px); lifted above the bottom
  navigation below 1024 px
- **States:** hidden, showing (4 s)
- **Usage:** mount `<Toaster />` once; `toast('Đã lưu')`
- **Accessibility:** polite live region labelled "Thông báo"; never the only feedback for a failed
  save

### ToggleGroup

- **Layer:** ui
- **File:** `components/ui/toggle-group.tsx`
- **Props:** Radix ToggleGroup (`type="single" | "multiple"`); `ToggleGroupItem`
- **Variants:** —
- **States:** off, on (`primary-soft`), hover, disabled
- **Usage:** `<ToggleGroup type="single" aria-label="Trạng thái">…</ToggleGroup>` (check-in status)
- **Accessibility:** single: radio semantics with `aria-checked`; items 44 px; group needs a label

### Tooltip

- **Layer:** ui
- **File:** `components/ui/tooltip.tsx`
- **Props:** Radix Tooltip; `TooltipProvider`, `TooltipTrigger`, `TooltipContent`
- **Variants:** —
- **States:** closed, open (hover and keyboard focus)
- **Usage:** `<Tooltip><TooltipTrigger asChild><Button size="icon" aria-label="…">…</Button></TooltipTrigger><TooltipContent>…</TooltipContent></Tooltip>`
- **Accessibility:** supplements, never replaces, an accessible name; desktop hint for icon-only
  buttons

## patterns

### AppShell

- **Layer:** pattern
- **File:** `components/patterns/app-shell/index.tsx`
- **Props:** `user: { name: string }`, `isAdmin: boolean`, `title: string` (mobile top bar),
  `onSignOut?: () => void`, `children`
- **Variants:** sidebar (≥ 1024 px, collapsible 240 → 64 px) · top bar + bottom nav (< 1024 px)
- **States:** current route (`aria-current="page"`, `primary-soft`), collapsed, admin / learner
- **Usage:** `<AppShell user={{ name }} isAdmin={isAdmin} title="Hôm nay">…</AppShell>`
- **Accessibility:** skip link to `#main`; nav landmarks "Điều hướng chính"; the current page is
  marked by `aria-current`, a semibold label and an indicator bar (never colour alone); account
  menu with "Quản trị" for admins only; bottom nav 56 px; `main` and the root scroll padding keep
  content and focus clear of the top bar and bottom nav

### Banner

- **Layer:** pattern
- **File:** `components/patterns/banner.tsx`
- **Props:** `tone: 'warning' | 'danger' | 'info'`, `children` (one sentence), `action?: ReactNode`
- **Variants:** warning (paused roadmap, throttle) · danger (red admin warnings) · info
- **States:** static
- **Usage:** `<Banner tone="warning" action={…}>Lộ trình đang tạm dừng…</Banner>`
- **Accessibility:** icon + text, never colour alone

### CalendarHeatmap

- **Layer:** pattern
- **File:** `components/patterns/calendar-heatmap/index.tsx`
- **Props:** `days: { day: string; minutes: number }[]` (local days), `today: string`,
  `label: string`
- **Variants:** year view (≥ 768 px, 12 px cells) · month view (< 768 px, 44 px cells)
- **States:** levels 0–4, active-day dots, today ring, focused/selected day, table open
- **Usage:** `<CalendarHeatmap days={activity} today={localDay} label="Lịch học" />`
- **Accessibility:** roving focus with arrows/Home/End; each day labelled with date + minutes;
  a visible detail line (not a live region — the focused day already announces itself); legend;
  table view ("Xem dạng bảng"); the year view starts scrolled to today

### ConfirmDialog

- **Layer:** pattern
- **File:** `components/patterns/confirm-dialog.tsx`
- **Props:** `open`, `onOpenChange`, `title`, `description`, `confirmLabel`, `onConfirm`,
  `cancelLabel?`, `tone?: 'default' | 'destructive'`, `pending?`
- **Variants:** default · destructive
- **States:** closed, open, pending (confirm busy, cancel disabled, cannot close)
- **Usage:** `<ConfirmDialog open={open} … tone="destructive" onConfirm={remove} />`
- **Accessibility:** `alertdialog` named by its title; focus trapped and restored

### DataList

- **Layer:** pattern
- **File:** `components/patterns/data-list.tsx`
- **Props:** `items`, `getKey`, `renderItem`, `empty: ReactNode`, `label?`
- **Variants:** —
- **States:** empty, list
- **Usage:** `<DataList items={problems} getKey={(p) => p.id} renderItem={…} empty={<EmptyState …/>} />`
- **Accessibility:** `role="list"` kept; rows ≥ 44 px

### DataState

- **Layer:** pattern
- **File:** `components/patterns/data-state.tsx`
- **Props:** `state: DataState<T>` (loading | empty | error + retry | ready + data),
  `empty: ReactNode`, `loading?: ReactNode`, `children: (data: T) => ReactNode`
- **Variants:** —
- **States:** loading, empty, error, ready (platform design §7.5)
- **Usage:** `<DataState state={queue} empty={…}>{(cards) => …}</DataState>`
- **Accessibility:** loading announces "Đang tải…"; error offers "Thử lại"

### EmptyState

- **Layer:** pattern
- **File:** `components/patterns/empty-state.tsx`
- **Props:** `icon`, `title`, `description?`, `action?: { label, href } | { label, onClick }`,
  `titleAs?: 'h1' | 'h2' | 'h3'`, `layout?: 'inline' | 'page'`
- **Variants:** inline · page (a centred `main`, e.g. the 404)
- **States:** with / without action
- **Usage:** `<EmptyState icon={Inbox} title="Chưa có thẻ nào" action={{ label: '…', href: '/today' }} />`
- **Accessibility:** heading level chosen by the caller; icon decorative

### ErrorState

- **Layer:** pattern
- **File:** `components/patterns/error-state.tsx`
- **Props:** `title?`, `description?`, `onRetry?`, `titleAs?`, `layout?`
- **Variants:** inline · page (route and global error boundaries)
- **States:** with / without retry
- **Usage:** `<ErrorState onRetry={retry} />`
- **Accessibility:** `role="alert"`, so it is announced when it replaces loading content; what
  failed + "Thử lại"; no exclamation marks

### LoadingState

- **Layer:** pattern
- **File:** `components/patterns/loading-state.tsx`
- **Props:** `variant?: 'list' | 'card' | 'page'`, `rows?: number`
- **Variants:** list · card · page
- **States:** loading
- **Usage:** `<LoadingState variant="card" />` (in `loading.tsx`)
- **Accessibility:** `role="status"` with "Đang tải…"; skeletons hidden

### PageHeader

- **Layer:** pattern
- **File:** `components/patterns/page-header.tsx`
- **Props:** `title`, `description?`, `actions?`
- **Variants:** actions right (≥ 768 px) or stacked (mobile)
- **States:** static
- **Usage:** `<PageHeader title="Hôm nay học gì?" actions={…} />`
- **Accessibility:** the page's single `h1`

### ProgressRing

- **Layer:** pattern
- **File:** `components/patterns/progress-ring.tsx`
- **Props:** `value: number`, `label: string`, `tone?: 'primary' | 'track'`,
  `size?: 'sm' | 'md' | 'lg'`
- **Variants:** primary (overall) · track (per track); sm 48 · md 64 · lg 96 px
- **States:** 0–100 %
- **Usage:** `<div data-accent="track-1"><ProgressRing value={40} label="Tiến độ DSA" tone="track" /></div>`
- **Accessibility:** labelled `progressbar`; percentage printed

### Section

- **Layer:** pattern
- **File:** `components/patterns/section.tsx`
- **Props:** `title`, `description?`, `actions?`, `children`
- **Variants:** —
- **States:** static
- **Usage:** `<Section title="Ôn tập đến hạn">…</Section>`
- **Accessibility:** a region named by its `h2`

### StatCard

- **Layer:** pattern
- **File:** `components/patterns/stat-card.tsx`
- **Props:** `label`, `value: number | string`, `hint?`, `icon?`
- **Variants:** —
- **States:** static
- **Usage:** `<StatCard label="Phút tuần này" value={245} icon={Clock} />`
- **Accessibility:** numbers in vi-VN format, mono with tabular figures

### StatusPill

- **Layer:** pattern
- **File:** `components/patterns/status-pill.tsx`
- **Props:** `status: PillStatus`, `size?: 'sm' | 'md'`
- **Variants:** not-started · weak · ok · strong · mastered · skipped · block-done ·
  block-partial · block-skipped (DESIGN_SYSTEM §3.3); sm 24 px · md 32 px
- **States:** static
- **Usage:** `<StatusPill status="weak" />`
- **Accessibility:** colour + icon + label, never colour alone

### StreakBadge

- **Layer:** pattern
- **File:** `components/patterns/streak-badge.tsx`
- **Props:** `days: number`
- **Variants:** —
- **States:** static
- **Usage:** `<StreakBadge days={12} />`
- **Accessibility:** reads "12 ngày liên tiếp"; flame decorative

### ThemeToggle

- **Layer:** pattern
- **File:** `components/patterns/theme-toggle.tsx`
- **Props:** none (next-themes)
- **Variants:** —
- **States:** light, dark, system
- **Usage:** `<ThemeToggle />` (settings, catalog)
- **Accessibility:** radio group labelled "Giao diện"

## features

_None yet — M2 adds the first feature components._
