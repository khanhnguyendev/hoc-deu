# Component catalog

The single list of every component in `components/ui`, `components/patterns` and
`features/*/components`. **Search here before creating a component.** Add or update the entry in
the same commit as the component; `tools/guards/component-catalog.test.ts` fails when an entry is
missing here or in the `/dev/components` registry (`app/dev/components/registry.tsx`), which
renders every variant and state in light and dark mode (axe-checked in CI). Item types' Pages and
Rows (`features/items/<type>/{Page,Row}.tsx`) are listed under "Item types" and render in the
`/dev/items` gallery instead (server components; same test).

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
  menu with "Quản trị" for admins only; "Đăng xuất" is awaited from `DropdownMenuItem onSelect`
  (Radix passes a non-serializable Event, and `onSignOut` takes none) — a genuine rejection shows a
  toast instead of failing silently (M2 minor); a successful sign-out also rejects the promise
  (Next settles a redirecting action called directly, outside `useActionState`, with a
  `NEXT_REDIRECT`-digest error even though the navigation already happened), and that shape is
  recognised and never toasted; bottom nav 56 px; `main` and the root scroll padding keep content
  and focus clear of the top bar and bottom nav
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

### CodeBlock

- **Layer:** pattern
- **File:** `components/patterns/code-block.tsx`
- **Props:** `code: HighlightedCode` (`{ lang, lines }`, build-time-highlighted token runs —
  `lib/content/code-tokens.ts` declares an identical type for the content pipeline;
  `features/items/code-tokens.types.test.ts` keeps the two equal), `label: string` (accessible
  name, e.g. "Lời giải Python"), `className?`
- **Variants:** —
- **States:** static (no hooks, no `'use client'`; server-compatible)
- **Usage:** `<CodeBlock code={highlighted} label="Lời giải Python" />`
- **Accessibility:** `<pre tabIndex={0} role="region" aria-label={label}>` — a focusable scroll
  region (axe `scrollable-region-focusable`); `overflow-x-auto`, `whitespace-pre` (never wrapped);
  an empty line keeps its height with a zero-width space. Syntax colours reuse verified text
  tokens (DESIGN_SYSTEM §9, decision 13): keyword `text-primary`, string `text-success`, constant
  `text-warning`, comment `text-muted-foreground italic` — no new design tokens

### ConfirmDialog

- **Layer:** pattern
- **File:** `components/patterns/confirm-dialog.tsx`
- **Props:** `open`, `onOpenChange`, `title`, `description`, `confirmLabel`, `onConfirm`,
  `cancelLabel?`, `tone?: 'default' | 'destructive'`, `pending?`, `onCloseAutoFocus?: (event:
  Event) => void` — runs once the dialog has closed; calling `event.preventDefault()` keeps the
  focus where the handler put it (e.g. UserRowActions moves it to a row that changed section)
- **Variants:** default · destructive
- **States:** closed, open, pending (confirm busy, cancel disabled, cannot close)
- **Usage:** `<ConfirmDialog open={open} … tone="destructive" onConfirm={remove} />`
- **Accessibility:** `alertdialog` named by its title; focus trapped, and restored on close to the
  control that had it when the dialog opened — it is opened without a `DialogTrigger`, so Radix
  alone would drop focus to `<body>` (WCAG 2.4.3, task 2.8 fix round 1)

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

### FormActions

- **Layer:** pattern
- **File:** `components/patterns/form-actions.tsx`
- **Props:** `error: string | null` (the form-level failure), `children` (the buttons),
  `label?: string` (names the buttons as a `group`, e.g. "Thao tác với {title}")
- **Variants:** unnamed row · named group
- **States:** no failure (an empty, zero-height alert region) · failed (a danger Banner above the
  buttons)
- **Usage:** `<FormActions error={failure}><Button type="submit" loading={pending}>Lưu</Button></FormActions>`
  (the settings forms)
- **Accessibility:** the failure sits in an always-mounted `role="alert"` region, so it is
  announced when it appears — a toast is never the only feedback for a failed save (DESIGN_SYSTEM
  §9); the region and the buttons share one block, so the empty region adds no gap to a flex form

### FormErrorSummary

- **Layer:** pattern (client)
- **File:** `components/patterns/form-error-summary.tsx`
- **Props:** `title: string`, `errors: { fieldId: string; message: string }[]`,
  `submitCount?: number` (default `0`), `onNavigate?: (fieldId: string) => void`
- **Variants:** —
- **States:** empty (renders nothing), has errors
- **Usage:** `<FormErrorSummary title={vi.forms.errorSummaryTitle} errors={errors} />` (top of long
  forms, e.g. onboarding) — `submitCount` (incremented once per submission, not per render) makes a
  repeated identical server error re-focus and re-announce the summary (M2 minor); `onNavigate` lets
  a multi-step form switch to a field's step before focusing it (the onboarding wizard); without it,
  a link focuses its field directly instead of a native anchor jump, which some browsers (and jsdom)
  do not reliably focus
- **Accessibility:** `role="alert"`, focused when the error set or `submitCount` changes; each
  message links to `#fieldId` and always moves focus there itself (`onNavigate`, or the field
  directly), never a bare native anchor jump

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

### LinkRow

- **Layer:** pattern
- **File:** `components/patterns/link-row.tsx`
- **Props:** `href: string`, `title: ReactNode`, `titleLang?: 'en' | 'vi'`, `meta?: ReactNode[]`
  (joined with " · "; empty entries dropped), `badges?: ReactNode`, `trailing?: ReactNode` (e.g. a
  StatusPill)
- **Variants:** with / without meta, badges and trailing
- **States:** default, hover (`surface-muted`), focus-visible (global ring)
- **Usage:** `<LinkRow href={itemHref(item)} title="Two Sum" titleLang="en" meta={['#1', 'Easy']}
  trailing={<StatusPill status="not-started" />} />` — every item Row, RelatedItems
- **Accessibility:** the whole row is one `next/link` (`min-h-11`, ≥ 44 px); its accessible name
  reads as words ("Two Sum #1 Easy Arrays & Hashing Chưa học"): spaces sit between the parts,
  outside the `aria-hidden` "·" separators; the title carries `lang` for English content; the
  chevron is decorative

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
- **States:** no active track → an EmptyState "Chưa có lộ trình nào để học" instead of the steps
  (RF-4); per step: default, field errors (under the field + FormErrorSummary at the top);
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
  `aria-label?` (the group's name — one is needed), `aria-describedby?` (an error line under the
  group, settings), `aria-invalid?: boolean` (a field error — the group carries it, not each radio,
  ruling R9; settings, M2 minor)
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
  rows are DataList items (≥ 44 px); the admin and "Bạn" badges are text, never colour alone;
  each row's content is a programmatic focus target (`id={userRowId(user.id)}`, `tabIndex={-1}`,
  `features/admin/components/user-row-id.ts`) that UserRowActions focuses after an action

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
  focus trapped. **Focus after an action** (WCAG 2.4.3): once the list shows the row in another
  status or role — moved to another section (a new instance mounts there) or changed in place —
  keyboard focus goes to that row's target (scrolled into view only as far as needed); a
  cancelled dialog or a failure that changes nothing returns focus to the pressed button (the
  role button is keyed by its slot, so promote ↔ demote keeps the same element); names are
  inserted literally (a replacer function, so `$&` in a display name stays text)

