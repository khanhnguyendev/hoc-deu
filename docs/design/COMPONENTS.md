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

### Checkbox

- **Layer:** ui
- **File:** `components/ui/checkbox.tsx`
- **Props:** Radix Checkbox.Root props (`checked`, `onCheckedChange`, `disabled`, `aria-invalid`, …)
- **Variants:** —
- **States:** unchecked, checked (`bg-primary`), disabled, invalid (`border-danger`)
- **Usage:** `<Label htmlFor="agree">Đồng ý</Label><Checkbox id="agree" checked={v} onCheckedChange={setV} />`
- **Accessibility:** `role="checkbox"`, `aria-checked`, Space toggles; 20 px box with a transparent
  ≥ 44 px hit area (same technique as FilterChip) — stacking two or more bare checkboxes needs the
  same `gap-8` spacing as RadioGroup (below) so the transparent hit areas don't overlap

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

### NativeSelect

- **Layer:** ui
- **File:** `components/ui/native-select.tsx`
- **Props:** select props (`aria-invalid` for errors)
- **Variants:** —
- **States:** default, focus-visible, disabled, invalid (`border-danger`)
- **Usage:** `<Label htmlFor="tz">Múi giờ</Label><NativeSelect id="tz">…</NativeSelect>`
- **Accessibility:** native `<select>` (role `combobox`), so long lists (≈ 420 time zones) keep the
  platform picker on phones; always paired with a visible Label

### Progress

- **Layer:** ui
- **File:** `components/ui/progress.tsx`
- **Props:** `value: number` (clamped 0–100), `tone?: 'primary' | 'track'`, `aria-label`
- **Variants:** primary · track
- **States:** 0–100 %
- **Usage:** `<Progress value={40} aria-label="Tiến độ tuần" />`
- **Accessibility:** `progressbar` with `aria-valuenow`; needs a label

### RadioGroup

- **Layer:** ui
- **File:** `components/ui/radio-group.tsx`
- **Props:** Radix RadioGroup props (`value`, `onValueChange`, …); `RadioGroupItem` (`value`,
  `disabled`, …)
