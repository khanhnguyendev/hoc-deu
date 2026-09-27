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
- **Variants:** bottom-centre (below `md`) · bottom-right (from `md`); lifted above the bottom
  navigation below `lg` — both from `useMediaQuery(MEDIA.md / MEDIA.lg)`
  (`components/ui/use-media-query.ts`, Tailwind's own 48rem / 64rem, the one place a breakpoint
  is written outside the CSS; false on the server)
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

### ActionFeedback

- **Layer:** pattern (**client**)
- **File:** `components/patterns/action-feedback.tsx` (`useActionFeedback` + `ActionStatus`;
  `components/patterns/focus-fallback.ts` holds the focus helpers)
- **Props:** `useActionFeedback({ focusTarget?: () => HTMLElement | null })` → `{ pending, answer,
  run(send, onAnswer?), reset() }`; `<ActionStatus feedback={…} spacing?="below" | "none" />`
- **Variants:** ActionStatus `spacing` (cva): `below` (default: `mt-2` only while it says
  something, under a control in a gapless column) · `none` (inside a container that spaces its
  children)
- **States:** idle · pending (the action and the re-render it causes; a second `run` sends
  nothing) · success · refused (the server's reason; the control can be pressed again) · thrown (a
  rejected request — offline, a 5xx — answers "Không lưu được thay đổi. Bạn thử lại nhé." and never
  reaches the route's error boundary)
- **Usage:** `const feedback = useActionFeedback({ focusTarget: () => checkInControlOf(id) })`;
  `feedback.run(() => action(input))`; `<Button loading={feedback.pending}>…</Button>
  <ActionStatus feedback={feedback} />`. `run(send, (answer) => (answer.ok ? 'toast' : undefined))`
  delivers an answer as a toast now (a control that closes itself, CheckInSheet). Used by
  ResumeButton, CheckInButton, CheckInSheet, ExtraButton and ResetTrackButton (UI I-3)
- **Accessibility:** the answer goes to **one** place: the control's own polite `role="status"`
  region (`ActionStatus`, keyed per answer so a repeat is re-announced) once the page's re-render
  is over — or, when that re-render removed the control (a check-in collapsing its button, a stale
  plan swapped, the paused view ending), a toast; an answer already shown is never toasted too.
  When a control that has had an answer disappears with focus on `<body>`, focus moves to
  `focusTarget()` (the block's new "Sửa"), else to the page's focus fallback — the heading a
  `Section` marks with `focusFallback` (DESIGN_SYSTEM §10); focus that is still somewhere stays

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
- **States:** levels 0–4, active-day dots, today ring, focused/selected day (month view: a
  `ring-primary` distinct from today's `ring-ring`, M1 #8 — a visible state besides colour), table
  open, empty (no activity at all, M1 #22 — the heatmap still renders, at level 0 throughout)
- **Usage:** `<CalendarHeatmap days={activity} today={localDay} label="Lịch học" />`
- **Accessibility:** roving focus with arrows/Home/End; each day labelled with date + minutes;
  a visible detail line (not a live region — the focused day already announces itself); legend;
  table view ("Xem dạng bảng"); the year view starts scrolled to today; its month labels never sit
  closer than three columns apart, for any start weekday (M1 #9 — `pickMonthLabels`, `dates.ts`)

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
- **Props:** `FilterChip`: `status: PillStatus`, `pressed: boolean`, `onPressedChange(pressed)`.
  `FilterChipLink` (task 5.3 review, finding I4 — a filter that is a real navigation, e.g.
  `/review?track=`, not a client toggle): `href: string`, `label: string`, `count: number`,
  `current: boolean` (→ `aria-current="page"`). Wrap either in `FilterChipGroup` (`label: string`,
  `as?: 'div' | 'nav'` — `'nav'` for a group of `FilterChipLink`s, the default `'div'` for a group
  of `FilterChip` toggles)
- **Variants:** `FilterChip`: the StatusPill statuses at 32 px. `FilterChipLink`: neutral
  (`bg-surface-muted`) · current (`bg-primary-soft` + ring) — both share `FilterChip`'s pill shape
  and 44 px hit area (`pillVariants`, one hit-area class shared by both), so a design-system
  change to either never drifts between them
- **States:** `FilterChip`: off, on (`aria-pressed`, 2 px `primary` ring), focus-visible.
  `FilterChipLink`: not current, current (`aria-current="page"`, the same ring), focus-visible
- **Usage:** `<FilterChipGroup label="Lọc theo trạng thái"><FilterChip status="weak" pressed={on} onPressedChange={setOn} /></FilterChipGroup>`;
  `<FilterChipGroup as="nav" label="Lọc theo lộ trình"><FilterChipLink href="/review" label="Tất cả" count={8} current /></FilterChipGroup>`
- **Accessibility:** `FilterChip` is a toggle button named by its status label. `FilterChipLink` is
  a real link named by its label and count, in a labelled `nav` (`FilterChipGroup as="nav"`), the
  one in force marked `aria-current="page"`. Both: 32 px visual with a transparent hit area of at
  least 44 px; chips ≥ 8 px apart in a row and 20 px between rows so hit areas never overlap

### FocusLayout

- **Layer:** pattern
- **File:** `components/patterns/focus-layout.tsx`
- **Props:** `children`, `width?: 'narrow' | 'wide'` (`max-w-md` / `max-w-2xl`, default `narrow`),
  `headerActions?: ReactNode`, `toaster?: boolean` (default `true`: mounts the pages' `Toaster`, as
  the AppShell does for signed-in pages — task 5.6; `false` where the page has its own, the
  catalog, so no toast shows twice)
- **Variants:** narrow · wide
- **States:** static
- **Usage:** `<FocusLayout><SignInPanel … /></FocusLayout>` (`/`, `/sign-in`, `/pending`,
  `/onboarding`)
- **Accessibility:** skip link to `#main`; header wordmark links to `/`; `main#main` is the page's
  landmark; toasts are announced in the Toaster's polite live region
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
  `submitCount?: number` (default `0`), `onNavigate?: (fieldId: string) => boolean | void`
- **Variants:** —
- **States:** empty (renders nothing), has errors
- **Usage:** `<FormErrorSummary title={vi.forms.errorSummaryTitle} errors={errors} />` (top of long
  forms, e.g. onboarding) — `submitCount` (incremented once per submission, not per render) makes a
  repeated identical server error re-focus and re-announce the summary (M2 minor); `onNavigate` lets
  a multi-step form switch to a field's step before focusing it (the onboarding wizard uses this);
  without it, a link focuses its field directly instead of a native anchor jump, which some
  browsers (and jsdom) do not reliably focus — its own catalog demo exercises both, with a "Gửi
  lại" button that bumps `submitCount`
- **Accessibility:** `role="alert"`, focused when the error set or `submitCount` changes; each
  message links to `#fieldId` and moves focus there itself (`onNavigate`, or the field directly)
  rather than a bare native anchor jump — but never a dead link either (M2 minor): the native jump
  runs after all when `onNavigate` returns `false` (it found no field for the id) or, without one,
  the id names no element on the page

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
- **Props:** `title`, `description?`, `actions?`, `focusFallback?: boolean`, `children`
- **Variants:** `focusFallback` — the heading is the page's focus fallback (`tabIndex={-1}`,
  `data-focus-fallback`): where `useActionFeedback` moves focus when its control disappears with
  it. One per page (`/today`: the plan section)
- **States:** static
- **Usage:** `<Section title="Ôn tập đến hạn">…</Section>`
- **Accessibility:** a region named by its `h2`; a `focusFallback` heading is focusable by script
  only (never in the tab order)

### StatCard

- **Layer:** pattern
- **File:** `components/patterns/stat-card.tsx`
- **Props:** `label`, `value: number | string`, `hint?`, `icon?`
- **Variants:** a number value (vi-VN digits, `tracking-tight`) · a text value such as "12,4 tuần"
  (normal tracking: `tracking-tight` is for numerals only, DESIGN_SYSTEM §4.3, M1 #15)
- **States:** static
- **Usage:** `<StatCard label="Phút tuần này" value={245} icon={Clock} />`
- **Accessibility:** numbers in vi-VN format, mono with tabular figures; never tightened
  Vietnamese text, so diacritics do not collide

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
  `setUserStatus: (userId, 'active' | 'rejected' | 'suspended', expectedFrom: AccountStatus) =>
  Promise<AdminActionResult>` (`expectedFrom`: the status the row was rendered with —
  `p_expected_from`, task 5.6), `setUserRole: (userId, Role) => Promise<AdminActionResult>` — the
  server actions come in as props (passed on to `UserRowActions`), so the catalog passes no-ops
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
  failure (DESIGN_SYSTEM §9); stale — another admin decided first: the status actions send the
  row's rendered status (`p_expected_from`), the RPC answers `status_changed` and the row shows
  "Tài khoản đã đổi trạng thái. Bạn tải lại trang nhé." while the list re-renders (task 5.6)
- **Usage:** rendered by UserQueue for every row but the admin's own
- **Accessibility:** the buttons sit in a `group` named "Thao tác với {name}", so each "Duyệt" is
  announced with its account; the result is a toast in the polite live region (the AppShell's
  Toaster); the confirm dialog is an `alertdialog` named "Từ chối tài khoản của {name}?" (etc.),
  focus trapped. **Focus after an action** (WCAG 2.4.3): once the list shows the row in another
  status or role — moved to another section (a new instance mounts there) or changed in place —
  keyboard focus goes to that row's target (scrolled into view only as far as needed); a
  cancelled dialog or a failure that changes nothing returns focus to the pressed button (the
  role button is keyed by its slot, so promote ↔ demote keeps the same element). The note of
  which row to follow is kept **per row** (task 5.6): two interleaved actions on two rows each
  follow their own row, and a failure that changes nothing clears its note (a stale failure keeps
  it, so focus follows the re-rendered row); names are inserted literally (a replacer function,
  so `$&` in a display name stays text)

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
  shows as its own line — a dismissible danger Banner (an icon-only close button, its own
  accessible name per track) — even once the row is gone

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
  the last candidate is added and the form goes away, its container takes focus. Its server field
  errors show only while they belong to the currently picked candidate (M2 minor): switching the
  radio before the result arrives (or after a failure) hides a previous candidate's errors at once,
  so they never show against the next one's fields — the typed minutes and picked variant stay,
  kept per track id. The submit button itself stays busy for *any* running submission, not only the
  current candidate's own (a second race M2 minor): switching candidates mid-submit must not free
  up a second, real submit for the newly picked one

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
row with `roadmapSlots(view, (item, { mode }) => renderItemRow(item, { state: data.states[item.id]
?? null, mode: mode ?? undefined, showStatus: enrolled }))` — the learner's state on every row,
the status pill for an enrolled learner (task 5.4) — so every component here renders in the
client catalog with plain nodes. TrackProgress, WeakItems and ResetTrackButton (task 5.4) are
listed under "Extra study components".
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
  `template: TemplateDay[]`, `throttle: string[]` (from `getTrackPage()`), `learner?: ReactNode`
  (task 5.4: an enrolled learner's TrackProgress — with ResetTrackButton — and WeakItems),
  `children` (RoadmapView or its empty state)
- **Variants:** header action — the status Badge when enrolled, "Thêm trong Cài đặt" for an active
  track the learner does not follow, nothing otherwise · notice — draft (info Banner "Bản nháp:
  chỉ quản trị viên thấy lộ trình này.") or retired (warning Banner) · with / without the
  learner's part (after the notices, before the variants; catalog entry "TrackOverviewLearner" in
  `entries/extra.tsx`)
- **States:** static
- **Usage:** `<TrackOverview track={…} enrollment={…} variants={…} template={…} throttle={…}
  learner={data.progress && <><TrackProgress … /><WeakItems … /></>}>{slots ? <RoadmapView
  slots={slots} /> : <EmptyState … />}</TrackOverview>` (`app/(app)/t/[trackId]/page.tsx`)
- **Accessibility:** a `contents` wrapper with `data-accent` (keeps the page's section spacing;
  the progress ring's `ring-track` reads it); PageHeader `h1` = the Vietnamese title, its
  description the English title in `lang="en"`; then the learner's Sections, VariantLinks and a
  Section "Mẫu tuần" holding WeeklyTemplatePreview

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
  `RowGroup`, `DeckList` and `DeckCard` parts RoadmapView reuses, and `RowList`, which WeakItems
  reuses)
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
  "Nhiệm vụ"; derived decks under "Bộ thẻ" with "{n} thẻ" — the cards this learner has unlocked,
  a result on the source item (task 5.4, the M3 residual) — and "Mỗi thẻ mở sau khi bạn làm bài
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
  item={model.item} viewer={model.viewer} resolveItem={model.resolveItem} state={model.state}
  outcome={…} mockInterviewProblem={model.mockInterviewProblem} />} />`
  (`app/(app)/t/[trackId]/items/[itemId]/page.tsx`; task 5.2c: `outcome` is `{ ...model.outcome,
  record: recordOutcome }` — the server action unbound — or `undefined` on a read-only page)
- **Accessibility:** the back link "Về lộ trình {title}" (44 px, chevron decorative) comes first
  — "Về danh sách lộ trình" when `backHref` is `TRACKS_HREF` (`/tracks`: the loader's choice for
  a retired track the learner does not follow, whose page is a 404); the page brings its own
  `h1`; a `contents` wrapper keeps the page's spacing
- **`ItemBody`** (`features/roadmap/item-body.tsx`, task 5.1c, ruling M5-R6): the `page` prop
  above, not a catalog component — a render helper beside `queries.ts` (like `renderItemPage`
  beside `features/items`'s own loaders), so it is out of scope for `/dev/components` and has no
  entry of its own. An async server component: `await renderItemPage(item, { state, viewer,
  resolveItem, outcome, mockInterviewProblem })` and renders the result (task 5.2c: the learner's
  state, the route's outcome binding and the mock-interview pick reach the Page through it). It
  renders only as `ItemView`'s `page`, inside its `<Suspense>` boundary.

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
- **Props:** `Quiz`: `onScore?: ({ correct, total, percent }) => void` (percent rounded) — each
  check also reports the percent to the page's `OutcomeSignalsContext` when a LessonComplete wraps
  the lesson (task 5.2c sends it as `lesson.completed { quizScore }`) · `Question`: `prompt:
  string`, `answer: string` (a Choice id) · `Choice`: `id: string`, `children`
- **Variants:** "Kiểm tra" is `primary` alone, `secondary` inside a lesson with result controls
  (task 5.2c: "Hoàn thành bài học" is then the view's one primary)
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
  `defaultLanguage: CodeLanguage`, `onReveal?: () => void` (fires on the first reveal only). The
  first reveal also tells the page's `OutcomeSignalsContext` (`features/items/outcome-signals.ts`)
  when a ProblemOutcome wraps the note: task 5.2c preselects "Cần gợi ý" (decision 18)
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
  dropped), `outcome?: OutcomeBinding` (task 5.2c), `children`
- **Variants:** with / without title, facts · with an `outcome` binding: the facts end with the
  learner's StatusPill ("Chưa học" before any result) and, when the item is in the current plan, a
  primary Badge with its label ("Trong kế hoạch hôm nay" / "Trong kế hoạch đang dở"); ItemActions
  follows the body. Without one (a draft an admin previews, a retired item): read-only, none of
  them
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
  `pronunciation?`, `lang`), `headingLevel?: 1 | 2 | 3` (1 on the item page), `onReveal?: () =>
  void` (the first reveal only), `children?` (task 5.2c: the grade buttons — FlashcardOutcome on
  the card's page, FlashcardGrades in a CardSession)
- **Variants:** vocabulary card (usage, example, pronunciation) · recall / derived card (back and
  hint only, each side in its own language)
- **States:** front only ("Xem nghĩa", primary); revealed (back, hint, "danh từ · trung tính" +
  note, example, pronunciation; "Ẩn nghĩa", outline); `children` at the bottom of the card from the
  first reveal on, kept when the back is hidden again
- **Usage:** `<FlashcardView card={item.content} headingLevel={1}>{outcome && <FlashcardOutcome
  binding={outcome} />}</FlashcardView>` (FlashcardPage)
- **Accessibility:** the front is a heading in the card's front language; the toggle has
  `aria-expanded` / `aria-controls`; nothing of the back is in the DOM until revealed; the example
  and pronunciation are `lang="en"`; fields are a `<dl>`. The card takes focus (`tabIndex={-1}`):
  a click inside keeps focus in it (Safari and Firefox on macOS do not focus a clicked button), and
  the first reveal focuses the card when focus is outside it — so the grades' keys 1 / 2 / 3 reach
  the card the learner is using

### FillBlankExercise

- **Layer:** feature (`features/items`, client)
- **File:** `features/items/components/fill-blank-exercise.tsx`
- **Props:** `text: string` (holds `{{blank}}` once), `answers: readonly string[]`, `hint?: string`,
  `onGrade?: (grade: 'pass' | 'close' | 'miss') => void` (every check's grade; task 5.2c:
  ExerciseOutcome submits it — the answer text is never sent), `pending?: boolean` (the submission
  saves: "Kiểm tra" busy, a check — click or Enter — ignored, never a grade silently dropped)
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
  `rubricLang?: 'en' | 'vi'` (`lang.rubric`, default `vi`); task 5.2c: `onGrade?: (grade: 'pass'
  | 'close' | 'miss') => void`, `selectedGrade?` (the saved grade), `pendingGrade?` (the saving one)
- **Variants:** respond · rewrite (same component) · with `onGrade`: self-grading
- **States:** answering; samples hidden / shown ("Xem câu trả lời mẫu" / "Ẩn câu trả lời mẫu");
  what the learner typed stays. With `onGrade`, the samples' first reveal adds GradeButtons "Tự
  chấm theo tiêu chí": "Đạt / Gần đạt / Chưa đạt" — kept when the samples close; only the grade is
  sent, so "Câu trả lời không được lưu." stays true
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
state, mode, showStatus, href?, showNoteHint? })` (`href` defaults to the item's page; ruling
M5-R26) and pages from `await renderItemPage(item, { state, viewer, resolveItem, outcome?,
mockInterviewProblem? })` (`@/features/items`; `outcome` — the route's binding, task 5.2c —
replaces M3's never-used `recordResult` and `context`), which runs the type's `load` (problem: note MDX + code;
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
- **Usage:** via `renderItemPage` (`/t/[trackId]/items/[itemId]`, task 3.4b); with `outcome`
  (task 5.2c) the note goes through ProblemOutcome (new / redo grades, or a quick recall with the
  note behind "Xem ghi chú"; the solution-reveal nudge) and ItemPageFrame adds the learner's status
  and ItemActions
- **Accessibility:** the `h1` is the English title in `lang="en"`; "Mở trên LeetCode" and the
  alternatives are ExternalLinks styled as 44 px buttons (https only, new tab,
  `rel="noopener noreferrer"`, "(mở trong tab mới)"); `#1`, difficulty and topic are text

### ProblemRow

- **Layer:** feature (`features/items`, server)
- **File:** `features/items/problem/Row.tsx`
- **Props:** `ItemRowProps<'problem'>` — `showNoteHint?` (ruling M5-R26)
- **Variants:** Premium marker · verification icon when the note is published · with
  `showNoteHint`, a problem whose note a learner cannot see (none, or a draft) says "Chưa có ghi
  chú" (`NotebookPen` + text, in the row's details — part of the link's name; §5.9, RF-4)
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
- **States:** an unloaded body → EmptyState "Bài học chưa có nội dung" · with `outcome` (task 5.2c)
  LessonComplete follows the body ("Hoàn thành bài học", with the Quiz's score)
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
- **States:** see FlashcardView · with `outcome` (task 5.2c) FlashcardOutcome grades the card once
  revealed ("Biết" / "Chưa chắc" / "Không biết", keys 1 / 2 / 3)
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
- **Variants:** through ExerciseOutcome: fill-blank → FillBlankExercise · respond / rewrite →
  SelfGradedExercise (the rubric in `lang.rubric`); kind badge ("Điền từ" / "Trả lời" / "Viết lại")
- **States:** see the two exercise components · with `outcome` (task 5.2c) every check's grade —
  or the learner's own grade against the rubric — is submitted (`exercise.submitted`)
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
  `estimates.prompt`, for the binding's `mode` — the same as its Row for that mode) · RubricList in
  `lang.rubric` when the rubric is not empty · the mock-interview prompt (`mockInterviewProblem`
  set, §5.6): RelatedItems "Bài cho buổi phỏng vấn thử" with the picked problem, or EmptyState "Chưa
  có bài Medium nào đã học"
- **States:** read-only without `outcome`; with it (task 5.2c) PromptOutcome — "Đã làm xong" with
  an optional 1–3 self-rating
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

`/today` (task 5.1b). The page builds each block's rows through the registry and hands them over
as slots — `todaySlots(page)` (`features/today/rows.tsx`, server-only: `renderItemRow(item, {
state, mode, href, showStatus, showNoteHint })` — the learner's state, the block's mode, the
`?block=&mode=` href, and the Row's own note hint (ruling M5-R26: no item-type decision in the
screen) — plus, for a card-only block, the cards its session grades, task 5.4) — so every
component here takes plain props and ReactNodes and renders in the client catalog. Server-compatible unless marked client; the client leaves take the
server actions as unbound props from the page. Data: `TodayPage` / `BlockView` /
`TrackProgressView` / `WeakTopicView` (`features/today/view-model.ts`), `TodaySlots`
(`features/today/slots.ts`). Loading is the route's `loading.tsx` (LoadingState `variant="page"`),
a thrown load the route's `error.tsx` (ErrorState "Không tải được kế hoạch hôm nay" + "Thử lại").
Copy: `vi.today`.

### TodayView

- **Layer:** feature (`features/today`, server-compatible)
- **File:** `features/today/components/today-view.tsx`
- **Props:** `page: TodayPage` (`getToday(block)`), `slots: TodaySlots` (`todaySlots(page)`),
  `markPlanSeen: (planId) => Promise<void>`, `resumeToday: () => Promise<ResumeResult>`,
  `checkIn: (input: CheckInInput) => Promise<CheckInResult>`, `addExtra: (input: { requestId,
  trackId }) => Promise<ExtraResult>`, `record: RecordOutcome` (the server actions, unbound; the
  last two task 5.4)
- **Variants:** by `page.data.state.kind` — `plan` (throttle notices, "Kế hoạch hôm nay" with "{n}
  khối · {minutes}", PlanBlockCards, TodayStats + WeakAreas; marks the plan seen) · `resumed` (an
  info Banner "Bạn đã tiếp tục lộ trình hôm nay — kế hoạch mới có vào ngày mai.", "Kế hoạch ngày
  {date}" with its check-ins) · `paused` (PausedBanner above "Phần còn dang dở": the active
  tracks' unfinished blocks) · `notStarted` / `noTracks` (TodayEmpty) · `unreadable`
  (UnreadablePlan). Each block without a check-in gets a CheckInButton in its `actions` slot
  (check-ins go to the plan shown — the paused plan while the gate is closed, decision 13);
  `page.openBlockId` (`/today?block=<id>`, a block the dashboard shows) opens its CheckInSheet.
  Task 5.4: a card-only block grades its cards inline (CardBlock in PlanBlockCard's `cards`
  slot, decision 19), and in the plan and resumed states a Section "Học thêm" under the blocks
  lists an ExtraButton per active, started track (`page.extra`). No mode badge in v1.0
  (decision 12)
- **States:** loading (`loading.tsx`) · empty plan (TodayEmpty `noBlocks`, stats still shown) ·
  error (`unreadable`; `error.tsx`) · ready
- **Usage:** `<TodayView page={page} slots={todaySlots(page)} markPlanSeen={markPlanSeen}
  resumeToday={resumeTodayAction} checkIn={checkInBlock} addExtra={addExtraAction}
  record={recordOutcome} />` (`app/(app)/today/page.tsx`)
- **Accessibility:** PageHeader `h1` "Hôm nay" with the long date; each column part is a Section
  (a region named by its `h2`); blocks are a `role="list"`; DESIGN_SYSTEM §5 order — banners →
  blocks (2/3 column from 1024 px) → stats and weak areas (1/3 column)

### PlanBlockCard

- **Layer:** feature (`features/today`, server-compatible)
- **File:** `features/today/components/plan-block-card.tsx`
- **Props:** `view: BlockView`, `slots?: BlockSlots` (`{ items: BlockItemSlot[], sentences:
  ShadowingSentence[], cards: CardSessionCard[] | null }`), `actions?: ReactNode` (the one-tap
  CheckInButton while the block has no check-in), `cards?: ReactNode` (a card-only block's
  CardBlock, task 5.4), `paused?: boolean` (the paused view: a skipped block's M-6 lines)
- **Variants:** item rows (BlockItemList) · card-only block (`cards` set: its card session
  instead of the rows, decision 19) · shadowing block (`block.shadowing` set:
  ShadowingSentences instead) · over budget (a warning Badge "Dài hơn thời gian dự kiến": a new
  item flagged `overBudget`, or a practice block longer than the track budget, M4-R10) · not
  checked in (the `actions` slot: CheckInButton) · checked in (collapses into CheckInStatus —
  "Đã check-in", StatusPill `block-done|partial|skipped`, minutes, "tự động" for an auto
  check-in, "Sửa" → `view.editHref`; paused + skipped adds "Đã bỏ qua — bấm Sửa khi bạn làm
  xong" and the owner's line)
- **States:** with rows · empty ("Khối này chưa có bài nào.")
- **Usage:** `<PlanBlockCard view={view} slots={slots[view.block.id]} actions={<CheckInButton
  … />} paused={state.kind === 'paused'} />`
- **Accessibility:** an `article` named by its `h3` (the kind label) and the track chip (Badge
  `tone="track"` in `data-accent`, the Vietnamese track title — the track is never colour alone);
  the 4 px `bg-track` stripe is decorative; minutes with a decorative clock icon

### BlockItemList

- **Layer:** feature (`features/today`, server-compatible)
- **File:** `features/today/components/block-item-list.tsx`
- **Props:** `items: BlockItemSlot[]` (`{ itemId, row }`: the registry row — a note-less problem
  says "Chưa có ghi chú" in its own row, `showNoteHint`, ruling M5-R26; §5.9, RF-4)
- **Variants:** —
- **States:** with rows · empty ("Khối này chưa có bài nào.")
- **Usage:** `<BlockItemList items={slots.items} />` (PlanBlockCard; CardBlock once every card is
  handled)
- **Accessibility:** a `role="list"`; each row is its type's LinkRow (44 px, one link)

### ShadowingSentences

- **Layer:** feature (`features/today`, server-compatible)
- **File:** `features/today/components/shadowing-sentences.tsx`
- **Props:** `sentences: ShadowingSentence[]` (`{ itemId, text }`: the block's cards' example
  sentences, §5.6)
- **Variants:** —
- **States:** with sentences · empty ("Chưa có câu mẫu cho khối này.")
- **Usage:** `<ShadowingSentences sentences={slots.sentences} />` (PlanBlockCard)
- **Accessibility:** an ordered `role="list"` named by "Đọc to các câu sau"; each sentence is
  `lang="en"`

### PausedBanner

- **Layer:** feature (`features/today`, server-compatible)
- **File:** `features/today/components/paused-banner.tsx`
- **Props:** `planDate: LocalDay`, `offerResume: boolean`, `resume: () => Promise<ResumeResult>`
- **Variants:** with / without ResumeButton ("Học tiếp hôm nay" only when the last seen plan is
  more than 2 local days old, §5.8)
- **States:** static
- **Usage:** `<PausedBanner planDate={state.plan.planDate} offerResume={state.offerResume}
  resume={resumeToday} />` (TodayView)
- **Accessibility:** a `warning` Banner — icon + "Lộ trình đang tạm dừng — hoàn thành ít nhất một
  phần để tiếp tục." + "Kế hoạch ngày {date}" + one action

### ResumeButton

- **Layer:** feature (`features/today`, **client**)
- **File:** `features/today/components/resume-button.tsx`
- **Props:** `resume: () => Promise<ResumeResult>` (`resumeTodayAction`, unbound)
- **Variants:** —
- **States:** through ActionFeedback (UI I-3): idle · pending (Button `loading`: spinner,
  `aria-busy`, a second click sends nothing) · answered — the action revalidates `/today`, so a
  success or "not offered" (the one "Kế hoạch vừa thay đổi. Trang đã được làm mới.") usually
  replaces the paused view and the button: a toast, focus on the plan's heading; while the button
  stays, its own region · failed request ("Không lưu được thay đổi…" beside the button, never the
  error boundary)
- **Usage:** `<ResumeButton resume={resume} />` (PausedBanner)
- **Accessibility:** a 44 px Button "Học tiếp hôm nay"; the answer in a polite `role="status"`
  region (ActionStatus) or a toast, never both

### MarkPlanSeen

- **Layer:** feature (`features/today`, **client**)
- **File:** `features/today/components/mark-plan-seen.tsx`
- **Props:** `planId: string`, `markPlanSeen: (planId) => Promise<void>` (the server action,
  unbound)
- **Variants:** —
- **States:** renders nothing; calls the action once per plan id in `useEffect` after mount
  (never in a render or a prefetch, ADR-0039); a failed call is swallowed and retried on the next
  effect run or visit
- **Usage:** `<MarkPlanSeen planId={page.markSeenPlanId} markPlanSeen={markPlanSeen} />`
  (TodayView, `plan` state only)
- **Accessibility:** —

### TodayStats

- **Layer:** feature (`features/today`, server-compatible)
- **File:** `features/today/components/today-stats.tsx`
- **Props:** `streak: number`, `tracks: TrackProgressView[]`
- **Variants:** DESIGN_SYSTEM §5 order — the StreakBadge, a ProgressRing card per active track
  ("Tuần {w}/{weeks} · {n} mục cần ôn"; the week left out without a roadmap; a track that has
  not started reads "Bắt đầu vào {date}" instead of a due count), then the due reviews StatCard —
  the due counts are those of the tracks the engine plans today (`eligibleTracks`), so the total
  is `/review`'s (UI I-2)
- **States:** ready · a new learner (0 streak, 0 due, 0 % rings — never NaN) · no active track
  (streak and due only)
- **Usage:** `<TodayStats streak={page.streak} tracks={page.tracks} />`
- **Accessibility:** a Section "Tiến độ"; StreakBadge reads "{n} ngày liên tiếp"; the due
  reviews are a StatCard inside one link to `/review` (a clickable card: hover shadow, global
  focus ring); each ring is a labelled `progressbar` "Tiến độ {title}" with its percentage printed

### WeakAreas

- **Layer:** feature (`features/today`, server-compatible)
- **File:** `features/today/components/weak-areas.tsx`
- **Props:** `topics: WeakTopicView[]` (`{ trackId, topicId, title, trackTitle, count }`, §5.7:
  ≥ 2 Weak items, of the tracks the engine plans today — as `/review` — most first; keyed by
  track and topic ID)
- **Variants:** —
- **States:** with topics · empty ("Chưa có chủ đề nào cần củng cố.")
- **Usage:** `<WeakAreas topics={page.weakTopics} />`
- **Accessibility:** a Section "Chủ đề cần củng cố"; each topic is a LinkRow to `/t/<track>`
  with "{track} · {n} bài yếu" and the "Yếu" StatusPill (icon + label)

### ThrottleNotice

- **Layer:** feature (`features/today`, server-compatible)
- **File:** `features/today/components/throttle-notice.tsx`
- **Props:** `track: TrackProgressView`
- **Variants:** throttled (a `warning` Banner with `throttleMessage` — "Đang có 52 thẻ cần ôn —
  tạm giảm thẻ mới." from the plan's snapshot, §5.5 — and "Ôn tập" to `/review?track=<id>`) · not
  throttled (renders nothing)
- **States:** static
- **Usage:** `{page.tracks.map((track) => <ThrottleNotice key={track.trackId} track={track} />)}`
- **Accessibility:** icon + one sentence + one action; the link's name carries the track title
  (`sr-only`), so several notices stay distinct

### TodayEmpty

- **Layer:** feature (`features/today`, server-compatible)
- **File:** `features/today/components/today-empty.tsx`
- **Props:** `{ kind: 'notStarted'; startDate: LocalDay } | { kind: 'noTracks' } | { kind:
  'noBlocks' }`
- **Variants:** notStarted ("Bắt đầu vào {date}", "Xem lộ trình" → `/tracks`) · noTracks ("Bạn
  chưa học lộ trình nào", "Mở Cài đặt" → `/settings`) · noBlocks ("Hôm nay không có bài nào",
  `h3` inside the plan Section)
- **States:** empty (RF-4)
- **Usage:** `<TodayEmpty kind="notStarted" startDate={state.startDate} />`
- **Accessibility:** EmptyState — decorative icon, a heading, one action link

### UnreadablePlan

- **Layer:** feature (`features/today`, **client**)
- **File:** `features/today/components/unreadable-plan.tsx`
- **Props:** —
- **Variants:** —
- **States:** error (today's stored plan cannot be read and is in use, so it was not rebuilt —
  M-4, decision 10): ErrorState "Không đọc được kế hoạch hôm nay", what to do when it keeps
  failing (never a promise that it repairs itself, M5-R26), and "Thử lại" (`router.refresh()`:
  `ensureToday` runs again)
- **Usage:** `{state.kind === 'unreadable' && <UnreadablePlan />}` (TodayView)
- **Accessibility:** ErrorState — `role="alert"`, a heading, a 44 px "Thử lại" button

### Check-in components (`features/checkin/components`)

Task 5.2b adds these entries below this line (Part B-M5 decision 3).

The check-in UI (§5.5; DESIGN_SYSTEM §3.3, §9, §10). The page passes `checkInBlock` unbound; the
client components build its `CheckInInput` (`{ requestId, planId, blockId, status, minutes?,
note? }`) with the page's per-render request ID (decision 16: the same tap twice is one event).
Exported through `features/checkin/index.ts` (no `server-only` module). Copy: `vi.checkIn`.

### CheckInButton

- **Layer:** feature (`features/checkin`, **client**)
- **File:** `features/checkin/components/check-in-button.tsx`
- **Props:** `action: CheckInAction` (`checkInBlock`, unbound), `requestId: string`, `planId:
  string`, `blockId: string`, `blockLabel: string` ("{kind} · {track}")
- **Variants:** —
- **States:** through ActionFeedback (UI I-3): idle · pending (Button `loading`: spinner,
  `aria-busy`; a second tap sends nothing, RF-2) · answered — the action revalidates `/today`: a
  success collapses the card into CheckInStatus and a stale answer ("Kế hoạch vừa thay đổi. Trang
  đã được làm mới.") swaps the plan, so the answer is a toast and focus moves to the block's "Sửa"
  / one-tap on the new page, else the plan's heading; while the button stays, its own region ·
  refused / failed request (the message beside the button, never the error boundary; tap again).
  The button carries `data-check-in-button="<blockId>"` (`checkInControlOf`)
- **Usage:** `<CheckInButton action={checkIn} requestId={page.requestId} planId={plan.id}
  blockId={view.block.id} blockLabel={blockLabel(view)} />` (PlanBlockCard's `actions`)
- **Accessibility:** a full-width 48 px `primary` Button "Check-in" (the biggest target, one
  primary per card) named "Check-in: {kind} · {track}" (`aria-label` starting with the visible
  label, WCAG 2.5.3, so several stay distinct); the answer in a polite `role="status"` region
  (ActionStatus) or a toast, never both

### CheckInStatus

- **Layer:** feature (`features/checkin`, server-compatible)
- **File:** `features/checkin/components/check-in-status.tsx`
- **Props:** `checkIn: { status, minutes, auto }`, `editHref: string` (`/today?block=<id>`),
  `blockId: string` (marks the link `data-check-in-edit`, where the sheet and the one-tap put
  focus back), `blockLabel: string`, `paused?: boolean`
- **Variants:** done / partial / skipped (StatusPill `block-*`: Xong `Check` · Một phần `Clock` ·
  Bỏ qua `SkipForward`) · auto ("· tự động") · paused + skipped ("Đã bỏ qua — bấm Sửa khi bạn làm
  xong" and "Sửa sau giờ bắt đầu ngày sẽ tính cho hôm nay; ngày trước vẫn chưa hoàn thành.",
  ruling M-6 a)
- **States:** static
- **Usage:** `<CheckInStatus checkIn={view.checkIn} editHref={view.editHref}
  blockId={view.block.id} blockLabel={label} paused />` (PlanBlockCard)
- **Accessibility:** status by icon + label, never colour alone; "Sửa" is a 44 px outline link
  named "Sửa {kind} · {track}" (`sr-only`), `scroll={false}` so the page keeps its place

### CheckInSheet

- **Layer:** feature (`features/checkin`, **client**)
- **File:** `features/checkin/components/check-in-sheet.tsx`
- **Props:** `action: CheckInAction`, `requestId: string`, `planId: string`, `block:
  CheckInSheetBlock` (`{ id, kindLabel, trackTitle, estMinutes, defaultMinutes, checkIn: {
  status, minutes, note } | null }`), `onClose?: () => void` (default `router.replace('/today')`)
- **Variants:** a bottom Sheet below `md`, a Dialog from `md` (`useMediaQuery(MEDIA.md)`) · new
  check-in (Xong, the block's `checkInMinutes`) · edit (pre-filled with the block's check-in).
  It renders on the server too (`/today?block=<id>` loaded as a new page): nothing in its render
  reads `document` (UI I-1)
- **States:** through ActionFeedback (UI I-3): idle · saving (submit `loading`) · error (a danger
  Banner with the message — "Không lưu được thay đổi. Bạn thử lại nhé." for a failed request — and
  "Thử lại", the sheet kept open) · stale (the re-render drops the sheet: the answer is a toast) ·
  invalid (minutes outside 0–600, or a note over 280 graphemes / the
  payload bound: the error under the field, submit disabled) · success (toast, back to `/today`)
- **Usage:** `{open && <CheckInSheet key={open.block.id} action={checkIn} requestId={…}
  planId={plan.id} block={…} />}` (TodayView, from `page.openBlockId`)
- **Accessibility:** a modal dialog named by its title "Check-in: {kind}"; focus moves to the
  title on open, is trapped, and `Esc` / "Đóng" / "Huỷ" close it (`router.replace`, so the back
  button never reopens it, §2.4); closing returns focus to the control that opened it, else (a
  deep link) to the block's "Sửa" or one-tap, else the plan's heading; a click on that "Sửa" while the replace is still pending
  reopens it; the status is a ToggleGroup `radiogroup` "Trạng thái" (icons +
  labels); the minutes stepper's −/+ are 44 px icon buttons "Bớt 5 phút" / "Thêm 5 phút"; the
  note's live "n/280" counter and error are in its `aria-describedby`, and a crossed limit (note
  or minutes) is announced in an `sr-only` polite live region, so the disabled submit always has
  a reason; the save result is in a polite `role="status"` live region (a success is a toast)

### Item outcome components (`features/items/components/outcome`)

Task 5.2c adds these entries below this line (Part B-M5 decision 3).

The result controls of the item pages (platform design §4.4, §5.5–§5.7; Part B-M5 decisions 14,
16–19; ADR-0036). Client components. A Page gets an `outcome?: OutcomeBinding`
(`features/items/outcome.ts`) from the item route — the resolved `mode`, the plan context, the
learner's `state`, `due`, the render's `requestId`, the item and block ids and `record`, the
`recordOutcome` server action passed **unbound** — and builds each `OutcomeInput` itself
(`outcomeInput`); no binding = read-only (a draft an admin previews, a retired item). Every send
goes through `useOutcome` (`use-outcome.ts`): one at a time, in a transition, the server's answer
(or "Chưa lưu được kết quả. Bạn thử lại nhé.") in a polite live region; a retry in the same render
resends the same request id, so the event is recorded once. Results stay self-reported; there is no
offline queue (ADR-0036). Copy: `vi.outcomes` (`lib/i18n/strings/outcomes.ts`). The note's
`<Solution />` and a lesson's `<Quiz>` report to the controls through `OutcomeSignalsContext`
(`features/items/outcome-signals.ts`), which ProblemOutcome and LessonComplete provide.

### GradeButtons

- **Layer:** feature (`features/items`, client; also exports `OutcomeMessage`)
- **File:** `features/items/components/outcome/grade-buttons.tsx`
- **Props:** `label: string` (the group's name), `grades: { value, label, shortcut? }[]`,
  `onGrade(value)`, `selected?` (pressed: the saved grade or a preselected one), `pending?` (the
  saving one), `disabled?`, `description?` (a nudge, key hints) · `OutcomeMessage`: `result: { ok,
  message, seq? } | null`, `label?` (what was sent: the grade, "Bỏ qua mục này", …), `ref?` (makes it
  focusable, `tabIndex={-1}`)
- **Variants:** the selected grade `primary` + `aria-pressed="true"`, the others `outline` — at
  most one primary · a key cap per grade with a `shortcut` (from `md`) · OutcomeMessage tones idle /
  saved (`CircleCheck`, success) / failed (`CircleAlert`, danger)
- **States:** none chosen · chosen (preselected or saved) · saving (that button busy, the others
  disabled) · disabled · OutcomeMessage empty until an answer
- **Usage:** `<GradeButtons label="Bạn giải bài này thế nào?" grades={…} selected={saved ??
  suggested} pending={pending} onGrade={grade} />` · `<OutcomeMessage result={sent} />`
- **Accessibility:** a `role="group"` named by its visible label and described by `description`;
  44 px Buttons; a press sends at once (pressing the preselected grade records it); shortcuts in
  `aria-keyshortcuts`, key caps `aria-hidden`; OutcomeMessage is an always-present polite
  `role="status"` — icon + text, never colour alone — reading "{label}: {message}"; each answer
  (`seq`) is a new text node, so a repeated message is announced again

### ProblemOutcome

- **Layer:** feature (`features/items`, client)
- **File:** `features/items/components/outcome/problem-outcome.tsx`
- **Props:** `binding: OutcomeBinding`, `hasNote: boolean` (a visible note to hide in a recall),
  `children` (the page's note section, or its "Chưa có ghi chú")
- **Variants:** new — the note, then "Tự giải được" / "Cần gợi ý" / "Chưa giải được" (`solved` /
  `hint` / `failed`, no mode) · redo — the same with `mode: 'redo'` · recall / explain-aloud
  (decision 17) — first "Nêu pattern, cách làm và độ phức tạp" with the note behind "Xem ghi chú",
  then "Nhớ rõ" / "Nhớ một phần" / "Không nhớ" with `mode: 'recall'` (no visible note: the grades
  at once); "Làm lại từ đầu" switches a recall to a redo in place (§5.5)
- **States:** the nudge (decision 18): opening the note's "Xem lời giải" before a grade is saved
  preselects the `hint` grade, with "Bạn đã xem lời giải nên "Cần gợi ý" được chọn sẵn — bấm để
  lưu, hoặc chọn mức khác." — any grade can still be chosen · saving · saved (pressed; pressing it
  again sends nothing; "Tự giải được: …" with the server's message, e.g. "… tự động check-in") ·
  failed (the message; every grade available) · redo: "Giải lại trên LeetCode từ đầu, không mở lời
  giải, rồi tự chấm." above the note
- **Usage:** ProblemPage: `<ProblemOutcome binding={outcome} hasNote={…}>{noteSection}</ProblemOutcome>`
- **Accessibility:** the recall prompt is an `h2` section; "Xem ghi chú" has `aria-expanded` /
  `aria-controls`; "Làm lại từ đầu" is a link-styled button (an in-page switch, not a navigation);
  see GradeButtons

### FlashcardGrades

- **Layer:** feature (`features/items`, client; also exports `FlashcardOutcome`)
- **File:** `features/items/components/outcome/flashcard-grades.tsx`
- **Props:** `onGrade(grade: 'know' | 'unsure' | 'dont_know')`, `selected?`, `pending?`,
  `disabled?`
- **Variants:** —
- **States:** ready (keys 1 / 2 / 3 listened to on its card) · saving or disabled (keys ignored) ·
  a grade pressed
- **Usage:** `<FlashcardView card={sides}><FlashcardGrades onGrade={grade} /></FlashcardView>`
  (CardSession); presentational — the caller records
- **Accessibility:** GradeButtons "Bạn nhớ thẻ này không?" — "Biết" / "Chưa chắc" / "Không biết"
  (DESIGN_SYSTEM §9) with `aria-keyshortcuts` 1 / 2 / 3 and the key hint as its description; the
  keydown listener sits on its card (its FlashcardView, else the buttons), so a key grades the card
  focus is in — never another card, never one when focus is on the page outside every card —
  without a modifier, never while typing or composing (FlashcardView keeps focus in the card)

### FlashcardOutcome

- **Layer:** feature (`features/items`, client)
- **File:** `features/items/components/outcome/flashcard-grades.tsx`
- **Props:** `binding: OutcomeBinding`
- **Variants:** —
- **States:** FlashcardGrades + OutcomeMessage: saving, saved (the grade pressed), failed
- **Usage:** FlashcardPage: `<FlashcardView card={…} headingLevel={1}>{outcome && <FlashcardOutcome
  binding={outcome} />}</FlashcardView>` — shown in the card from the first "Xem nghĩa"
- **Accessibility:** see FlashcardGrades and GradeButtons

### CardSession

- **Layer:** feature (`features/items`, client; exported from `@/features/items` for /review (5.3)
  and card blocks on /today (5.4))
- **File:** `features/items/components/outcome/card-session.tsx`
- **Props:** `CardSessionProps` — `cards: { itemId, sides: FlashcardSides, blockId? }[]`,
  `requestId: string`, `record: RecordOutcome` (the unbound `recordOutcome`)
- **Variants:** —
- **States:** empty (no cards: EmptyState "Không có thẻ nào để ôn") · grading ("Còn {n} thẻ",
  FlashcardView then FlashcardGrades once revealed) · saving (the grade busy) · error (the card
  stays; ErrorState "Chưa lưu được kết quả" + the reason + "Thử lại", which resends the same input)
  · end ("Đã ôn xong", "Bạn đã chấm {n} thẻ.")
- **Usage:** `<CardSession cards={due} requestId={page.requestId} record={recordOutcome} />`
- **Accessibility:** decision 19 — the cards are kept in state from mount (a revalidation that
  drops a graded card never shifts the session) and the mount's request id is used throughout;
  after a grade focus moves to the next card's "Xem nghĩa" (or the end state), and a polite
  `role="status"` says "Đã lưu thẻ {front}: {grade}." (the front in its language; new text for every
  card, so equal grades are announced again); keys 1 / 2 / 3 on the card

### LessonComplete

- **Layer:** feature (`features/items`, client)
- **File:** `features/items/components/outcome/lesson-complete.tsx`
- **Props:** `binding: OutcomeBinding`, `children` (the lesson body)
- **Variants:** without / with a checked Quiz ("Kèm điểm kiểm tra nhanh: 50%": `quizScore` 0–100,
  the latest check, is sent)
- **States:** ready · saving · saved (a check icon on the button; the server's message; the same
  completion — same score — again sends nothing, a new quiz score does) · failed
- **Usage:** LessonPage: `<LessonComplete binding={outcome}>{body}</LessonComplete>`
- **Accessibility:** "Hoàn thành bài học" is the view's one primary Button (`lg`) — the lesson's
  Quiz check steps down to `secondary` inside it; the answer in the OutcomeMessage live region

### ExerciseOutcome

- **Layer:** feature (`features/items`, client)
- **File:** `features/items/components/outcome/exercise-outcome.tsx`
- **Props:** `exercise: Exercise` (catalog content), `binding?: OutcomeBinding`
- **Variants:** fill-blank (every "Kiểm tra" submits its grade `pass` / `close` / `miss`) ·
  respond / rewrite (the self-grade after the samples) · read-only (no binding: the exercise alone)
- **States:** saving ("Kiểm tra" busy — a check then is ignored, not dropped) · saved (the
  self-grade pressed; "{grade}: {message}"; the same grade again sends nothing) · failed
- **Usage:** ExercisePage: `<ExerciseOutcome exercise={item.content} binding={outcome} />`
- **Accessibility:** sends `exercise.submitted { kind, grade }` only — the answer text never
  leaves the page ("Câu trả lời không được lưu." stays true); see the two exercise components

### PromptOutcome

- **Layer:** feature (`features/items`, client)
- **File:** `features/items/components/outcome/prompt-outcome.tsx`
- **Props:** `binding: OutcomeBinding`
- **Variants:** without / with a self-rating ("1 — Chưa tốt", "2 — Tạm được", "3 — Tốt"; choosing
  the chosen one again clears it)
- **States:** ready · saving · saved (a check icon on the button; "Đã làm xong (3 — Tốt): …"; the
  same rating again sends nothing, a changed one does) · failed
- **Usage:** PromptPage: `{outcome && <PromptOutcome binding={outcome} />}`
- **Accessibility:** the rating is a single-choice ToggleGroup (a `radiogroup` named "Tự đánh giá
  (không bắt buộc)", arrow keys); "Đã làm xong" is the view's one primary Button (`lg`)

### ItemActions

- **Layer:** feature (`features/items`, client)
- **File:** `features/items/components/outcome/item-actions.tsx`
- **Props:** `binding: OutcomeBinding` (`itemActionsFor(binding)` decides)
- **Variants:** "Bỏ qua mục này" (ghost, `SkipForward`) while the item is not introduced or is due
  → ConfirmDialog "Bỏ qua mục này?" → `item.skipped` · "Ôn lại" (outline, `RotateCcw`) on a mastered
  item → `item.readded` (§5.7)
- **States:** nothing when neither applies · confirming · saving · the answer, kept after the page
  re-renders without the action
- **Usage:** rendered by ItemPageFrame under the body when the page has a binding
- **Accessibility:** the skip is confirmed in an alert dialog (cancel returns focus to the opener;
  a confirmed skip moves focus to the answer, since the button goes away when the page re-renders);
  the answer in the OutcomeMessage live region

### Review components (`features/review/components`)

`/review` (task 5.3; §2.4, §5.4 step 3, §5.5, §5.7; RF-4): the cross-track review queue, Weak
first (`reviewQueue`, `features/review/view-model.ts` — `dueQueue` per eligible track, merged with
`lib/domain/plan/queues.ts`'s exported `compareDueEntries`; track eligibility is the plan engine's
own `eligibleTracks`, not merely `status === 'active'`). The page renders the other due items' rows
through the registry (`reviewRows`, server-only: `features/review/rows.tsx`, the roadmap's fix-5
pattern, `renderItemRow`) and hands the slots to ReviewList, so the components here never import
the registry and render in the client catalog with plain nodes. Data: `ReviewPage` / `ReviewCard` /
`ReviewTrack` (`features/review/queries.ts`), `ReviewEntry` (`features/review/view-model.ts`, pure:
`reviewQueue`), `ReviewItemSlot` (`features/review/slots.ts`, `{ itemId, row }`). Loading is the
route's `loading.tsx` (LoadingState `variant="page"`), a thrown load the route's `error.tsx`
(ErrorState + "Thử lại"). Copy: `vi.review`.

**Revalidation (task 5.3 review, finding I3):** `recordOutcome` (features/checkin) revalidates
`/today` and the item's own page — never `/review` — but any `revalidatePath` call inside a server
action still carries a fresh render of the page the action was called *from* in its response, so
`/review` re-renders with new props after every grade regardless. `ReviewSession` is the client leaf
that must not react to that: which sections show (the filter chips, "Thẻ", the empty state and
which of its two lines) are decided once at mount and kept for the life of that mount; `ReviewView`
keys `ReviewSession` by `page.track` so a genuine filter change (a different `?track=`, a real
navigation) starts a fresh session while a same-filter revalidation reuses the instance. **The
PageHeader's count is the one thing that stays live**, following the current filter rather than the
grand total (a deliberate choice, task 5.3 review finding M3 — either is defensible; the chips
already show the grand-total-vs-per-track breakdown).

### ReviewFilters

- **Layer:** feature (`features/review`, server-compatible)
- **File:** `features/review/components/review-filters.tsx`
- **Props:** `tracks: ReviewFiltersTrack[]` (`{ id, title, count }`, every eligible track —
  unfiltered due counts), `active: string | null` (the `?track=` in force, or null — all)
- **Variants:** —
- **States:** "Tất cả" current (no track chosen) · a track current
- **Usage:** `<ReviewFilters tracks={page.tracks} active={page.track} />`
- **Accessibility:** `FilterChipGroup as="nav"` (labelled "Lọc theo lộ trình") of `FilterChipLink`s
  (`components/patterns/filter-chip.tsx`, task 5.3 review finding I4) — real links with an `href`
  (`/review`, `/review?track=<id>`), a Next.js client-side navigation that changes the URL and
  re-renders `/review` with fresh server data (never a full browser reload, but also never a
  client-state toggle — corrected from the round 1 report's "a full page load", finding I2); the
  current one `aria-current="page"`

### ReviewList

- **Layer:** feature (`features/review`, server-compatible)
- **File:** `features/review/components/review-list.tsx`
- **Props:** `items: ReviewItemSlot[]` (`{ itemId, row }` — `reviewRows(page.entries)`, built by
  the page; the "Yếu" pill and "Chưa có ghi chú" hint live inside each row's own link now, task 5.3
  review finding M5 — `reviewRows` passes them to `renderItemRow`, not a separate line under the
  row)
- **Variants:** —
- **States:** with items (each row) · empty (renders nothing — the card session or the page's
  EmptyState covers that instead)
- **Usage:** `<ReviewList items={reviewRows(page.entries)} />`
- **Accessibility:** a `role="list"`; each row is a LinkRow (its own accessible name already
  includes "Yếu" / "Chưa có ghi chú" when they apply, so the links rotor hears them)

### ReviewSession

- **Layer:** feature (`features/review`, client — the mount-time freeze below needs `useState`)
- **File:** `features/review/components/review-session.tsx`
- **Props:** `page: ReviewPage`, `rows: ReviewItemSlot[]` (`reviewRows(page.entries)`, built by the
  page), `record: RecordOutcome` (`recordOutcome`, unbound, from the page)
- **Variants:** —
- **States:** decided once at mount, from that render's `page` (task 5.3 review, findings I2/I3/M2):
  the filter chips show only when some eligible track has something due (unfiltered) · "Thẻ" shows
  only when mounted with due flashcards · with nothing at all due (unfiltered), the RF-4 EmptyState
  "Không có bài nào cần ôn hôm nay" linking to `/today` · with the current filter's own due items at
  0 while another track still has some, the filter-specific line "Lộ trình này không có bài nào cần
  ôn hôm nay" instead (finding M3) · otherwise "Thẻ" (CardSession, `headingLevel={3}` under this
  section's own `h2`, task 5.3 review finding M8) and, while `rows` has entries (a live check, not
  frozen — the row list has no session state to lose), a "Bài cần ôn" Section with ReviewList
- **Usage:** `<ReviewSession key={page.track ?? 'all'} page={page} rows={rows} record={record} />`
  (`review-view.tsx`, keyed so a filter change remounts fresh)
- **Accessibility:** each shown part is a Section (a region named by its `h2`) or the labelled
  `nav`; the flashcard grades take keys 1 / 2 / 3 (CardSession, task 5.2c)

### ReviewView

- **Layer:** feature (`features/review`, server-compatible)
- **File:** `features/review/components/review-view.tsx`
- **Props:** `page: ReviewPage` (`getReview(track)`), `rows: ReviewItemSlot[]`
  (`reviewRows(page.entries)`, built by the page), `record: RecordOutcome` (`recordOutcome`,
  unbound, from the page)
- **Variants:** —
- **States:** PageHeader "Ôn tập" + the total due under the current filter, then `ReviewSession`
  (its own states, above)
- **Usage:** `<ReviewView page={page} rows={reviewRows(page.entries)} record={recordOutcome} />`
  (`app/(app)/review/page.tsx`)
- **Accessibility:** PageHeader `h1` "Ôn tập"

### Progress components (`features/progress/components`)

Task 5.5 adds these entries below this line (Part B-M5 decision 3).

### ProgressView

- **Layer:** features
- **File:** `features/progress/components/progress-view.tsx`
- **Props:** `page: ProgressPage` (`relation: 'current' | 'previous' | 'earlier'` names the week
  shown; `previousWeek` is null at the first whole week of the history read, m-7)
- **Variants:** —
- **States:** with activity (streak, the heatmap of the last 53 weeks, then the week shown —
  WeeklySummary titled "Tuần này · {range}" only for the current week, "Tuần trước · {range}" or
  "Tuần {range}" otherwise (UI I-4), WeekNav above its cards) · empty (RF-4: no `daily_activity`
  row at all — an EmptyState, "Chưa có ngày học nào — bắt đầu từ trang Hôm nay") · loading
  (`app/(app)/progress/loading.tsx`: LoadingState `page`) · error (`error.tsx`: ErrorState `h1`,
  "Thử lại") — all four in the catalog
- **Usage:** `<ProgressView page={page} />`
- **Accessibility:** one `h1` (PageHeader); the week is an `h2` region named by the week; see
  CalendarHeatmap, WeeklySummary and WeekNav

### WeeklySummary

- **Layer:** features
- **File:** `features/progress/components/weekly-summary.tsx`
- **Props:** `week: WeeklySummary` (`lib/domain/stats/weeklySummary`), `tracks: { id, title, accent
  }[]`, `title: string` (the week's name, from ProgressView), `nav?: ReactNode` (WeekNav)
- **Variants:** —
- **States:** the week's Section: `nav` first, the stat cards under neutral labels ("Phút", "Ngày
  hoàn thành", "Mục đã học" — the section names the week, UI I-4), bars per enrolled track (value
  label at the bar end, scaled to the busiest track) · no tracks (a plain message, no bars) · the
  per-day list: "Thứ Hai, 28/09", the minutes and "Hoàn thành" / "Chưa hoàn thành" (the day's plan
  completed — the stat card's count; never "Chưa học" beside minutes studied), icon + label
- **Usage:** `<WeeklySummary week={page.week} tracks={page.tracks} title={…} nav={<WeekNav … />} />`
- **Accessibility:** a region named by its `h2` (the week); the bars' list "Phút theo lộ trình",
  each a labelled `progressbar` (`components/ui/progress.tsx`) in its track accent; the days' list
  "Theo ngày" never relies on colour alone

### WeekNav

- **Layer:** features
- **File:** `features/progress/components/week-nav.tsx`
- **Props:** `previousWeek: LocalDay | null`, `nextWeek: LocalDay | null`
- **Variants:** —
- **States:** default · "Tuần sau" disabled (not hidden) at the current week · "Tuần trước"
  disabled at the first whole week of the history read (m-7)
- **Usage:** `<WeekNav previousWeek={page.previousWeek} nextWeek={page.nextWeek} />`
- **Accessibility:** a labelled `nav`; a disabled control stays a real (disabled) button, never a
  removed link; both controls are Button `size="md"` (44 px) — never `sm` (36 px, desktop-only),
  because this row renders on mobile too

### Extra study components (`features/today`, `features/roadmap`)

Task 5.4 adds these entries below this line (Part B-M5 decision 3).

"Học thêm" and the card blocks on `/today` (decisions 19, 20), and the learner's part of the track
page (Part B-M3 decision 25; §5.9 "Bắt đầu lại"). The client leaves take their server actions
unbound, as props from the page (`addExtraAction`, `recordOutcome`, `resetTrack`). Data:
`ExtraView` (`features/today/view-model.ts`), `CardSessionCard` (`features/items/outcome.ts`),
`TrackProgressData` (`features/roadmap/view-model.ts`). Copy: `vi.extra`. Catalog:
`app/dev/components/entries/extra.tsx`.

### ExtraButton

- **Layer:** feature (`features/today`, client)
- **File:** `features/today/components/extra-button.tsx`
- **Props:** `view: ExtraView` (`{ trackId, trackTitle, accent, throttledDue: number | null }`),
  `requestId: string` (the page's), `action: AddExtraAction` (`addExtraAction`, unbound)
- **Variants:** available (the track chip and an outline "Học thêm" button) · throttled — the
  plan's snapshot caps the track at 0 new items (§5.5): "Kế hoạch này được lập khi bạn có {n} thẻ
  cần ôn, nên hôm nay tạm dừng bài mới. Bạn vẫn có thể ôn tập." (the plan-time count; no promise
  that reviewing unlocks it — ruling M5-R33) and an "Ôn tập" link to `/review?track=<id>`, no
  button
- **States:** through ActionFeedback (UI I-3): default, pending (the button busy; a second click
  sends nothing), answered — the button stays, so the answer is in its own region only (m-4):
  "Đã thêm bài mới vào kế hoạch.", "Bạn đã học hết bài mới của lộ trình này."; a stale answer whose
  re-render removes "Học thêm" is a toast; a failed request is said beside the button, never the
  error boundary
- **Usage:** `<ExtraButton view={extra} requestId={page.requestId} action={addExtra} />`
  (TodayView's Section "Học thêm", plan and resumed states: one per track `extraTrackIds` gives —
  the plan engine's eligibility, the same the server applies). The surface is `Card`
- **Accessibility:** in the track's `data-accent`, the track named by its chip (never colour
  alone); the button's and the link's accessible names carry the track title (`sr-only`), so
  several are distinct; a polite `role="status"` for the answer; 44 px targets

### CardBlock

- **Layer:** feature (`features/today`, client)
- **File:** `features/today/components/card-block.tsx`
- **Props:** `cards: CardSessionCard[]` (the block's cards not handled yet, `todaySlots`),
  `items: BlockItemSlot[]` (the block's rows), `requestId: string`, `record: RecordOutcome`
  (`recordOutcome`, unbound)
- **Variants:** session (CardSession: FlashcardView + "Biết" / "Chưa chắc" / "Không biết") · rows
  (every card was handled before the page rendered: BlockItemList)
- **States:** grading · saving · error (CardSession's ErrorState + "Thử lại") · end ("Đã ôn xong":
  a session keeps its deck to the end while the revalidated page drops the graded cards) ·
  handled (the rows) · grown (the block's items changed — "Học thêm", an off-plan result: the deck
  starts again from the cards not handled yet, the current card first, then the appended ones;
  ruling M5-R33 I-1)
- **Usage:** `<PlanBlockCard … cards={slots.cards && <CardBlock cards={slots.cards}
  items={slots.items} requestId={page.requestId} record={record} />} />` (TodayView)
- **Accessibility:** CardSession's (focus to the next card's "Xem nghĩa", the polite "Đã lưu thẻ
  …" region); keys 1 / 2 / 3 grade only the card focus is in — two card blocks on one page never
  both take a key

### TrackProgress

- **Layer:** feature (`features/roadmap`, server-compatible)
- **File:** `features/roadmap/components/track-progress.tsx`
- **Props:** `title: string` (the track title), `progress: TrackProgressData` (`{ week, weeks,
  introduced, total }`, `trackProgressOf` on the enrolled variant), `actions?: ReactNode`
  (ResetTrackButton)
- **Variants:** with a roadmap ("Tuần {x}/{N}", "{introduced}/{total} bài chính đã học") ·
  without one (the enrolled variant's roadmap file is missing: only the ring, at 0 %)
- **States:** new learner (0 %) · in progress
- **Usage:** `<TrackProgress title={track.title} progress={data.progress} actions={<ResetTrackButton
  … />} />` (TrackOverview's `learner` slot)
- **Accessibility:** a Section (region "Tiến độ của bạn") holding a `Card`; ProgressRing
  `tone="track"`, `size="lg"`, a `progressbar` named "Tiến độ {title}" with the percentage printed
  (never colour alone); needs TrackOverview's `data-accent`

### WeakItems

- **Layer:** feature (`features/roadmap`, server-compatible)
- **File:** `features/roadmap/components/weak-items.tsx`
- **Props:** `rows: ReactNode[]` (the track's Weak items' registry rows with the learner's state
  and status pill, built by the page)
- **Variants:** —
- **States:** with rows · empty ("Chưa có bài yếu nào trong lộ trình này.")
- **Usage:** `<WeakItems rows={data.weakItems.map((item) => row(item))} />` (TrackOverview's
  `learner` slot)
- **Accessibility:** a Section (region "Bài yếu"); the rows in WeekSection's bordered
  `role="list"` (`RowList`), each one link (44 px); the status pill carries icon and label

### ResetTrackButton

- **Layer:** feature (`features/roadmap`, client)
- **File:** `features/roadmap/components/reset-track-button.tsx`
- **Props:** `action: ResetTrackAction` (`resetTrack` of `features/settings`, unbound),
  `requestId: string` (the page's), `trackId: string`
- **Variants:** —
- **States:** default · asking (a destructive ConfirmDialog "Xoá tiến độ của lộ trình này?" /
  "Lịch sử học và chuỗi ngày vẫn được giữ." / "Bắt đầu lại") · pending (the dialog busy, it cannot
  close) · answered, through ActionFeedback (UI I-3): the dialog closes; the button stays, so the
  message is in its own region only, not also a toast (m-4); a failed request is said there too,
  never the error boundary
- **Usage:** `<ResetTrackButton action={resetTrack} requestId={data.requestId}
  trackId={data.track.id} />` (TrackProgress's `actions`, only for an active or paused enrollment)
- **Accessibility:** an outline button with a decorative `RotateCcw`; the `alertdialog` traps
  focus and returns it to the button on close (ConfirmDialog); a polite `role="status"`

### Admin overview components (`features/admin/components`)

Task 5.6 adds these entries below this line (Part B-M5 decision 3). The view models are
`features/admin/overview.ts` (`/admin`) and `features/admin/content.ts` (`/admin/content`, the
coverage horizon of decision 25); the two tables share `features/admin/components/table.ts`.

### AdminOverview

- **Layer:** feature (`features/admin`)
- **File:** `features/admin/components/admin-overview.tsx`
- **Props:** `page: AdminOverviewPage` (`getAdminOverview()`)
- **Variants:** —
- **States:** with warnings · no warning; each metric with a value or "chưa có dữ liệu" — before the
  first cron run with the hint "Có sau lần chạy đầu tiên của cron bảo trì.", after it (no
  successful backup / restore test read) with "Cron bảo trì đã chạy nhưng chưa thấy lần chạy thành
  công nào."; a DB size not measured for 36 h says "Không có số liệu mới trong 36 giờ qua (đo lúc
  …)"; loading — `app/(admin)/admin/loading.tsx`; error — the `(admin)` error boundary
- **Usage:** `<AdminOverview page={await getAdminOverview()} />` (`app/(admin)/admin/page.tsx`)
- **Layout:** PageHeader "Quản trị"; AdminWarnings; "Tài khoản và hoạt động" (StatCards: accounts
  by status, learners who completed a day and plans created in the last 7 days); "Hệ thống"
  (StatCards: DB size, last backup, last restore test, last cron run — times in Vietnam);
  "Trang quản trị" (LinkRows to `/admin/users` and `/admin/content` with one-line summaries)
- **Accessibility:** one `h1`; each section a region named by its `h2`; counts only — no learner is
  named (§4.5)

### AdminWarnings

- **Layer:** feature (`features/admin`)
- **File:** `features/admin/components/admin-warnings.tsx`
- **Props:** `warnings: readonly AdminWarning[]` (red and critical first)
- **Variants:** Banner `danger` (danger-soft: the red content-coverage warning, DB ≥ 450 MB) ·
  Banner `warning` (warning-soft: DB ≥ 100 MB "chuyển sao lưu sang chuỗi gia tăng", ≥ 350 MB
  "bật nén sự kiện cũ (ADR-0031)", no backup confirmed in 36 h, no restore test in 8 days, and —
  once the cron has run — "Chưa có lần sao lưu / kiểm tra khôi phục thành công nào")
- **States:** warnings · none ("Không có cảnh báo nào." with a check icon)
- **Usage:** rendered by AdminOverview
- **Accessibility:** a region "Cảnh báo"; each warning is icon + one sentence + one action (a link
  styled as an outline Button, 44 px); GitHub links open in a new tab and say so ("(mở trong tab
  mới)", screen readers only); never colour alone

### CatalogStats

- **Layer:** feature (`features/admin`)
- **File:** `features/admin/components/catalog-stats.tsx`
- **Props:** `stats: TrackStats`
- **Variants:** —
- **States:** a table of items by listed type × status (Đang dùng / Bản nháp / Đã ngừng), plus the
  verification line for a track with problems ("Kiểm chứng lời giải: n đã kiểm thử · n chỉ biên
  dịch · n chưa có ghi chú") · empty ("Lộ trình này chưa có mục nào.", no table)
- **Usage:** `<CatalogStats stats={track.stats} />` (`app/(admin)/admin/content/page.tsx`)
- **Accessibility:** an `h3`; the table sits in a focusable `region` named "Số mục của {track} theo
  loại và trạng thái" (keyboard horizontal scroll); row headers are the item types (`lang="en"`);
  numbers in mono with tabular figures

### ContentCoverage

- **Layer:** feature (`features/admin`)
- **File:** `features/admin/components/content-coverage.tsx`
- **Props:** `coverage: RoadmapCoverage` (one track variant)
- **Variants:** columns follow the item types the track lists — Bài học, Ghi chú (bài chính),
  Thẻ (core + extended), Exercise, Prompt; always Tuần, Học viên, Tình trạng
- **States:** rows `red` (a week up to the highest learner week + 2 with a missing pattern lesson
  or an unnoted placed problem — decision 25: `danger-soft`, an icon and "Cần bổ sung"), `gap`
  (a gap further ahead: "Còn thiếu"), `covered` ("Đủ"); a line naming the horizon, or "Chưa học
  viên nào có kế hoạch trong 14 ngày qua…"; a variant without its roadmap file ("Chưa có tệp lộ
  trình cho biến thể này.", no table)
- **Usage:** `{track.roadmaps.map((r) => <ContentCoverage key={r.variant} coverage={r} />)}`
- **Accessibility:** an `h3`; a focusable `region` named "Độ phủ theo tuần của {track}, {variant}";
  week numbers are row headers; a missing lesson says "(thiếu)" and a red row says "Cần bổ sung"
  with an icon — never colour alone; English column headers carry `lang="en"`

### DraftsList

- **Layer:** feature (`features/admin`)
- **File:** `features/admin/components/drafts-list.tsx`
- **Props:** `drafts: Drafts` (`tracks`, `items`, `notes`)
- **Variants:** —
- **States:** groups "Lộ trình nháp (n)", "Mục nháp (n)", "Ghi chú nháp (n)" (an empty group is left
  out) · empty (EmptyState "Không có bản nháp nào."); always the line "v1.0: xuất bản bằng một thay
  đổi `status` trong `content/**` (nút "Xuất bản" có từ v1.1)." — no publish button in v1.0 (§6.6)
- **Usage:** `<Section title="Bản nháp"><DraftsList drafts={page.drafts} /></Section>`
- **Accessibility:** each entry is a LinkRow (44 px) to its page — admins see drafts; LeetCode
  titles and English card fronts carry `lang="en"`; group titles are `h3`