### Landing

- **Layer:** feature (`features/auth`)
- **File:** `features/auth/components/landing.tsx`
- **Props:** `deleted?: boolean` (default `false`; `?account=deleted`, §4.6)
- **Variants:** default · deleted (an info Banner "Tài khoản của bạn đã được xoá." above the
  wordmark)
- **States:** static
- **Usage:** `<FocusLayout><Landing deleted={params.account === 'deleted'} /></FocusLayout>`
  (`app/(public)/page.tsx`, signed-out only — a signed-in visitor is redirected to
  `homePathFor(user)` before this renders)
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
  region named by its h2 "Đăng nhập thử nghiệm" containing a form of its own, named "Biểu mẫu đăng
  nhập thử nghiệm" — a distinct name from the region's, not the same one twice (M2 minor,
  landmark-unique) — with labelled, required e-mail and password fields (`autocomplete` username /
  current-password) and its error in an always-mounted `role="alert"` region, so it is announced
  when it appears

### StatusWatcher

- **Layer:** feature (`features/auth`, client)
- **File:** `features/auth/components/status-watcher.tsx`
- **Props:** `paused?: boolean` (default `false`) — stops the interval and every listener; the
  catalog demo sets it, so `/dev/components` runs no live 30 s interval in the background
- **Variants:** none
- **States:** renders nothing — it exists only for its effect
- **Usage:** `<StatusWatcher />` inside `/pending` (`app/(account)/pending/page.tsx`); refreshes
  the server page (`router.refresh()`) every 30 s while the tab is visible, on `focus` and when the
  tab becomes visible again, so the redirect to the user's home path fires as soon as an admin
  approves the account — the interval itself checks `document.visibilityState`, so a hidden tab
  never refreshes on the tick (M2 minor)
- **Accessibility:** no visible output, nothing to announce

### AdminLink

- **Layer:** feature (`features/settings`, server-compatible — no hooks)
- **File:** `features/settings/components/admin-link.tsx`
- **Props:** `isAdmin: boolean` (`SessionUser.isAdmin`)
- **Variants:** admin (the row) · learner (renders nothing)
- **States:** default, hover (`surface-muted`), focus-visible
- **Usage:** `<AdminLink isAdmin={data.user.isAdmin} />` right under the PageHeader of
  `app/(app)/settings/page.tsx`
- **Accessibility:** a link to `/admin` (≥ 44 px) named "Quản trị" followed by its description;
  the icons are decorative. It exists because the bottom navigation has no admin item, so admin
  pages stay reachable on a phone (DESIGN_SYSTEM §5)

### ScheduleForm

- **Layer:** feature (`features/settings`, client)
- **File:** `features/settings/components/schedule-form.tsx`
- **Props:** `schedule: Schedule` (in force now), `pendingSchedule: (Schedule & { effectiveAt })
  | null`, `timeZones: readonly string[]` (built on the server), `requestId: string` (per render,
  decision 9), `updateSchedule: SettingsAction` — the action comes in as a prop, so the catalog
  passes a no-op
- **Variants:** no change pending · a change pending (the fields show the pending values, which a
  save is compared with, and an info Banner "Thay đổi áp dụng từ {ngày} lúc {giờ} (giờ {múi giờ
  cũ}) — ngày đang học không bị ảnh hưởng.", on the clock of the zone in force, §5.9)
- **States:** idle; saving ("Lưu lịch học" busy); saved (toast; the page re-renders and the fields
  follow the saved values); failed (danger Banner in an always-mounted `role="alert"` region, field
  errors under the fields)
- **Usage:** `<ScheduleForm schedule={data.schedule} pendingSchedule={data.pendingSchedule}
  timeZones={data.timeZones} requestId={data.requestId} updateSchedule={updateSchedule} />`
- **Accessibility:** a `form` named "Lịch học"; labelled native selects (time zone — a saved zone
  the list lacks is still listed — and day start with its helper); `aria-invalid` and the error in
  `aria-describedby`; submits through `onSubmit` (no form reset), and ignores a second submit while
  saving

### TrackSettings

- **Layer:** feature (`features/settings`, client)
- **File:** `features/settings/components/track-settings.tsx`
- **Props:** `tracks: SettingsTrack[]` (every active track with the learner's enrollment — only
  active and paused ones are shown), `requestId: string`, `updateTrack: SettingsAction`,
  `setTrackStatus: SettingsAction`
- **Variants:** per track: active ("Đang học" `success` Badge; "Tạm dừng", "Gỡ lộ trình") · paused
  ("Tạm dừng" `warning` Badge; "Tiếp tục", "Gỡ lộ trình"); a track with several roadmaps shows the
  VariantPicker, one roadmap shows it as text (TrackBudgetFields)
- **States:** empty (EmptyState "Bạn chưa học lộ trình nào"); per track: saving ("Lưu" busy), a
  status change running (the pressed button busy, the other disabled), confirming the removal
  (destructive ConfirmDialog "Gỡ lộ trình {title}?"), failed (danger Banner in the track, under
  `role="alert"`, and field errors); the weekly template and throttle are read-only
  (WeeklyTemplatePreview "Mẫu tuần"; editing is later, §0)
- **Usage:** `<TrackSettings tracks={data.tracks} requestId={data.requestId}
  updateTrack={updateTrack} setTrackStatus={setTrackStatus} />`