- **Variants:** —
- **States:** unchecked, checked (`border-primary` + filled dot), disabled, invalid
- **Usage:** `<RadioGroup aria-label="Ưu tiên" value={v} onValueChange={setV}><RadioGroupItem id="x" value="x" /><Label htmlFor="x">…</Label></RadioGroup>`
- **Accessibility:** `radiogroup`/`radio` roles, roving tabindex, arrow keys move focus; items are
  20 px with a transparent ≥ 44 px hit area (`before:-inset-3`, 12 px each side), so the default
  stack is `gap-8` (32 px): 12 + 12 px of hit-area overreach + 8 px clearance = 32 px, keeping
  adjacent 44 px hit areas from overlapping (DESIGN_SYSTEM §5, same math as FilterChip) — a
  consumer that wraps each item in a ChoiceCard (the card is the target, not the bare radio)
  overrides the gap with `className` (`tailwind-merge`)

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
- **Props:** `user: { name: string }`, `isAdmin: boolean`, `onSignOut?: () => Promise<void>`,
  `children` — the mobile top bar's title is not a prop: `TopBar` derives it from `usePathname()`
  via `NAV_ITEMS` + `ADMIN_ITEMS`, falling back to "Học Đều" (M1 deferred #5, ruling R3)
- **Variants:** sidebar (≥ 1024 px, collapsible 240 → 64 px) · top bar + bottom nav (< 1024 px)
- **States:** current route (`aria-current="page"`, `primary-soft`), collapsed, admin / learner
- **Usage:** `<AppShell user={{ name }} isAdmin={isAdmin} onSignOut={signOut}>…</AppShell>`
- **Accessibility:** skip link to `#main`; nav landmarks "Điều hướng chính"; the current page is
  marked by `aria-current`, a semibold label and an indicator bar (never colour alone); account
  menu with "Quản trị" for admins only; "Đăng xuất" is invoked as `() => void onSignOut()` from
  `DropdownMenuItem onSelect` (Radix passes a non-serializable Event, and `onSignOut` takes none);
  bottom nav 56 px; `main` and the root scroll padding keep content and focus clear of the top bar
  and bottom nav
- **Layout:** `main` stacks the page's children with the section spacing (`gap-6 md:gap-8
  lg:gap-10`, DESIGN_SYSTEM §5) — pages carry no classes, so a page is just its patterns in order
- **Toasts:** mounts the one `Toaster` of the signed-in pages (task 2.8) — layouts and pages may
  not import `components/ui`, so a feature's `toast()` (e.g. the approval queue) needs no mount of
  its own; the catalog's boxed demo therefore shows a second copy of catalog toasts

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
- **Variants:** year view (≥ 1024 px with a fine pointer, 12 px cells) · month view (below
  1024 px or on touch screens, 44 px cells)
- **States:** levels 0–4, active-day dots, today ring, focused/selected day, table open
- **Usage:** `<CalendarHeatmap days={activity} today={localDay} label="Lịch học" />`
- **Accessibility:** roving focus with arrows/Home/End; each day labelled with date + minutes;
  a visible detail line (not a live region — the focused day already announces itself); legend;
  table view ("Xem dạng bảng"); the year view starts scrolled to today

### ChoiceCard

- **Layer:** pattern
- **File:** `components/patterns/choice-card.tsx`
- **Props:** `htmlFor: string`, `control: ReactNode`, `title: ReactNode`, `description?: ReactNode`
- **Variants:** —
- **States:** unselected, selected (`has-data-[state=checked]:border-primary` + `bg-primary-soft`)
- **Usage:** `<ChoiceCard htmlFor="dsa" control={<Checkbox id="dsa" .../>} title="DSA" description="…" />`
- **Accessibility:** a `<label>` card ≥ 44 px; clicking anywhere toggles the control (native label
  behaviour); selected state is never colour alone — the control itself shows the check

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

### FilterChip

- **Layer:** pattern
- **File:** `components/patterns/filter-chip.tsx`
- **Props:** `status: PillStatus`, `pressed: boolean`, `onPressedChange(pressed)`; wrap chips in
  `FilterChipGroup` (`label: string`)
- **Variants:** the StatusPill statuses at 32 px
- **States:** off, on (`aria-pressed`, 2 px `primary` ring), focus-visible
- **Usage:** `<FilterChipGroup label="Lọc theo trạng thái"><FilterChip status="weak" pressed={on} onPressedChange={setOn} /></FilterChipGroup>`
- **Accessibility:** toggle button named by its status label; 32 px visual with a transparent hit
  area of at least 44 px; chips ≥ 8 px apart in a row and 20 px between rows so hit areas never
  overlap

### FocusLayout

- **Layer:** pattern
- **File:** `components/patterns/focus-layout.tsx`
- **Props:** `children`, `width?: 'narrow' | 'wide'` (`max-w-md` / `max-w-2xl`, default `narrow`),
  `headerActions?: ReactNode`
- **Variants:** narrow · wide
- **States:** static
- **Usage:** `<FocusLayout><SignInPanel … /></FocusLayout>` (`/`, `/sign-in`, `/pending`,
  `/onboarding`)
- **Accessibility:** skip link to `#main`; header wordmark links to `/`; `main#main` is the page's
  landmark
- **Layout:** `main` stacks its children with the section spacing (`gap-6 md:gap-8 lg:gap-10`,
  DESIGN_SYSTEM §5)

### FormErrorSummary

- **Layer:** pattern (client)
- **File:** `components/patterns/form-error-summary.tsx`
- **Props:** `title: string`, `errors: { fieldId: string; message: string }[]`
- **Variants:** —
- **States:** empty (renders nothing), has errors
- **Usage:** `<FormErrorSummary title={vi.forms.errorSummaryTitle} errors={errors} />` (top of long
  forms, e.g. onboarding)
- **Accessibility:** `role="alert"`, focused when the error set changes; each message links to
  `#fieldId`

### FormField

- **Layer:** pattern
- **File:** `components/patterns/form-field.tsx`
- **Props:** `id: string`, `label: string`, `description?: string`, `error?: string`,
  `required?: boolean`, `children: (control) => ReactNode`; `FormFieldError`: `id?: string`,
  `children` (the message)
- **Variants:** —
- **States:** default, with description, with error (`aria-invalid`, `text-danger` + icon)
- **Usage:** `<FormField id="email" label="Email" error={err}>{(control) => <Input {...control} />}</FormField>`
  · a checkbox or radio group (no single control to label) puts `<FormFieldError id={errId}>` under
  the group and `aria-describedby={errId}` on it (the onboarding wizard)
- **Accessibility:** label above the field; `aria-describedby` joins the description and error
  ids; required fields marked with "*" plus an sr-only "(Bắt buộc)"; `FormFieldError` is the
  same error line (`text-danger` + icon, never colour alone)

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

### StepIndicator

- **Layer:** pattern
- **File:** `components/patterns/step-indicator.tsx`
- **Props:** `steps: readonly string[]`, `current: number` (0-based)
- **Variants:** —
- **States:** per step: upcoming, current (larger dot)
- **Usage:** `<StepIndicator steps={['Thông tin', 'Lộ trình', 'Lịch học', 'Xác nhận']} current={1} />`
  (onboarding wizard)
- **Accessibility:** visible text "Bước {n}/{total}: {label}"; `<ol>` of step dots,
  `aria-current="step"` on the current one; never colour alone — the current dot is larger and the
  label is text

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

### OnboardingWizard

- **Layer:** feature (`features/onboarding`, client)
- **File:** `features/onboarding/components/onboarding-wizard.tsx`
- **Props:** `tracks: TrackOption[]`, `timeZones: readonly string[]` (built on the server), `now:
  string` (server clock, ISO), `requestId: string` (per render, decision 9), `action: (state,
  formData) => Promise<OnboardingState>` — all but the action come from `getOnboardingData()`; the
  action comes in as a prop, so the catalog passes a no-op; `initialState?: OnboardingState` (the
  catalog's error state)
- **Variants:** the steps shown follow the selection — "Chọn lộ trình" → "Thời gian mỗi ngày" →
  "Phiên bản lộ trình" (only for a track with more than one roadmap) → "Lịch học" → "Ngôn ngữ lập
  trình" (only when a selected track has code languages) → "Xem trước tuần học"
- **States:** per step: default, field errors (under the field + FormErrorSummary at the top);
  variant follows the minutes (`defaultVariant`) until the learner picks one, then it sticks
  (ADR-0015); time zone `Asia/Ho_Chi_Minh` on the server render, then the browser's canonical zone
  when the list has it (`useSyncExternalStore`, no hydration mismatch); submitting ("Bắt đầu học"
  busy, "Quay lại" disabled); server error (summary, back to the step of the first field in
  error; a form error such as the quota stays on the last step)
- **Usage:** `<FocusLayout width="wide"><PageHeader … /><OnboardingWizard {...await
  getOnboardingData()} action={completeOnboarding} /></FocusLayout>`
  (`app/(onboarding)/onboarding/page.tsx`)
- **Accessibility:** one `<form>` (`noValidate`, checks are the wizard's); StepIndicator "Bước
  n/total"; each step's h2 takes focus on every step change (not on the first render); the track
  and language choices are ChoiceCards in a group named by the step heading, with the error line
  in `aria-describedby`; Enter in a field moves on like "Tiếp tục" (only the last step submits);
  summary links to a field on another step open that step and focus the field; the submit button
  keeps focus while busy (`aria-busy`) and ignores a second press

### VariantPicker

- **Layer:** feature (`features/tracks`, client; exported from `features/tracks/index.ts`)
- **File:** `features/tracks/components/variant-picker.tsx`
- **Props:** `trackId: string`, `name: string`, `roadmaps: TrackOption['roadmaps']`,
  `budgetMinutes: number`, `value: string`, `onValueChange: (id) => void`, `aria-labelledby?` /
  `aria-label?` (the group's name — one is needed)
- **Variants:** with the simulated finish (a track with a projection table, DSA) · without (English)
- **States:** each roadmap unselected / selected (ChoiceCard)
- **Usage:** `<VariantPicker trackId="dsa" name="variant-dsa" roadmaps={track.roadmaps}
  budgetMinutes={60} value={variant} onValueChange={setVariant} aria-labelledby={headingId} />`
  (onboarding, settings)
- **Accessibility:** `radiogroup` of ChoiceCard-wrapped radios (the card is the target, so the
  group uses `gap-3`); each radio is named "8 tuần" / "10 tuần" followed by its finish line
  ("Với 60 phút/ngày, lộ trình 8 tuần thường hoàn thành sau ~12 tuần (90 %: ~12,4 tuần)", §5.11)

### WeeklyTemplatePreview

- **Layer:** feature (`features/tracks`, server-compatible — no hooks; exported from
  `features/tracks/index.ts`)
- **File:** `features/tracks/components/weekly-template-preview.tsx`
- **Props:** `title: string`, `accent: string` (`track-N`), `days: TemplateDay[]`
  (`describeWeeklyTemplate`), `throttle: string[]` (`describeThrottle`)
- **Variants:** with / without the throttle section ("Giới hạn thẻ mới")
- **States:** static (read-only; editing the template is later, §0)
- **Usage:** `<WeeklyTemplatePreview title={track.title} accent={track.accent}
  days={track.template} throttle={track.throttle} />` (onboarding's last step, settings)
- **Accessibility:** a Card with the track title as h3 and a 4 px track stripe (the title carries
  the name, never colour alone); days as a `<dl>` (day → list of blocks)

### UserQueue

- **Layer:** feature (`features/admin`)
- **File:** `features/admin/components/user-queue.tsx`
- **Props:** `users: readonly AdminUserRow[]` (from `listUsers()`, in its order),
  `setUserStatus: (userId, 'active' | 'rejected' | 'suspended') => Promise<AdminActionResult>`,
  `setUserRole: (userId, Role) => Promise<AdminActionResult>` — the server actions come in as
  props (passed on to `UserRowActions`), so the catalog passes no-ops
- **Variants:** none
- **States:** four Sections — "Chờ duyệt (n)" (pending, oldest first), "Đang hoạt động", "Tạm
  khoá", "Bị từ chối"; each empty section shows an EmptyState ("Không có tài khoản nào chờ
  duyệt." for the queue); a row shows the name (the e-mail when there is none), the e-mail, "Tham
  gia {day}" (the sign-up's calendar day in Asia/Ho_Chi_Minh, `formatDay`), a "Quản trị viên"
  Badge for admins, and `UserRowActions` — the acting admin's own row shows a "Bạn" Badge and no
  actions (decision 17)
- **Usage:** `<PageHeader title="Người dùng" /><UserQueue users={await listUsers()}
  setUserStatus={setUserStatus} setUserRole={setUserRole} />` (`app/(admin)/admin/users/page.tsx`)
- **Accessibility:** each section is a region named by its h2; the empty-state titles are h3;
  rows are DataList items (≥ 44 px); the admin and "Bạn" badges are text, never colour alone

### UserRowActions

- **Layer:** feature (`features/admin`, client)
- **File:** `features/admin/components/user-row-actions.tsx`
- **Props:** `user: { id, name, status: AccountStatus, role: Role }`, `setUserStatus`,
  `setUserRole` (as UserQueue)
- **Variants:** one button set per status (decision 17): pending — "Duyệt", "Từ chối"; active —
  "Tạm khoá" and "Đặt làm quản trị" (learner) or "Bỏ quyền quản trị" (admin); suspended or
  rejected — "Kích hoạt lại". "Duyệt" / "Kích hoạt lại" are `secondary`, the rest `outline`
- **States:** idle; running (the pressed button shows its spinner, the others are disabled);
  confirming — "Từ chối", "Tạm khoá" and the role changes open a ConfirmDialog first
  (destructive, except "Đặt làm quản trị"), pending while the action runs; failed — the message
  also stays in the row (`text-danger` + icon), because a toast is never the only feedback for a
  failure (DESIGN_SYSTEM §9)
- **Usage:** rendered by UserQueue for every row but the admin's own
- **Accessibility:** the buttons sit in a `group` named "Thao tác với {name}", so each "Duyệt" is
  announced with its account; the result is a toast in the polite live region (the AppShell's
  Toaster); the confirm dialog is an `alertdialog` named "Từ chối tài khoản của {name}?" (etc.),
  focus trapped and restored

### Landing

- **Layer:** feature (`features/auth`)
- **File:** `features/auth/components/landing.tsx`
- **Props:** none
- **Variants:** none
- **States:** static
- **Usage:** `<FocusLayout><Landing /></FocusLayout>` (`app/(public)/page.tsx`, signed-out only —
  a signed-in visitor is redirected to `homePathFor(user)` before this renders)
- **Accessibility:** one h1 ("Học Đều"); "Đăng nhập" is a link styled as a button (`buttonVariants`)
  to `/sign-in`

### PendingStatus

- **Layer:** feature (`features/auth`)
- **File:** `features/auth/components/pending-status.tsx`
- **Props:** `PendingStatus`: `status: 'pending' | 'rejected' | 'suspended'` (never `active` — the
  page redirects first). `SignOutButton`: `signOut: () => Promise<void>`
- **Variants:** one per status, copy from `vi.account[status]`
- **States:** static; `SignOutButton` default / hover / focus-visible (Button `outline`)
- **Usage:** `<FocusLayout headerActions={<SignOutButton signOut={signOut} />}><PendingStatus
  status={user.status} /><StatusWatcher /></FocusLayout>` (`app/(account)/pending/page.tsx`) —
  `SignOutButton` goes in `headerActions` because the page itself may not import `components/ui`
- **Accessibility:** one h1 (PageHeader, the status title) with its description; the sign-out
  button is a submit button of its own form (`action={signOut}`)

### SignInPanel

- **Layer:** feature (`features/auth`, client)
- **File:** `features/auth/components/sign-in-panel.tsx`
- **Props:** `next: string | null` (a path already checked with `safeNextPath`), `oauthError:
  boolean` (`/sign-in?error=oauth`), `testLogin: boolean` (`serverEnv().authTestLogin`),
  `signInWithProvider: (formData) => Promise<void>`, `signInWithTestLogin: (state, formData) =>
  Promise<TestLoginState>` — the server actions come in as props, so the catalog passes no-ops
- **Variants:** providers only · with the test login (local and CI)
- **States:** default; OAuth error (danger Banner "Đăng nhập không thành công. Bạn thử lại nhé.");
  submitting (the pressed button shows its spinner); test-login error ("Email hoặc mật khẩu không
  đúng.")
- **Usage:** `<FocusLayout><SignInPanel next={next} oauthError={error === 'oauth'}
  testLogin={serverEnv().authTestLogin} signInWithProvider={signInWithProvider}
  signInWithTestLogin={signInWithTestLogin} /></FocusLayout>` (`app/(public)/sign-in`)
- **Accessibility:** one h1 (PageHeader "Đăng nhập"); "Tiếp tục với Google" / "Tiếp tục với
  GitHub" are submit buttons of their own forms (hidden `provider` and `next`); the test login is a
  form named by its h2 "Đăng nhập thử nghiệm", with labelled, required e-mail and password fields
  (`autocomplete` username / current-password) and its error in an always-mounted `role="alert"`
  region, so it is announced when it appears

### StatusWatcher

- **Layer:** feature (`features/auth`, client)
- **File:** `features/auth/components/status-watcher.tsx`
- **Props:** none
- **Variants:** none
- **States:** renders nothing — it exists only for its effect
- **Usage:** `<StatusWatcher />` inside `/pending` (`app/(account)/pending/page.tsx`); refreshes
  the server page (`router.refresh()`) every 30 s, on `focus` and when the tab becomes visible
  again, so the redirect to the user's home path fires as soon as an admin approves the account
- **Accessibility:** no visible output, nothing to announce