- **Accessibility:** each track is a region named by its h3 title; its form is named the same; the
  status buttons sit in a group "Thao tác với {title}". "Tạm dừng" and "Tiếp tục" are one button
  (keyed by its slot), so it keeps focus when the status flips; after a removal the list itself
  (`tabIndex={-1}`) takes focus, since the removed track's buttons are gone (WCAG 2.4.3); results
  are toasts, failures also stay in the track. A status-change failure is kept by the list itself,
  keyed by track id — not by the row (M2 minor): a stale re-render can drop the track from the
  list before the learner has read why, so the failure (with the track's last known title) still
  shows as its own line even once the row is gone

### TrackBudgetFields

- **Layer:** feature (`features/settings`, client)
- **File:** `features/settings/components/track-budget-fields.tsx`
- **Props:** `track: Pick<TrackOption, 'id' | 'roadmaps'>`, `minutes: string` (as typed),
  `onMinutesChange`, `variant: string`, `onVariantChange`, `fallbackMinutes: number` (the budget
  the finish line uses while the typed minutes are not a valid budget), `errors: Record<string,
  string>` (`budgetMinutes`, `roadmapVariant`)
- **Variants:** several roadmaps (VariantPicker with the simulated finish, §5.11) · one roadmap
  (text, sent through a hidden field)
- **States:** default; with field errors
- **Usage:** inside a settings form — TrackSettings and AddTrackForm: `<TrackBudgetFields
  track={option} minutes={minutes} onMinutesChange={setMinutes} variant={variant}
  onVariantChange={setVariant} fallbackMinutes={60} errors={errors} />`
- **Accessibility:** a labelled number field "Số phút mỗi ngày" with its helper; the variant
  radiogroup is named "Phiên bản lộ trình" by a visible line and points `aria-describedby` at its
  error; the form values are named `budgetMinutes` and `roadmapVariant`

### AddTrackForm

- **Layer:** feature (`features/settings`, client)
- **File:** `features/settings/components/add-track-form.tsx`
- **Props:** `tracks: SettingsTrack[]` (removed and never-enrolled tracks are offered),
  `schedule: Schedule` (in force: today and the date range), `now: string`, `requestId: string`,
  `enrollTrack: SettingsAction`
- **Variants:** a removed track ("Đã gỡ" Badge; starts from its last minutes and variant —
  re-adding keeps the history, §5.9) · a never-enrolled track (the suggested-minutes Badge;
  default minutes, the variant following the minutes until picked, ADR-0015)
- **States:** empty (EmptyState "Bạn đang học tất cả lộ trình hiện có"); idle; adding ("Thêm lộ
  trình" busy); added (toast; the track moves to TrackSettings); failed (danger Banner under
  `role="alert"`, field errors)
- **Usage:** `<AddTrackForm tracks={data.tracks} schedule={data.schedule} now={data.now}
  requestId={data.requestId} enrollTrack={enrollTrack} />`
- **Accessibility:** a `form` named "Thêm lộ trình"; the tracks are ChoiceCard radios in a group
  "Lộ trình"; the start date is a labelled date field (today to 60 days ahead, decision 22); when
  the last candidate is added and the form goes away, its container takes focus. Its server errors
  and pending state are shown only while they belong to the currently picked candidate (M2 minor):
  switching the radio to a different track before the result arrives (or after a failure) hides
  them at once, so a previous candidate's failure never shows against the next one's fields — the
  typed minutes and picked variant stay, kept per track id

### CodeLanguageForm

- **Layer:** feature (`features/settings`, client)
- **File:** `features/settings/components/code-language-form.tsx`
- **Props:** `codeLanguage: CodeLanguage | null` (`null` reads as Python), `requestId: string`,
  `updateCodeLanguage: SettingsAction`
- **Variants:** —
- **States:** idle; saving ("Lưu" busy); saved (toast); failed (danger Banner under
  `role="alert"`, the error under the group)
- **Usage:** `<CodeLanguageForm codeLanguage={data.user.codeLanguage} requestId={data.requestId}
  updateCodeLanguage={updateCodeLanguage} />`
- **Accessibility:** a `form` and a radiogroup both named "Ngôn ngữ lập trình"; Python / Java /
  Go as ChoiceCard radios (the card is the target, `gap-3`)

### DeleteAccount

- **Layer:** feature (`features/settings`, client)
- **File:** `features/settings/components/delete-account.tsx`
- **Props:** `deleteAccount: SettingsAction` — the action comes in as a prop, so the catalog
  passes a no-op; "what is deleted" is the Section's own description, above this (§4.6)
- **Variants:** —
- **States:** idle; confirming (destructive ConfirmDialog "Xoá tài khoản vĩnh viễn?", restating the
  consequences and the privacy sentence); a successful delete redirects away (`/?account=deleted`),
  so it is never seen here; failed (danger Banner under `role="alert"`, the dialog closes)
- **Usage:** `<DeleteAccount deleteAccount={deleteAccount} />` (`app/(app)/settings/page.tsx`,
  the last Section)
- **Accessibility:** an info Banner states the backup-retention notice: "Dữ liệu đã xoá vẫn có thể
  tồn tại trong bản sao lưu đã mã hoá tối đa 90 ngày."; "Xoá vĩnh viễn" is destructive and asks
  first, like TrackSettings' "Gỡ lộ trình"

### Roadmap components (`features/roadmap/components`)

`/tracks`, the track page `/t/[trackId]` and the item route (task 3.4b). They take plain props —
`TrackSummary`, `Enrollment` and `VariantLink` from `features/roadmap/queries.ts` (types only) —
and ReactNode slots, and **never import the item registry** (fix 5): the track page builds each
row with `roadmapSlots(view, (item, { mode }) => renderItemRow(item, { state: null, mode: mode ??
undefined }))`, so every component here renders in the client catalog with plain nodes.
Server-compatible (no `'use client'`). Copy: `vi.roadmap`. `ItemBody` (task 5.1c, ruling M5-R6) is
not one of these components — a render helper beside `queries.ts` (`features/roadmap/item-body.tsx`,
not under `components/`), described under ItemView below, the one place it renders.

### TrackList

- **Layer:** feature (`features/roadmap`, server-compatible)
- **File:** `features/roadmap/components/track-list.tsx`
- **Props:** `mine: { track: TrackSummary; enrollment: Enrollment }[]`, `others: TrackSummary[]`
  (`getTracksOverview()`)
- **Variants:** —
- **States:** both lists → Section "Lộ trình của bạn" + Section "Lộ trình khác" (a grid of
  TrackCards each); no other track → "Bạn đang học tất cả lộ trình hiện có."; nothing followed →
  an h3 EmptyState "Bạn chưa học lộ trình nào" with "Mở Cài đặt" (`/settings`); no track at all →
  one EmptyState "Chưa có lộ trình nào" and no sections (RF-4)
- **Usage:** `<TrackList mine={mine} others={others} />` (`app/(app)/tracks/page.tsx`, under the
  PageHeader)
- **Accessibility:** each Section is a region named by its `h2`; the cards are a `role="list"`
  grid (one column on a phone, two from 768 px)

### TrackCard

- **Layer:** feature (`features/roadmap`, server-compatible)
- **File:** `features/roadmap/components/track-card.tsx`
- **Props:** `track: TrackSummary`, `enrollment: Enrollment | null` (null: another track)
- **Variants:** enrolled — status Badge ("Đang học" primary / "Tạm dừng" warning), "8 tuần · 60
  phút mỗi ngày", "Xem lộ trình" · another active track — "Xem lộ trình" + "Thêm trong Cài đặt"
  (`/settings`) · draft (admins) — ItemStatusBadge "Bản nháp", no Settings link · retired —
  "Đã ngừng" and a warning Banner "Lộ trình đã ngừng — không nhận học viên mới."
- **States:** static
- **Usage:** `<TrackCard track={track} enrollment={enrollment} />` (TrackList)
- **Accessibility:** an `article` named by its `h3` (the Vietnamese title); the track chip is a
  `Badge tone="track"` in `data-accent` holding the English title in `lang="en"` (the name, never
  colour alone); "Xem lộ trình" carries the track title as `sr-only` text, so the links of a list
  of cards stay distinct; links are 44 px buttons

### TrackOverview

- **Layer:** feature (`features/roadmap`, server-compatible)
- **File:** `features/roadmap/components/track-overview.tsx`
- **Props:** `track: TrackSummary`, `enrollment: Enrollment | null`, `variants: VariantLink[]`,
  `template: TemplateDay[]`, `throttle: string[]` (from `getTrackPage()`), `children` (RoadmapView
  or its empty state)
- **Variants:** header action — the status Badge when enrolled, "Thêm trong Cài đặt" for an active
  track the learner does not follow, nothing otherwise · notice — draft (info Banner "Bản nháp:
  chỉ quản trị viên thấy lộ trình này.") or retired (warning Banner)
- **States:** static
- **Usage:** `<TrackOverview track={…} enrollment={…} variants={…} template={…}
  throttle={…}>{slots ? <RoadmapView slots={slots} /> : <EmptyState … />}</TrackOverview>`
  (`app/(app)/t/[trackId]/page.tsx`)
- **Accessibility:** a `contents` wrapper with `data-accent` (keeps the page's section spacing);
  PageHeader `h1` = the Vietnamese title, its description the English title in `lang="en"`; then
  VariantLinks and a Section "Mẫu tuần" holding WeeklyTemplatePreview

### VariantLinks

- **Layer:** feature (`features/roadmap`, server-compatible)
- **File:** `features/roadmap/components/variant-links.tsx`
- **Props:** `variants: { id; label; href; current }[]` (`label` = `variantLabel(id)`, `href` =
  `/t/<track>?variant=<id>`)
- **Variants:** `cva` `current` true (`primary-soft`, `border-primary`, semibold, check icon) ·
  false (outline, hover `surface-muted`)
- **States:** default, hover, focus-visible, current
- **Usage:** `<VariantLinks variants={data.variants} />` (TrackOverview)
- **Accessibility:** a `nav` named by its visible label "Phiên bản lộ trình"; the current link has
  `aria-current="true"` plus a check and weight (never colour alone); 44 px links

### WeekSection

- **Layer:** feature (`features/roadmap`, server-compatible; also exports the `RoadmapGroup`,
  `RowGroup`, `DeckList` and `DeckCard` parts RoadmapView reuses)
- **File:** `features/roadmap/components/week-section.tsx`
- **Props:** `week: WeekSlots` (`roadmapSlots`: `{ week, topics, lessons, core, recap: { row, mode
  }[], bonus, decks: { deck, core, extended }[], exercises, prompts }`, rows as ReactNodes)
- **Variants:** groups, each only when it has rows and in this order — "Bài học", "Bài chính",
  "Ôn lại cuối tuần" (a mode label "Làm lại" / "Nhớ lại" / "Giải thích thành lời" above a
  revisiting row; none on an entry that introduces its item), "Bài thêm", "Bộ thẻ" (per deck: the
  title, "{core} thẻ cốt lõi · {extended} thẻ mở rộng", the cards in a `<details>` "Xem các thẻ"),
  "Bài tập", "Nhiệm vụ"
- **States:** with rows · empty (every item still a draft, RF-4) — "Tuần này chưa có nội dung."
- **Usage:** `<WeekSection week={slots.weeks[0]} />` (RoadmapView)
- **Accessibility:** a Section (region named by its `h2` "Tuần {n}"); topics are a list named "Chủ
  đề" of neutral Badges; each group is an `h3` naming its `role="list"` (`aria-labelledby`), deck
  titles are `h4`; `<details>` / `<summary>` is the native disclosure (keyboard, 44 px summary)

### RoadmapView

- **Layer:** feature (`features/roadmap`, server-compatible)
- **File:** `features/roadmap/components/roadmap-view.tsx`
- **Props:** `slots: RoadmapSlots` (`{ variant, weeks: WeekSlots[], anytime: { prompts:
  ReactNode[], derivedDecks: { deck, unlocked }[] } }`)
- **Variants:** with / without the final Section "Không theo tuần" (repeatable prompts under
  "Nhiệm vụ"; derived decks under "Bộ thẻ" with "{n} thẻ" and "Mỗi thẻ mở sau khi bạn làm bài
  gốc.") — left out when empty
- **States:** static
- **Usage:** `<RoadmapView slots={roadmapSlots(view, renderRow)} />` (`/t/[trackId]`)
- **Accessibility:** one region per week, in order; a `contents` wrapper, so the sections keep the
  page's spacing

### ItemView

- **Layer:** feature (`features/roadmap`, server-compatible)
- **File:** `features/roadmap/components/item-view.tsx`
- **Props:** `backHref: string`, `trackTitle: string`, `page: ReactNode` (`<ItemBody item viewer
  resolveItem />`, task 5.1c). **No `notice` prop** (M3-R4): the page's ItemPageFrame owns the
  draft / retired notice, so ItemView never renders a second one
- **Variants:** —
- **States:** `page` pending — `<Suspense>` shows LoadingState `variant="page"` (task 5.1c: the
  route validates its params and calls `notFound()` before `page` is built, so only this part ever
  suspends — never the 404 check itself) · ready — `page`
- **Usage:** `<ItemView backHref={model.backHref} trackTitle={model.track.title} page={<ItemBody
  item={model.item} viewer={model.viewer} resolveItem={model.resolveItem} />} />`
  (`app/(app)/t/[trackId]/items/[itemId]/page.tsx`)
- **Accessibility:** the back link "Về lộ trình {title}" (44 px, chevron decorative) comes first
  — "Về danh sách lộ trình" when `backHref` is `TRACKS_HREF` (`/tracks`: the loader's choice for
  a retired track the learner does not follow, whose page is a 404); the page brings its own
  `h1`; a `contents` wrapper keeps the page's spacing
- **`ItemBody`** (`features/roadmap/item-body.tsx`, task 5.1c, ruling M5-R6): the `page` prop
  above, not a catalog component — a render helper beside `queries.ts` (like `renderItemPage`
  beside `features/items`'s own loaders), so it is out of scope for `/dev/components` and has no
  entry of its own. An async server component: `await renderItemPage(item, { state: null, context:
  {}, viewer, resolveItem })` and renders the result; results (a non-null `state`) arrive with task
  5.2. It renders only as `ItemView`'s `page`, inside its `<Suspense>` boundary.

### MDX content components (`features/items/components/mdx`)

The components content MDX may use (allow-list: `tools/content/allowlist.ts`, platform design
§3.5) and the Markdown overrides, rendered by `@next/mdx` through `mdx-components.tsx` →
`features/items/mdx/components.tsx` (`mdxComponents`; `Solution` and `Practice` render nothing
there). A page binds its data with `mdxComponentsFor({ code, codeLanguage, resolvePractice })`
(`features/items/mdx/bind.tsx`: `Solution`, `Practice`, `pre`) and renders
`<Body components={mdxComponentsFor(…)} />`. GFM extras: a task-list checkbox renders as a
marker (icon + visually hidden "Đã xong" / "Chưa xong", never a control) and column alignment maps
to `text-left` / `text-center` / `text-right` (no style attribute). All are client-safe, so the
catalog renders them;
only Quiz, Reveal and SolutionTabs are client components. Keyed copy (`vi.content.sections[kind]`,
callout labels, language names) is read with `Object.hasOwn`. Samples: `/dev/content`
(`app/dev/content/sample-{lesson,note}.mdx`, e2e + axe). Authoring rules: ADR-0011.

### MdxSection

- **Layer:** feature (`features/items`, server-compatible; exported as `Section`, catalogued as
  MdxSection beside the Section pattern)
- **File:** `features/items/components/mdx/section.tsx`
- **Props:** `kind: string`, `children`
- **Variants:** a labelled kind (`vi.content.sections`: signals "Dấu hiệu nhận biết", analogy "Ví
  dụ đời thường", visual "Minh hoạ", approach "Cách tiếp cận", code "Code", complexity "Độ phức
  tạp", bilingual "Giải thích song ngữ", practice "Luyện tập", quiz "Kiểm tra nhanh") · any other
  kind shows its ID (decision 33)
- **States:** static
- **Usage:** `<Section kind="signals">…</Section>` (lessons only)
- **Accessibility:** `<section data-section={kind} aria-labelledby>` (a region) named by its `h2`
  (`useId`); lesson headings inside are `###` / `####`

### Callout

- **Layer:** feature (`features/items`, server-compatible)
- **File:** `features/items/components/mdx/callout.tsx`
- **Props:** `tone: 'info' | 'tip' | 'warning'`, `title?: string`, `children`
- **Variants:** cva `tone`: info `bg-primary-soft` + `Info` · tip `bg-success-soft` + `Lightbulb`
  · warning `bg-warning-soft` + `TriangleAlert` (text in the matching `-soft-foreground`); an
  unknown tone falls back to info
- **States:** static
- **Usage:** `<Callout tone="tip" title="Dấu hiệu">…</Callout>`
- **Accessibility:** `role="note"`; the icon is `aria-hidden` and a visible label ("Lưu ý" / "Mẹo"
  / "Cẩn thận", or `title`) names the tone — never colour alone

### Steps

- **Layer:** feature (`features/items`, server-compatible; `Steps` and `Step`)
- **File:** `features/items/components/mdx/steps.tsx`
- **Props:** `Steps`: `children` (Steps) · `Step`: `title?: string`, `children` (a line of text or
  paragraphs)
- **Variants:** step with / without a title
- **States:** static; an empty `<Steps>` renders nothing (the check rejects one)
- **Usage:** `<Steps><Step title="Khởi tạo">Đặt left bằng 0.</Step><Step>…</Step></Steps>`
- **Accessibility:** a native `<ol>` (`list-decimal`) — the numbers are the list's own

### VarTable

- **Layer:** feature (`features/items`, server-compatible)
- **File:** `features/items/components/mdx/var-table.tsx`
- **Props:** `caption?: string`, `children` (one GFM table)
- **Variants:** with caption · without (named "Bảng biến")
- **States:** static; scrolls sideways when wider than the column
- **Usage:** `<VarTable caption="nums = [2, 7], target = 9">` + a Markdown table
- **Accessibility:** a focusable scroll region (`role="region"`, `tabIndex={0}`, `aria-label` =
  caption) so keyboard users can scroll it; cells in mono. The Markdown `table` override frames a
  table outside VarTable the same way ("Bảng"); inside VarTable it is told not to (one region)

### Complexity

- **Layer:** feature (`features/items`, server-compatible)
- **File:** `features/items/components/mdx/complexity.tsx`
- **Props:** `time: string`, `space: string`
- **Variants:** —
- **States:** static
- **Usage:** `<Complexity time="O(n)" space="O(1)" />`
- **Accessibility:** a group named "Độ phức tạp" around a `<dl>`: "Thời gian" / "Bộ nhớ" →
  values in `font-mono`

### Bilingual

- **Layer:** feature (`features/items`, server-compatible)
- **File:** `features/items/components/mdx/bilingual.tsx`
- **Props:** `vi: string`, `en: string`
- **Variants:** —
- **States:** static
- **Usage:** `<Bilingual vi="…" en="…" />` (a note's one becomes its "Explaining code" card)
- **Accessibility:** a `<dl>`: "Tiếng Việt" then "English", the English line in `lang="en"`

### Term

- **Layer:** feature (`features/items`, server-compatible; inline)
- **File:** `features/items/components/mdx/term.tsx`
- **Props:** `vi?: string` (a Vietnamese gloss), `children` (the English term)
- **Variants:** with / without the gloss
- **States:** static
- **Usage:** `Dùng <Term vi="hai con trỏ">two pointers</Term> nhé.` → "two pointers (hai con trỏ)"
- **Accessibility:** the term is a `<span lang="en">`; the gloss stays Vietnamese

### PracticeCard

- **Layer:** feature (`features/items`, server-compatible)
- **File:** `features/items/components/mdx/practice-card.tsx`
- **Props:** `PracticeTarget`: `title: string`, `href: string`, `leetcode: number | null`,
  `difficulty: 'E' | 'M' | 'H' | null`
- **Variants:** with / without the LeetCode number and difficulty
- **States:** default, hover (`shadow-sm`), focus-visible
- **Usage:** rendered by the bound `<Practice problem="dsa:lc-0015" />`
  (`mdxComponentsFor`; an unknown ID renders nothing)
- **Accessibility:** one link wrapping a Card, named as words ("Bài luyện tập #15 3Sum Medium"):
  the title in `lang="en"` and the difficulty as the one DifficultyBadge ("Easy" / "Medium" /
  "Hard", M3-R3 — text, never colour alone)

### Quiz

- **Layer:** feature (`features/items`, client; `Quiz`, `Question`, `Choice`)
- **File:** `features/items/components/mdx/quiz.tsx`
- **Props:** `Quiz`: `onScore?: ({ correct, total, percent }) => void` (percent rounded; 5.2 sends
  it as `lesson.completed { quizScore }`) · `Question`: `prompt: string`, `answer: string` (a
  Choice id) · `Choice`: `id: string`, `children`
- **Variants:** —
- **States:** answering; checked ("Kiểm tra": choices locked, a verdict under each question —
  icon + "Chính xác" or "Chưa đúng — đáp án: …" — an unanswered question counts as wrong, the
  score "Đúng {correct}/{total}"); "Làm lại" clears; an empty quiz scores 0/0 (percent 0)
- **Usage:** `<Quiz><Question prompt="…" answer="b"><Choice id="a">…</Choice><Choice
  id="b">…</Choice></Question></Quiz>`
- **Accessibility:** each question a `<fieldset>` with the prompt as `<legend>`; native radios
  (one group per question, so arrow keys move within it) on ≥ 44 px cards. A choice may hold
  paragraphs, which a `<label>` cannot, so each radio is named by its content (`aria-labelledby`)
  and an empty `<label>` stretched over the card makes the whole card the target; the verdict is a
  `<div>` (the answer may be a paragraph). The checked choice shows on the radio, not colour
  alone; the score is announced in a polite `role="status"`; the check/retry button keeps focus

### Reveal

- **Layer:** feature (`features/items`, client)
- **File:** `features/items/components/mdx/reveal.tsx`
- **Props:** `label?: string`, `children`
- **Variants:** default label "Xem" / "Ẩn" · a custom label (both states)
- **States:** closed (content `hidden`), open
- **Usage:** `<Reveal label="Gợi ý">…</Reveal>`
- **Accessibility:** an outline Button with `aria-expanded` and `aria-controls`; the chevron is
  `aria-hidden`

### SolutionTabs

- **Layer:** feature (`features/items`, client)
- **File:** `features/items/components/mdx/solution-tabs.tsx`
- **Props:** `solutions: Partial<Record<'python' | 'java' | 'go', HighlightedCode>>`,
  `defaultLanguage: CodeLanguage`, `onReveal?: () => void` (fires on the first reveal only; 5.2
  preselects "Cần gợi ý")
- **Variants:** Python / Java / Go tabs — only the languages present, in that order
- **States:** hidden ("Xem lời giải"; no code in the DOM); open on the viewer's language, else the
  first ("Ẩn lời giải" hides it again); no solutions → nothing
- **Usage:** rendered by the bound `<Solution />` (`mdxComponentsFor`; `code: null` → nothing)
- **Accessibility:** the toggle has `aria-expanded` / `aria-controls`; ui Tabs named "Ngôn ngữ lời
  giải" (language names from `vi.onboarding.language`, the one source); each panel a CodeBlock
  region "Lời giải Python" / "Java" / "Go" (DESIGN_SYSTEM §9)

### CodePre

- **Layer:** feature (`features/items`, server-compatible)
- **File:** `features/items/components/mdx/code-pre.tsx`
- **Props:** `code: CodeBundle | null`, `children` (MDX's `code` child: `language-<lang>` + the
  fence text with one trailing newline)
- **Variants:** a known block (build-time token classes from `code.blocks[codeBlockKey(lang,
  text)]`) · plain text (unknown block, no bundle, no language — never a crash)
- **States:** static
- **Usage:** the MDX `pre` override (plain in the global map, bound by `mdxComponentsFor`)
- **Accessibility:** a CodeBlock region named "Đoạn code Python" (or "Đoạn văn bản" for `text`)

### ExternalLink

- **Layer:** feature (`features/items`, server-compatible)
- **File:** `features/items/components/mdx/external-link.tsx`
- **Props:** `a` props (`href`, `children`); `className` (code only — Markdown cannot set it)
  replaces the inline link style
- **Variants:** an `https:` link · anything else renders as plain text (fail closed) · with a
  `className`, e.g. `buttonVariants(…)` for ProblemPage's "Mở trên LeetCode" and free alternatives
- **States:** default, hover (`primary-hover`), focus-visible
- **Usage:** the MDX `a` override: `[bài viết](https://…)`; any link that leaves the app
- **Accessibility:** `target="_blank" rel="noopener noreferrer"`; the icon is `aria-hidden` and a
  visually hidden "(mở trong tab mới)" is part of the name

### ContentImage

- **Layer:** feature (`features/items`, client-safe — `next/image`)
- **File:** `features/items/components/mdx/content-image.tsx`
- **Props:** `img` props: `src`, `alt`, `title` (`"WIDTHxHEIGHT"`, OD3); `baseUrl?: string`
  (default `CONTENT_IMAGE_BASE_URL` from `lib/content/images.ts`; code only — the catalog passes
  `/dev/` for its local sample, Markdown cannot set it)
- **Variants:** raster (`png`, `webp`, `jpg`) through Next's optimiser (`images.remotePatterns`
  from `CONTENT_IMAGE_BASE_URL`) · SVG `unoptimized`
- **States:** lazy-loaded; fails closed — a source outside `baseUrl`, an empty base or an
  unparsable size title renders nothing (the check rejects them). SVGs need an opaque background
  (runbook §2): `currentColor` in an `<img>` is black in both themes
- **Usage:** the MDX `img` override: `![alt](<bucket URL> "640x360")` — runbook
  `docs/ops/content-images.md`
- **Accessibility:** the alt text is required by the check; `h-auto max-w-full`, no `title`
  attribute

### Item components (`features/items/components`)

The parts item Pages and Rows are built from (task 3.4a). All are client-safe, so the catalog
renders them; FlashcardView, FillBlankExercise and SelfGradedExercise are client components. They
take plain props (catalog content, never the registry). Copy: `vi.items`.

### DifficultyBadge

- **Layer:** feature (`features/items`, server-compatible; also exports `PremiumBadge`)
- **File:** `features/items/components/difficulty-badge.tsx`
- **Props:** `difficulty: 'E' | 'M' | 'H'` · `PremiumBadge`: none
- **Variants:** Easy (`success`) · Medium (`warning`) · Hard (`danger`) — LeetCode's terms stay
  English · PremiumBadge: outline, `Lock` + "Premium"
- **States:** static
- **Usage:** `<DifficultyBadge difficulty="M" />`, `{problem.premium && <PremiumBadge />}`
- **Accessibility:** the difficulty is text on the badge, never colour alone; the lock is
  decorative. The one source of difficulty labels (M3-R3): PracticeCard and the Rows' meta read
  `vi.items.difficulty` too

### VerificationBadge

- **Layer:** feature (`features/items`, server-compatible)
- **File:** `features/items/components/verification-badge.tsx`
- **Props:** `verification: 'tested' | 'compile-only'`, `variant?: 'full' | 'icon'`
- **Variants:** tested — success Badge, `CircleCheck`, "Đã kiểm thử" · compile-only — neutral
  Badge, `Info`, "Chỉ biên dịch"; `full` (pages) adds the one-line explanation, `icon` (rows) is
  the icon alone
- **States:** static
- **Usage:** `<VerificationBadge verification={note.verification} />` (problem page, when the note
  shows) · `variant="icon"` (ProblemRow)
- **Accessibility:** icons `aria-hidden`; the icon variant keeps the label as `sr-only` text

### ItemStatusBadge

- **Layer:** feature (`features/items`, server-compatible; also exports `ItemStatusNotice`)
- **File:** `features/items/components/item-status-badge.tsx`
- **Props:** `status: 'draft' | 'active' | 'retired'` (both components)
- **Variants:** badge (rows, a note): draft — warning, `PencilLine`, "Bản nháp" · retired —
  neutral, `Archive`, "Đã ngừng" · notice (the top of a page, a Banner): draft — info, "Bản nháp:
  chỉ quản trị viên thấy mục này." · retired — warning, "Mục này đã ngừng: không còn được xếp vào
  kế hoạch học."
- **States:** `active` renders nothing
- **Usage:** `rowBadges(item.status)` in every Row; ItemPageFrame renders the notice
- **Accessibility:** icon + label (never colour alone); the notice is one sentence

### ItemPageFrame

- **Layer:** feature (`features/items`, server-compatible)
- **File:** `features/items/components/item-page-frame.tsx`
- **Props:** `status: ItemStatus`, `title?: ReactNode` (the page `h1`; omitted when the body renders
  it — a flashcard's front), `description?`, `actions?`, `meta?: ReactNode[]` (facts; empty ones
  dropped), `children`
- **Variants:** with / without title, facts
- **States:** draft / retired notice at the top; active: none. **It owns the notice (M3-R4):** the
  Page passes `item.status`, so the item route (3.4b's `ItemView`) renders no banner of its own —
  it wraps the Page and adds only its back link
- **Usage:** every item Page: `<ItemPageFrame status={item.status} title={…} meta={[…]}>…</ItemPageFrame>`
- **Accessibility:** one `h1` per page (PageHeader); the notice comes first in reading order

### RelatedItems

- **Layer:** feature (`features/items`, server-compatible)
- **File:** `features/items/components/related-items.tsx`
- **Props:** `items: { label: string; link: ItemLink }[]`
- **Variants:** —
- **States:** empty → nothing
- **Usage:** a lesson's anchor / about / practice problems, a problem's deep-dive lesson —
  `resolveItem(id)` results (an unknown ID is skipped by the page)
- **Accessibility:** a list named "Bài liên quan"; each a LinkRow — the role label, `#leetcode`
  and difficulty as text; LeetCode titles in `lang="en"`

### RubricList

- **Layer:** feature (`features/items`, server-compatible)
- **File:** `features/items/components/rubric-list.tsx`
- **Props:** `items: readonly string[]`, `lang?: 'en' | 'vi'` (the content's `lang.rubric`,
  default `vi`, M3-R5), `headingLevel?: 2 | 3` (default 2)
- **Variants:** an English rubric (`lang="en"` on the list) · a Vietnamese one (the page's
  language, no attribute) — whichever the prompt or exercise declares
- **States:** empty → nothing
- **Usage:** `<RubricList items={prompt.rubric} lang={prompt.lang.rubric} />`; inside
  SelfGradedExercise's sample-answers panel with `headingLevel={3}`
- **Accessibility:** a heading "Tiêu chí" names the list (`aria-labelledby`); the list carries the
  rubric's language (WCAG 3.1.2); check icons decorative

### FlashcardView

- **Layer:** feature (`features/items`, client)
- **File:** `features/items/components/flashcard-view.tsx`
- **Props:** `card: FlashcardSides` (`front`, `back`, `hint?`, `usage?`, `example?`,
  `pronunciation?`, `lang`), `headingLevel?: 1 | 2 | 3` (1 on the item page)
- **Variants:** vocabulary card (usage, example, pronunciation) · recall / derived card (back and
  hint only, each side in its own language)
- **States:** front only ("Xem nghĩa", primary); revealed (back, hint, "danh từ · trung tính" +
  note, example, pronunciation; "Ẩn nghĩa", outline). No grade buttons until task 5.2
- **Usage:** `<FlashcardView card={item.content} headingLevel={1} />` (FlashcardPage)
- **Accessibility:** the front is a heading in the card's front language; the toggle has
  `aria-expanded` / `aria-controls`; nothing of the back is in the DOM until revealed; the example
  and pronunciation are `lang="en"`; fields are a `<dl>`

### FillBlankExercise

- **Layer:** feature (`features/items`, client)
- **File:** `features/items/components/fill-blank-exercise.tsx`
- **Props:** `text: string` (holds `{{blank}}` once), `answers: readonly string[]`, `hint?: string`
- **Variants:** with / without a hint
- **States:** answering; checked — pass ("Chính xác", `CircleCheck`, success), close ("Gần đúng —
  bạn đã xem gợi ý", `CircleDot`, warning), miss ("Chưa đúng — đáp án: …", `CircleX`, danger);
  editing the answer clears the verdict; hint hidden / shown
- **Usage:** `<FillBlankExercise text={ex.text} answers={ex.answers} hint={ex.hint} />`
  (ExercisePage); grading is `gradeFillBlank` (NFC, case- and whitespace-insensitive, [RF-3])
- **Accessibility:** the text is `lang="en"`; the blank is a real input with a visually hidden
  Vietnamese label "Từ còn thiếu" (`lang="vi"`); Enter submits; the verdict is icon + text in a
  polite `role="status"`; the hint toggle has `aria-expanded` / `aria-controls`

### SelfGradedExercise

- **Layer:** feature (`features/items`, client)
- **File:** `features/items/components/self-graded-exercise.tsx`
- **Props:** `text: string`, `sampleAnswers: readonly string[]`, `rubric: readonly string[]`,
  `rubricLang?: 'en' | 'vi'` (`lang.rubric`, default `vi`)
- **Variants:** respond · rewrite (same component)
- **States:** answering; samples hidden / shown ("Xem câu trả lời mẫu" / "Ẩn câu trả lời mẫu");
  what the learner typed stays. Self-grading ("Đạt / Gần đạt / Chưa đạt") arrives with task 5.2
- **Usage:** `<SelfGradedExercise text={ex.text} sampleAnswers={ex.sampleAnswers}
  rubric={ex.rubric} />` (ExercisePage)
- **Accessibility:** the text is a `lang="en"` blockquote; the Textarea is labelled "Câu trả lời của
  bạn" and described by "Câu trả lời không được lưu."; the sample answers are a `lang="en"` list
  under an `h2`, the rubric (in its own language) under an `h3`

## Item types

One Page and one Row per item type (platform design §3.2, §7.6), joined with the type's core
(`lib/content/item-types`) in the registry (`features/items/registry.ts`). They are **server
components** — they read topic titles and estimates from the generated catalog — so they render in
the `/dev/items` gallery (`app/dev/items/page.tsx`, fixture items, e2e + axe) instead of the client
catalog. Screens never import them or branch on item type: rows come from `renderItemRow(item, {
state, mode, showStatus })` and pages from `await renderItemPage(item, { state, context, viewer,
resolveItem })` (`@/features/items`), which runs the type's `load` (problem: note MDX + code;
lesson: MDX + code; others: nothing) — `tools/guards/item-type-branching.ts` fails any `case` on an
item type outside the registry (ADR-0009). Every Page starts with ItemPageFrame's draft / retired
notice; every Row is a LinkRow with the "Bản nháp" / "Đã ngừng" badge and, with `showStatus`, a
StatusPill (`null` state → "Chưa học"). Props: `ItemPageProps<K>` / `ItemRowProps<K>`
(`features/items/types.ts`).

### ProblemPage

- **Layer:** feature (`features/items`, server)
- **File:** `features/items/problem/Page.tsx`
- **Props:** `ItemPageProps<'problem'>` — `data.Body` is the note, `data.code` its solutions
- **Variants:** noted (verification badge, note body bound with `mdxComponentsFor({ code,
  codeLanguage: viewer.codeLanguage, resolvePractice })`) · no note — inline EmptyState "Chưa có
  ghi chú" + "Bạn vẫn có thể giải bài trên LeetCode." · premium (PremiumBadge, "Bản miễn phí:" +
  every alternative) · with a deep-dive (`note.deepDiveId` → RelatedItems "Bài học chuyên sâu")
- **States:** a draft note is hidden from learners ("Chưa có ghi chú") and shown to admins with
  "Bản nháp"; a retired note shows with "Đã ngừng"; an unloaded body reads as no note
- **Usage:** via `renderItemPage` (`/t/[trackId]/items/[itemId]`, task 3.4b)
- **Accessibility:** the `h1` is the English title in `lang="en"`; "Mở trên LeetCode" and the
  alternatives are ExternalLinks styled as 44 px buttons (https only, new tab,
  `rel="noopener noreferrer"`, "(mở trong tab mới)"); `#1`, difficulty and topic are text

### ProblemRow

- **Layer:** feature (`features/items`, server)
- **File:** `features/items/problem/Row.tsx`
- **Props:** `ItemRowProps<'problem'>`
- **Variants:** Premium marker · verification icon when the note is published
- **States:** status pill with `showStatus`; draft / retired badge
- **Usage:** via `renderItemRow`
- **Accessibility:** LinkRow: title `lang="en"`, meta "#1 · Easy · Arrays & Hashing"

### LessonPage

- **Layer:** feature (`features/items`, server)
- **File:** `features/items/lesson/Page.tsx`
- **Props:** `ItemPageProps<'lesson'>` — `data.Body` is the lesson, `data.code` its fenced blocks
- **Variants:** format badge (`vi.items.lessonFormat`: "Pattern", "Deep-dive"; another format
  shows its ID) · topic · RelatedItems for `anchor` ("Bài mẫu"), `about` ("Bài được phân tích")
  and `practice` ("Bài luyện tập") that `resolveItem` knows
- **States:** an unloaded body → EmptyState "Bài học chưa có nội dung"
- **Usage:** via `renderItemPage`
- **Accessibility:** the lesson title is the `h1`; `<Section>`s bring their `h2`s

### LessonRow

- **Layer:** feature (`features/items`, server)
- **File:** `features/items/lesson/Row.tsx`
- **Props:** `ItemRowProps<'lesson'>`
- **Variants:** meta "Pattern · 25 phút" (the manifest's `estimates.lesson`)
- **States:** status pill with `showStatus`; draft / retired badge
- **Usage:** via `renderItemRow`
- **Accessibility:** LinkRow

### FlashcardPage

- **Layer:** feature (`features/items`, server; renders the client FlashcardView)
- **File:** `features/items/flashcard/Page.tsx`
- **Props:** `ItemPageProps<'flashcard'>` (no `data`)
- **Variants:** tier badge ("Cốt lõi" primary · "Mở rộng" · "Giải thích code") · vocabulary,
  recall and derived cards
- **States:** see FlashcardView
- **Usage:** via `renderItemPage`
- **Accessibility:** the card front is the page `h1`, in the card's front language

### FlashcardRow

- **Layer:** feature (`features/items`, server)
- **File:** `features/items/flashcard/Row.tsx`
- **Props:** `ItemRowProps<'flashcard'>`
- **Variants:** meta = tier label
- **States:** status pill with `showStatus`; draft / retired badge
- **Usage:** via `renderItemRow`
- **Accessibility:** LinkRow; the front in the card's front language

### ExercisePage

- **Layer:** feature (`features/items`, server; renders client exercises)
- **File:** `features/items/exercise/Page.tsx`
- **Props:** `ItemPageProps<'exercise'>` (no `data`)
- **Variants:** fill-blank → FillBlankExercise · respond / rewrite → SelfGradedExercise (the rubric
  in `lang.rubric`); kind badge ("Điền từ" / "Trả lời" / "Viết lại")
- **States:** see the two exercise components
- **Usage:** via `renderItemPage`
- **Accessibility:** the Vietnamese instruction is the `h1`, the English one below in `lang="en"`

### ExerciseRow

- **Layer:** feature (`features/items`, server)
- **File:** `features/items/exercise/Row.tsx`
- **Props:** `ItemRowProps<'exercise'>`
- **Variants:** meta = kind label
- **States:** status pill with `showStatus`; draft / retired badge
- **Usage:** via `renderItemRow`
- **Accessibility:** LinkRow

### PromptPage

- **Layer:** feature (`features/items`, server)
- **File:** `features/items/prompt/Page.tsx`
- **Props:** `ItemPageProps<'prompt'>` (no `data`)
- **Variants:** tag badge (`vi.template.tags`; an unknown tag shows its ID) · minutes (its own, else
  `estimates.prompt`, for `context.mode` — the same as its Row for that mode) · RubricList in
  `lang.rubric` when the rubric is not empty
- **States:** static (completion is recorded from task 5.2)
- **Usage:** via `renderItemPage`
- **Accessibility:** the Vietnamese instruction is the `h1`, the English one in `lang="en"`

### PromptRow

- **Layer:** feature (`features/items`, server)
- **File:** `features/items/prompt/Row.tsx`
- **Props:** `ItemRowProps<'prompt'>`
- **Variants:** meta "Phỏng vấn thử · 45 phút"
- **States:** status pill with `showStatus`; draft / retired badge
- **Usage:** via `renderItemRow`
- **Accessibility:** LinkRow

### Today components (`features/today/components`)

Task 5.1b (5.2b and 5.4 later) adds these entries below this line (Part B-M5 decision 3).

### Check-in components (`features/checkin/components`)

Task 5.2b adds these entries below this line (Part B-M5 decision 3).

### Item outcome components (`features/items/components/outcome`)

Task 5.2c adds these entries below this line (Part B-M5 decision 3).

### Review components (`features/review/components`)

Task 5.3 adds these entries below this line (Part B-M5 decision 3).

### Progress components (`features/progress/components`)

Task 5.5 adds these entries below this line (Part B-M5 decision 3).

### Extra study components (`features/today`, `features/roadmap`)

Task 5.4 adds these entries below this line (Part B-M5 decision 3).

### Admin overview components (`features/admin/components`)

Task 5.6 adds these entries below this line (Part B-M5 decision 3).
