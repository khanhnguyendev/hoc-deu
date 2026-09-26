# Học Đều — Design System

- **Gate:** 2 of 3 (design doc → **design system** → implementation plan)
- **Status:** APPROVED (2026-09-24) after the owner's review; M1-review amendments approved the same
  day (§14)
- **Source of truth for values:** [`tokens.css`](./tokens.css) (generated, contrast-checked). M0 copies
  it into `app/globals.css`; nothing else in the codebase may hold a visual value (platform design
  §7.3).
- **Visual preview:** open [`preview.html`](./preview.html) in a browser (reads `tokens.css`
  directly; light/dark toggle).
- **Built with:** ui-ux-pro-max (design-system search, typography, color, UX, chart and shadcn
  stack searches — query log in Appendix B), then adjusted to the brief and verified with a
  contrast script (Appendix A: 200 checks, 0 failing).

---

## 1. Style direction: "calm study desk"

A quiet, Swiss-minimal workspace that stays out of the way of studying.

- **Style family:** Minimalism & Swiss Style (ui-ux-pro-max match for dashboards and productivity
  tools; light and dark supported; low accessibility risk).
- **Feel:** warm paper-like neutrals, one calm **teal** as the focus colour, hairline borders
  instead of heavy shadows, generous whitespace, clear hierarchy, one accent per track.
- **Design dials:** variance 3/10 (centred, predictable), motion 2/10 (subtle), density 6/10
  (standard — a dashboard, but not cramped).
- **What "calm" means in practice:**
  - one primary action per screen ("Bắt đầu", "Check-in");
  - colour carries meaning (status, track) and is never decoration;
  - progress is celebrated with quiet signals (a filled heatmap cell, a streak count), never
    confetti or sound;
  - nothing moves unless it explains a change.

**Deviations from the tool's raw output** (it was run twice, per the skill's retry rule):

| Tool suggested | Decision | Why |
| --- | --- | --- |
| Baloo 2 / Comic Neue, Varela Round / Nunito Sans | Be Vietnam Pro + JetBrains Mono (§4) | The suggestions target children's products; the audience is adult IT learners reading Vietnamese |
| "Avoid dark modes" | Light **and** dark | Required by the brief |
| Landing-page patterns (hero, feature grid) | App-shell patterns (§6) | The product is an authenticated dashboard |
| Teal `#0D9488` primary with black text; indigo + orange | Teal family kept, deepened to `#0F766E` for white-text buttons | `#0D9488` with white text is 3.7:1 (fails AA) |

---

## 2. Principles

1. **Today first.** The dashboard answers "what do I do now?" above the fold on a 375 px phone.
2. **One tap to check in.** The most frequent action is the largest, easiest target.
3. **Never colour alone.** Every status has an icon and a label; every chart has numbers or a
   table.
4. **Vietnamese-first typography.** Diacritics never clip or collide (§4).
5. **Tokens, not values.** Components use semantic utilities (`bg-surface`, `text-muted-foreground`,
   `bg-track`); the lint and token guard enforce it (platform design §7.3). `tokens.css` clears
   Tailwind's default colours, fonts, text sizes, radii, shadows and easings, so only these tokens
   exist as utilities.

---

## 3. Colour

All values are in `tokens.css` as OKLCH (hex shown for review). Light is the default; dark follows
the system preference, and users can switch in settings (`next-themes`, class strategy).

### 3.1 Semantic tokens

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `background` | `#FAFAF9` | `#0C0A09` | Page background |
| `surface` | `#FFFFFF` | `#1C1917` | Cards, sheets, popovers |
| `surface-muted` | `#F5F5F4` | `#292524` | Secondary buttons, hover rows, code background |
| `surface-sunken` | `#F0EFED` | `#151312` | Wells, empty heatmap cells, inputs on cards |
| `foreground` | `#1C1917` | `#FAFAF9` | Body text, headings |
| `muted-foreground` | `#57534E` | `#A8A29E` | Secondary text, labels |
| `subtle-foreground` | `#6B645F` | `#9A938E` | Tertiary text (timestamps, counters, placeholders); ≥ 4.5:1 on every surface |
| `border` | `#E7E5E4` | `#3A3532` | Decorative dividers and card outlines |
| `border-strong` | `#8A847F` | `#78716C` | Input and control outlines (≥ 3:1, WCAG 1.4.11) |
| `ring` | `#0D9488` | `#2DD4BF` | Focus ring (≥ 3:1 on every surface) |
| `primary` | `#0F766E` | `#2DD4BF` | Primary buttons, links, selected state |
| `primary-hover` | `#115E59` | `#5EEAD4` | Primary hover / pressed |
| `primary-foreground` | `#FFFFFF` | `#042F2E` | Text on primary |
| `primary-soft` / `-foreground` | `#F0FDFA` / `#115E59` | `#0F2E2B` / `#99F6E4` | Selected rows, "Mastered" pill, info callouts |
| `success` / `-soft` / `-soft-foreground` | `#157539` / `#F0FDF4` / `#166534` | `#4ADE80` / `#0F2A1A` / `#86EFAC` | Done, Strong, solved |
| `warning` / `-soft` / `-soft-foreground` | `#A34A0B` / `#FFFBEB` / `#92400E` | `#FBBF24` / `#2E2106` / `#FCD34D` | Partial, throttled, paused roadmap, content warnings |
| `danger` / `-soft` / `-soft-foreground` | `#B91C1C` / `#FEF2F2` / `#991B1B` | `#F87171` / `#3A1414` / `#FCA5A5` | Weak, failed, destructive actions, red admin warnings |

`success`, `warning` and `danger` also have `-foreground` tokens (text on the solid colour: white in
light, near-black in dark).

**Every text colour** (`foreground`, `muted-foreground`, `subtle-foreground`, `primary`,
`success`, `warning`, `danger` and all track accents) passes **4.5:1 on every surface**
(`background`, `surface`, `surface-muted`, `surface-sunken`) in both themes, so any text token can
be used on any surface. There is no 3:1 "large text" tier.

**shadcn/ui aliases.** Primitives expect shadcn's names, so `tokens.css` maps them onto the semantic
tokens: `card`, `popover` → `surface`; `secondary`, `muted` → `surface-muted`; `destructive` →
`danger`; `input` → `border-strong`; `chart-1…5` → `track-1…5`; `sidebar-*` → the matching
tokens. **Note:** in shadcn, `accent` means the subtle **hover surface** of menus and lists, so it is
mapped to `surface-muted` — the track colour is called `track` (§3.2).

### 3.2 Track accents

A track manifest names one of eight accent tokens (`accent: track-2`). Components inside a track
context render `data-accent="track-N"`, and `tokens.css` points three utilities at that track:

- `bg-track` / `text-track` / `ring-track` / `border-track` — the solid accent;
- `bg-track-soft` — the tinted background;
- `text-track-foreground` — text on the solid accent.

| Token | Light solid / soft | Dark solid / soft | Hue | Assigned |
| --- | --- | --- | --- | --- |
| `track-1` | `#4338CA` / `#EEF2FF` | `#A5B4FC` / `#1E1B4B` | indigo | DSA |
| `track-2` | `#C2410C` / `#FFF7ED` | `#FDBA74` / `#3B1906` | orange | English for IT |
| `track-3` | `#6D28D9` / `#F5F3FF` | `#C4B5FD` / `#2A1650` | violet | — |
| `track-4` | `#0369A1` / `#F0F9FF` | `#7DD3FC` / `#0B2A3F` | sky | — |
| `track-5` | `#BE185D` / `#FDF2F8` | `#F9A8D4` / `#3D0C24` | pink | — |
| `track-6` | `#A21CAF` / `#FDF4FF` | `#F0ABFC` / `#3B0D40` | fuchsia | — |
| `track-7` | `#3F6212` / `#F7FEE7` | `#BEF264` / `#1F2A0B` | olive | — |
| `track-8` | `#155E75` / `#ECFEFF` | `#67E8F9` / `#0A2A33` | cyan | — |

Every accent passes 4.5:1 as text on every surface, as text on its own soft tint, and with
`track-foreground` text on the solid (Appendix A).

**Rules:**

- Accents identify **which track**, never **how well** — status always uses the semantic tokens.
- Use the accent sparingly: a 4 px left stripe on plan blocks, the track chip, the progress ring,
  and the track's bars in the weekly chart. Never as a full-card background.
- Tracks 7 and 8 sit near `success` (green) and `primary` (teal) in hue; they are always paired with
  the track's name, so they stay distinguishable.

### 3.3 Status mapping (spaced repetition and check-in)

| Status | Pill colours | Icon (lucide) | Label |
| --- | --- | --- | --- |
| Not started | `surface-sunken` + `muted-foreground`, dashed `border-strong` | `Circle` | Chưa học |
| Weak | `danger-soft` + `danger-soft-foreground` | `AlertTriangle` | Yếu |
| OK | `surface-muted` + `foreground` | `CircleDot` | Ổn |
| Strong | `success-soft` + `success-soft-foreground` | `CheckCircle2` | Vững |
| Mastered | `primary-soft` + `primary-soft-foreground` | `Star` | Thành thạo |
| Skipped | `surface-muted` + `muted-foreground` | `SkipForward` | Đã bỏ qua |
| Block: done / partial / skipped | `success` / `warning` / `surface-muted` | `Check` / `Clock` / `SkipForward` | Xong / Một phần / Bỏ qua |

### 3.4 Heatmap and charts

- **Calendar heatmap:** five levels on a single teal ramp, from `heat-0` (no study) to `heat-4`
  (most minutes). Light: `#F0EFED`, `#2DD4BF`, `#0D9488`, `#115E59`, `#042F2E`. Dark: `#292524`,
  `#134E4A`, `#0D9488`, `#2DD4BF`, `#CCFBF1`. Levels 2–4 are ≥ 3:1 from the empty cell, and every
  pair of adjacent levels is ≥ 1.6:1.
  - Every active day (level ≥ 1) also shows a small centred dot (`foreground` at 40 % opacity on
    light levels, `background` on dark levels), so "studied" never depends on colour alone.
  - **≥ 1024 px with a fine pointer (mouse, trackpad) — year view:** 7 rows × 53 weeks, 12 px
    cells with 3 px gaps, opening scrolled to today; each cell is focusable with arrow-key
    navigation and shows date + minutes (native hover title, and a detail line under the grid).
  - **Below 1024 px or on any touch screen — month view:** a 7-column month grid with
    **44 × 44 px** day cells (day number inside, colour level behind it), previous/next month
    buttons plus horizontal swipe; tapping a day shows its date and minutes. 12 px year cells are
    too small for fingers, so tablets always get the month view (owner, 2026-09-24).
  - Both views keep the legend (minute ranges), the dots and the accessible table view ("Xem dạng
    bảng") — ui-ux-pro-max chart guidance: heatmaps need labels and a table fallback.
  - Today's cell has a 2 px `ring` outline.
- **Weekly summary chart:** horizontal bars per track (minutes), bars in the track accent, value
  labels printed at the bar end. No gridlines except a baseline; no 3D, no gradients.

---

## 4. Typography

### 4.1 Fonts

| Role | Family | Loading (`next/font/local`, files in `app/fonts/`) | Why |
| --- | --- | --- | --- |
| UI, headings, body | **Be Vietnam Pro** | four static `woff2` files (400/500/600/700) subset to latin + vietnamese, `display: 'swap'`, CSS variable `--font-be-vietnam-pro` | Designed for Vietnamese: stacked diacritics (ế, ộ, ữ, Ặ) are drawn, not stacked by fallback; clean geometric-humanist forms fit the Swiss style |
| Code, numbers in tables | **JetBrains Mono** | one variable `woff2` subset to latin + vietnamese, CSS variable `--font-jetbrains-mono` | Clear `0/O`, `1/l`; has a Vietnamese subset, so Vietnamese code comments render correctly |

- Considered: Lexend + Source Sans 3 (ui-ux-pro-max's "Corporate Trust" pairing; both have
  Vietnamese subsets). Be Vietnam Pro was chosen for its native Vietnamese design and one-family
  consistency. **Fira Code is not allowed** — it has no Vietnamese subset.
- Be Vietnam Pro is not variable, so exactly four weights are loaded; do not use 300 or 800.
- Fallback stacks are in `tokens.css` (`--font-sans`, `--font-mono`).
- Fonts are self-hosted (platform design §2.1): the build must not need `fonts.googleapis.com`.
  Both families are under the SIL Open Font License; `app/fonts/*/OFL.txt` ships with the files.

### 4.2 Type scale (16 px base, mobile-first)

| Utility | Size / line height | Weight | Use |
| --- | --- | --- | --- |
| `text-4xl` | 36 / 45 px (1.25) | 700 | Streak number, big stat on desktop only |
| `text-3xl` | 30 / 39 (1.3) | 600 | Page title on desktop |
| `text-2xl` | 24 / 32 (1.35) | 600 | Page title on mobile; section heading on desktop |
| `text-xl` | 20 / 29 (1.45) | 600 | Card title, sheet title |
| `text-lg` | 18 / 29 (1.6) | 500 | Lead text, flashcard term |
| `text-base` | 16 / 26 (1.65) | 400 | Body, lesson text, buttons |
| `text-sm` | 14 / 22 (1.55) | 400/500 | Labels, secondary text, table cells, code |
| `text-xs` | 12 / 18 (1.5) | 500 | Meta only (timestamps, counters) — never paragraphs |

### 4.3 Vietnamese typography rules

- **Leading:** body ≥ 1.6 and headings ≥ 1.25, so stacked marks never touch the line above.
- **Tracking:** never negative on Vietnamese text (diacritics collide). `tracking-tight` is allowed
  only on numerals (streak count, stats).
- **Case:** sentence case everywhere. No all-caps labels (uppercase diacritics like "Ệ" and "Ữ" are
  tall and noisy).
- **Language tags:** `<html lang="vi">`. English content (flashcard terms, example sentences,
  "Explaining code" cards) is wrapped with `lang="en"` so screen readers and text-to-speech
  pronounce it correctly; the `<Term>` MDX component does this.
- **Numbers:** format with `Intl.NumberFormat('vi-VN')` (decimal comma: "12,4 tuần"); durations as
  "45 phút", "1 giờ 15 phút".
- **Technical terms stay English**, in body font (not code font) unless they are code identifiers.
- **Measure:** lessons and notes use `max-w-prose` (72 ch); UI text blocks ≤ 60 ch.

---

## 5. Spacing, layout and sizing

- **Base unit:** 4 px (Tailwind v4 default `--spacing: 0.25rem`). Use the scale only: 1, 2, 3, 4,
  5, 6, 8, 10, 12, 16 (= 4 … 64 px).

| Use | Mobile | ≥ 768 px | ≥ 1024 px |
| --- | --- | --- | --- |
| Page gutter | 16 (`px-4`) | 24 (`md:px-6`) | 32 (`lg:px-8`) |
| Card padding | 16 (`p-4`) | 20 (`md:p-5`) | 24 (`lg:p-6`) |
| Gap between cards | 12 (`gap-3`) | 16 (`gap-4`) | 24 (`gap-6`) |
| Section spacing | 24 (`space-y-6`) | 32 | 40 |
| Stack inside a card | 8–12 | 12 | 12–16 |

- **Breakpoints:** Tailwind defaults (sm 640, md 768, lg 1024, xl 1280). Test at 375, 768, 1024 and
  1440 px.
- **App shell:**
  - **< 1024 px:** top bar (page title + **account menu** on the avatar) and a **bottom
    navigation** with 5 items — Hôm nay, Ôn tập, Lộ trình, Tiến độ, Cài đặt — icon + label, 56 px
    tall. Pages do **not** set `viewport-fit=cover`, so the browser keeps every page clear of
    notches and the home indicator (`--spacing-safe-bottom` stays 0 until a PWA opts in). Page
    content, the root scroll padding and toasts keep **68 px clearance**
    (`--spacing-above-bottom-nav`: the 56 px bar + 12 px), so content, focus rings and toasts never
    hide behind it; the 56 px sticky top bar gets 64 px of top scroll padding.
  - **Account menu** (all sizes): name, theme toggle, "Quản trị" (**admins only**, links to
    `/admin`), "Đăng xuất". Admins also get a "Quản trị" row at the top of Cài đặt, so admin pages
    are reachable on mobile even though the bottom nav has no admin item.
  - **≥ 1024 px:** left **sidebar** (240 px, collapsible to 64 px icons) with the same items plus
    admin links for admins; content max width `max-w-app` (80 rem), centred.
  - Admin pages use the same shell; `/dev/components` uses a two-pane layout.
- **Dashboard (`/today`) order:** paused/throttle banner (if any) → today's plan blocks → streak +
  per-track progress → due reviews → weak areas. Mobile: one column. Desktop: plan blocks in a
  2/3 column, stats in a 1/3 column.
- **Touch targets:** ≥ 44 × 44 px for anything tappable (buttons, list rows, pills that act,
  month-view heatmap cells); ≥ 8 px between adjacent targets.
  - **Chips that act** (FilterChip) keep a **32 px visual height with a hit area of at least
    44 px** — a transparent region 8 px above and below the chip — and sit **≥ 8 px apart** in a
    row and 20 px between rows, so hit areas never overlap (owner, 2026-09-24; e2e-tested).
- **Forms:** one column; label above field; helper text below; errors under the field
  (`text-danger`, icon + message), plus a summary at the top of long forms (onboarding).

## 6. Radius, borders, elevation

| Token | Value | Use |
| --- | --- | --- |
| `rounded-sm` | 6 px | Chips, small pills, inner elements |
| `rounded-md` | 8 px | Buttons, inputs, toggles |
| `rounded-lg` | 12 px | Cards, plan blocks, flashcards |
| `rounded-xl` | 16 px | Sheets, dialogs |
| `rounded-full` | — | Avatars, status dots, progress rings |

- **Borders do the work:** cards are `bg-surface` + 1 px `border`. Controls use `border-strong`.
- **Elevation** (`shadow-xs`, `shadow-sm`, `shadow-md`): light theme only, and subtle — `xs` for
  raised buttons, `sm` for cards on hover, `md` for popovers, sheets and dialogs. In dark mode
  shadows are off except `md`; depth comes from the lighter `surface` and borders.
- No gradients, glassmorphism, blur backdrops (except a 50 % `background` scrim behind dialogs)
  or neumorphism.

## 7. Motion

| Token | Value | Use |
| --- | --- | --- |
| `--duration-fast` | 120 ms | Hover, press, colour changes |
| `--duration-base` | 200 ms | Toggles, check-in state change, accordion |
| `--duration-slow` | 300 ms | Sheet / dialog enter |
| `--duration-exit` | 150 ms | All exits (faster than enters) |
| `ease-standard` | `cubic-bezier(0.2, 0, 0, 1)` | Default |
| `ease-enter` | `cubic-bezier(0.05, 0.7, 0.1, 1)` | Things appearing |
| `ease-exit` | `cubic-bezier(0.3, 0, 0.8, 0.15)` | Things leaving |

- Animate **opacity and transform only** (never width, height or layout).
- **What moves:** sheet/dialog enter and exit; check-in button → check mark (≤ 200 ms); flashcard
  flip (a 200 ms cross-fade, not a 3D flip); skeleton shimmer (static under reduced motion);
  heatmap cell fill on today's first check-in. At most 1–2 animated elements per view
  (ui-ux-pro-max UX guidance).
- **Reduced motion:** `tokens.css` zeroes every duration and disables animations globally under
  `prefers-reduced-motion: reduce`; state changes still happen, just instantly.
- No scroll-triggered reveals, parallax, auto-playing media or GSAP (not in the dependency list).

## 8. Iconography

- **lucide-react** only; no emoji as icons.
- Sizes: 16 px inline with `text-sm`, 20 px default (`size-5`), 24 px in the bottom nav.
  Stroke width 1.75.
- Decorative icons get `aria-hidden="true"`. Icon-only buttons need a Vietnamese `aria-label`
  ("Đóng", "Mở menu") and a tooltip on desktop.
- Streak: `Flame`; review: `RotateCcw`; roadmap: `Map`; progress: `BarChart3`; settings:
  `Settings`; today: `Sun`.

## 9. Component guidelines

Variants via `cva`; states include default, hover, active, focus-visible, disabled, loading; all
data-driven components render loading / empty / error through the `LoadingState`, `EmptyState`,
`ErrorState` and `DataState` patterns (platform design §7.5). Catalogue entries go in
`COMPONENTS.md` and `/dev/components`.

| Component (layer) | Guidance |
| --- | --- |
| **Button** (ui) | Variants `primary`, `secondary` (`surface-muted`), `outline` (`border-strong`), `ghost`, `destructive`, `link`. Sizes `sm` 36 px (desktop only), `md` 44 px (default), `lg` 48 px. Loading shows a spinner and keeps the width. One `primary` per view. |
| **Input / Select / Textarea** (ui) | 44 px tall, `border-strong`, `rounded-md`, label always visible (no placeholder-as-label), error below. |
| **Card** (ui) | `bg-surface`, `border`, `rounded-lg`, padding per §5. Clickable cards get `hover:shadow-sm` and a visible focus ring. |
| **StatusPill** (pattern) | Colours, icon and label from §3.3; `text-xs` weight 500, `rounded-full`, 24 px tall (not tappable). Filter chips use **FilterChip**: the same pill at 32 px with a 44 px hit area and `aria-pressed` (§5). |
| **PageHeader, Section** (patterns) | Title `text-2xl md:text-3xl`, optional description in `muted-foreground`, actions on the right (stack below on mobile). |
| **PlanBlockCard** (feature) | 4 px track stripe on the left (`bg-track`), block kind + estimated minutes, item rows, and a full-width **one-tap check-in** button (`primary`, 48 px) at the bottom. Checked-in state collapses the button into a status row (done / partial / skipped) with "Sửa". |
| **CheckInSheet** (feature) | Bottom sheet on mobile, dialog on desktop: status segmented control (Xong / Một phần / Bỏ qua), minutes stepper (pre-filled), optional note. Focus moves to the sheet title; `Esc` closes; the result is announced in a polite live region. |
| **FlashcardViewer** (feature) | Term (`text-lg`, `lang="en"`) → "Xem nghĩa" → meaning, usage, example, pronunciation hint → three grade buttons "Biết" / "Chưa chắc" / "Không biết" (keyboard 1 / 2 / 3). The card stays in place; only content cross-fades. |
| **Code tabs / Solution** (feature) | Python / Java / Go tabs (remembers the user's language), `font-mono text-sm`, `surface-muted` background, horizontal scroll, never wrapped. Solutions are hidden behind "Xem lời giải". Results stay self-reported (platform design §5.5): if the solution was revealed before grading, the grade buttons **preselect** "Cần gợi ý" as a nudge, and the learner can still choose any grade. Code is highlighted at build time (task 3.3a) into the **CodeBlock** pattern (`components/patterns/code-block.tsx`): a focusable `role="region"` `<pre>`, one token kind per run, no HTML, no client JS. Syntax colours reuse already-verified text tokens, so no new design tokens are needed (decision 13): keyword `text-primary`, string `text-success`, constant/number `text-warning`, comment `text-muted-foreground italic`, everything else the inherited foreground — each pair already passes 4.5:1 on `surface-muted` in both themes (Appendix A). |
| **ProgressRing, StatCard, StreakBadge** (patterns) | Numbers in `font-mono` with tabular figures; the ring uses `ring-track` for track progress and `primary` for overall. Streak shows the number + `Flame` + "ngày liên tiếp". |
| **CalendarHeatmap** (pattern) | §3.4. Year view (7 rows × weeks, 12 px cells) at ≥ 1024 px with a fine pointer; month view (7 columns × 44 px day cells, prev/next + swipe) below 1024 px or on touch screens; legend, activity dots and table fallback in both. |
| **Banners** (pattern) | Paused roadmap and throttle use `warning-soft`; red admin warnings use `danger-soft`; always icon + one sentence + one action. |
| **EmptyState / ErrorState / LoadingState** (patterns) | Empty: icon, one line of what happened, one action. Error: what failed + "Thử lại". Loading: skeletons shaped like the content (no spinners for whole pages). |
| **Toast** (ui) | Bottom-centre on mobile, bottom-right on desktop; 4 s; polite live region; never the only feedback for a failed save. |
| **Navigation** (pattern) | Bottom nav / sidebar per §5; the active item uses `primary` icon + label, `primary-soft` background, a semibold label and a 4 px `primary` indicator bar (never colour alone, WCAG 1.4.1); `aria-current="page"`. |

## 10. Accessibility checklist (WCAG 2.1 AA)

- [x] Every text colour ≥ 4.5:1 on every surface; controls, focus ring and heatmap levels 2–4
  ≥ 3:1 — **verified for every pair in both themes** (Appendix A, 200 checks).
- [ ] Visible focus on every interactive element (`:focus-visible` 2 px `ring` + 2 px offset); focus
  never hidden under the sticky top bar or bottom nav.
- [ ] Full keyboard use: tab order follows visual order; sheets and dialogs trap focus and restore
  it; flashcard grades 1/2/3; `Esc` closes.
- [ ] Never colour alone: status pills have icons and labels; the heatmap has dots, values and a
  table; track chips carry the track name.
- [ ] `lang="vi"` on the page, `lang="en"` on English content.
- [ ] Forms: visible labels, errors next to fields and announced, no placeholder-only labels.
- [ ] Touch targets ≥ 44 px; no hover-only interactions.
- [ ] `prefers-reduced-motion` honoured (tokens zero all durations).
- [ ] Live regions for check-in results, grades and toasts (polite).
- [ ] axe passes on `/dev/components` (every component, every state, both themes) and on the key
  flows in CI (platform design §7.8).

## 11. Voice and copy (Vietnamese UI)

- Address the learner as "bạn"; friendly, calm, short. No exclamation marks in errors.
- Sentence case; buttons are verbs: "Bắt đầu", "Check-in", "Xem lời giải", "Học thêm".
- Explain *why* when the system decides something: "Đang có 52 thẻ cần ôn — tạm giảm thẻ mới."
- Paused roadmap copy is encouraging, never guilt-driven: "Lộ trình đang tạm dừng — hoàn thành ít
  nhất một phần để tiếp tục."
- Technical terms stay English ("pattern", "Two Pointers", "time complexity"); do not translate
  problem titles.
- All strings live in `lib/i18n/vi.ts` (platform design §2.3) and the area files it includes,
  `lib/i18n/strings/*` (implementation plan Part B-M5 decision 3).

## 12. Do / Don't

| Do | Don't |
| --- | --- |
| Use semantic utilities (`bg-surface`, `text-muted-foreground`, `bg-track`) | Hard-code hex/rgb/oklch, `px` or arbitrary values (`p-[13px]`) — the lint and token guard fail |
| One primary action per view; make check-in the biggest target | Put two primary buttons side by side |
| Show status with colour + icon + label | Rely on red/green alone |
| Use the track accent as a stripe, chip or ring | Fill whole cards with the track colour or use it for status |
| Keep Vietnamese leading ≥ 1.6 for body text | Tighten tracking or use all-caps Vietnamese |
| Animate opacity/transform ≤ 300 ms, exits faster | Animate layout, loop animations, or add scroll reveals |
| Use skeletons shaped like content | Show a full-page spinner |
| Use lucide icons with labels / aria-labels | Use emoji as icons or unlabeled icon buttons |
| Use borders for structure, shadows sparingly | Stack shadows, gradients or glass effects |
| Keep dark mode first-class (test every component in both) | Design light-only and "invert" later |
| Wrap English learning content in `lang="en"` | Let screen readers read English in a Vietnamese voice |

## 13. Changes to the platform design

- **§7.4 track accents:** the utility names are `bg-track`, `text-track`, `bg-track-soft`,
  `ring-track` (not `bg-accent`), because shadcn/ui already uses `accent` for hover surfaces. The
  mechanism is unchanged: a manifest names `track-1`…`track-8`, components render
  `data-accent="track-N"`.


## 14. M1-review amendments (approved by the owner, 2026-09-24)

- **Navigation current state:** `primary` icon + label and `primary-soft` background **plus** a
  semibold label and a 4 px `primary` indicator bar — never colour alone (WCAG 1.4.1) (§9).
- **No `viewport-fit=cover`;** a **68 px bottom-nav clearance** token,
  `--spacing-above-bottom-nav`, in `tokens.css` (generated by `gen_tokens.py`, synced with
  `pnpm tokens:sync`) (§5).
- **Filter chips:** 32 px visual, hit area of at least 44 px, ≥ 8 px apart (§5, FilterChip).
- **Heatmap:** year view only from 1024 px with a fine pointer; month view below that and on touch
  screens (§3.4).

---

## Appendix A — Contrast report (generated by `docs/design/assets/palette.py`)

Regenerate with `python3 docs/design/assets/gen_tokens.py` (it rewrites `tokens.css` and
`assets/contrast.md` from `assets/palette.py`).

### Light theme — 100 checks, 0 failing

| Pair | Ratio | Needs | Result |
| --- | --- | --- | --- |
| foreground on background | 16.74 | 4.5 | pass |
| foreground on surface | 17.49 | 4.5 | pass |
| foreground on surface-muted | 16.03 | 4.5 | pass |
| foreground on surface-sunken | 15.22 | 4.5 | pass |
| muted-foreground on background | 7.30 | 4.5 | pass |
| muted-foreground on surface | 7.63 | 4.5 | pass |
| muted-foreground on surface-muted | 6.99 | 4.5 | pass |
| muted-foreground on surface-sunken | 6.64 | 4.5 | pass |
| subtle-foreground on background | 5.56 | 4.5 | pass |
| subtle-foreground on surface | 5.81 | 4.5 | pass |
| subtle-foreground on surface-muted | 5.33 | 4.5 | pass |
| subtle-foreground on surface-sunken | 5.06 | 4.5 | pass |
| primary on background | 5.24 | 4.5 | pass |
| primary on surface | 5.47 | 4.5 | pass |
| primary on surface-muted | 5.02 | 4.5 | pass |
| primary on surface-sunken | 4.76 | 4.5 | pass |
| success on background | 5.53 | 4.5 | pass |
| success on surface | 5.78 | 4.5 | pass |
| success on surface-muted | 5.29 | 4.5 | pass |
| success on surface-sunken | 5.03 | 4.5 | pass |
| warning on background | 5.68 | 4.5 | pass |
| warning on surface | 5.93 | 4.5 | pass |
| warning on surface-muted | 5.44 | 4.5 | pass |
| warning on surface-sunken | 5.16 | 4.5 | pass |
| danger on background | 6.19 | 4.5 | pass |
| danger on surface | 6.47 | 4.5 | pass |
| danger on surface-muted | 5.93 | 4.5 | pass |
| danger on surface-sunken | 5.63 | 4.5 | pass |
| border-strong (control / focus) on background | 3.54 | 3.0 | pass |
| border-strong (control / focus) on surface | 3.69 | 3.0 | pass |
| border-strong (control / focus) on surface-muted | 3.38 | 3.0 | pass |
| border-strong (control / focus) on surface-sunken | 3.21 | 3.0 | pass |
| ring (control / focus) on background | 3.59 | 3.0 | pass |
| ring (control / focus) on surface | 3.74 | 3.0 | pass |
| ring (control / focus) on surface-muted | 3.43 | 3.0 | pass |
| ring (control / focus) on surface-sunken | 3.26 | 3.0 | pass |
| primary-foreground on primary | 5.47 | 4.5 | pass |
| primary-foreground on primary-hover | 7.58 | 4.5 | pass |
| primary-soft-foreground on primary-soft | 7.27 | 4.5 | pass |
| success-foreground on success | 5.78 | 4.5 | pass |
| success-soft-foreground on success-soft | 6.81 | 4.5 | pass |
| warning-foreground on warning | 5.93 | 4.5 | pass |
| warning-soft-foreground on warning-soft | 6.84 | 4.5 | pass |
| danger-foreground on danger | 6.47 | 4.5 | pass |
| danger-soft-foreground on danger-soft | 7.60 | 4.5 | pass |
| track-1 text on background | 7.57 | 4.5 | pass |
| track-1 text on surface | 7.90 | 4.5 | pass |
| track-1 text on surface-muted | 7.24 | 4.5 | pass |
| track-1 text on surface-sunken | 6.88 | 4.5 | pass |
| track-1: track-foreground on track-1 | 7.90 | 4.5 | pass |
| track-1 text on track-1-soft | 7.07 | 4.5 | pass |
| track-2 text on background | 4.96 | 4.5 | pass |
| track-2 text on surface | 5.18 | 4.5 | pass |
| track-2 text on surface-muted | 4.75 | 4.5 | pass |
| track-2 text on surface-sunken | 4.51 | 4.5 | pass |
| track-2: track-foreground on track-2 | 5.18 | 4.5 | pass |
| track-2 text on track-2-soft | 4.88 | 4.5 | pass |
| track-3 text on background | 6.80 | 4.5 | pass |
| track-3 text on surface | 7.10 | 4.5 | pass |
| track-3 text on surface-muted | 6.51 | 4.5 | pass |
| track-3 text on surface-sunken | 6.18 | 4.5 | pass |
| track-3: track-foreground on track-3 | 7.10 | 4.5 | pass |
| track-3 text on track-3-soft | 6.48 | 4.5 | pass |
| track-4 text on background | 5.68 | 4.5 | pass |
| track-4 text on surface | 5.93 | 4.5 | pass |
| track-4 text on surface-muted | 5.44 | 4.5 | pass |
| track-4 text on surface-sunken | 5.16 | 4.5 | pass |
| track-4: track-foreground on track-4 | 5.93 | 4.5 | pass |
| track-4 text on track-4-soft | 5.57 | 4.5 | pass |
| track-5 text on background | 5.78 | 4.5 | pass |
| track-5 text on surface | 6.04 | 4.5 | pass |
| track-5 text on surface-muted | 5.53 | 4.5 | pass |
| track-5 text on surface-sunken | 5.25 | 4.5 | pass |
| track-5: track-foreground on track-5 | 6.04 | 4.5 | pass |
| track-5 text on track-5-soft | 5.53 | 4.5 | pass |
| track-6 text on background | 6.05 | 4.5 | pass |
| track-6 text on surface | 6.32 | 4.5 | pass |
| track-6 text on surface-muted | 5.80 | 4.5 | pass |
| track-6 text on surface-sunken | 5.50 | 4.5 | pass |
| track-6: track-foreground on track-6 | 6.32 | 4.5 | pass |
| track-6 text on track-6-soft | 5.89 | 4.5 | pass |
| track-7 text on background | 6.78 | 4.5 | pass |
| track-7 text on surface | 7.08 | 4.5 | pass |
| track-7 text on surface-muted | 6.49 | 4.5 | pass |
| track-7 text on surface-sunken | 6.16 | 4.5 | pass |
| track-7: track-foreground on track-7 | 7.08 | 4.5 | pass |
| track-7 text on track-7-soft | 6.84 | 4.5 | pass |
| track-8 text on background | 6.96 | 4.5 | pass |
| track-8 text on surface | 7.27 | 4.5 | pass |
| track-8 text on surface-muted | 6.66 | 4.5 | pass |
| track-8 text on surface-sunken | 6.32 | 4.5 | pass |
| track-8: track-foreground on track-8 | 7.27 | 4.5 | pass |
| track-8 text on track-8-soft | 6.99 | 4.5 | pass |
| heat-2 vs heat-0 (graphic, 3:1) | 3.26 | 3.0 | pass |
| heat-3 vs heat-0 (graphic, 3:1) | 6.60 | 3.0 | pass |
| heat-4 vs heat-0 (graphic, 3:1) | 12.59 | 3.0 | pass |
| heat-1 vs heat-0 (adjacent levels, ≥ 1.5 target) | 1.62 | 1.5 | pass |
| heat-2 vs heat-1 (adjacent levels, ≥ 1.5 target) | 2.01 | 1.5 | pass |
| heat-3 vs heat-2 (adjacent levels, ≥ 1.5 target) | 2.03 | 1.5 | pass |
| heat-4 vs heat-3 (adjacent levels, ≥ 1.5 target) | 1.91 | 1.5 | pass |

### Dark theme — 100 checks, 0 failing

| Pair | Ratio | Needs | Result |
| --- | --- | --- | --- |
| foreground on background | 18.92 | 4.5 | pass |
| foreground on surface | 16.74 | 4.5 | pass |
| foreground on surface-muted | 14.52 | 4.5 | pass |
| foreground on surface-sunken | 17.73 | 4.5 | pass |
| muted-foreground on background | 7.83 | 4.5 | pass |
| muted-foreground on surface | 6.93 | 4.5 | pass |
| muted-foreground on surface-muted | 6.01 | 4.5 | pass |
| muted-foreground on surface-sunken | 7.34 | 4.5 | pass |
| subtle-foreground on background | 6.53 | 4.5 | pass |
| subtle-foreground on surface | 5.78 | 4.5 | pass |
| subtle-foreground on surface-muted | 5.01 | 4.5 | pass |
| subtle-foreground on surface-sunken | 6.12 | 4.5 | pass |
| primary on background | 10.61 | 4.5 | pass |
| primary on surface | 9.39 | 4.5 | pass |
| primary on surface-muted | 8.15 | 4.5 | pass |
| primary on surface-sunken | 9.95 | 4.5 | pass |
| success on background | 11.34 | 4.5 | pass |
| success on surface | 10.04 | 4.5 | pass |
| success on surface-muted | 8.71 | 4.5 | pass |
| success on surface-sunken | 10.63 | 4.5 | pass |
| warning on background | 11.83 | 4.5 | pass |
| warning on surface | 10.48 | 4.5 | pass |
| warning on surface-muted | 9.09 | 4.5 | pass |
| warning on surface-sunken | 11.10 | 4.5 | pass |
| danger on background | 7.14 | 4.5 | pass |
| danger on surface | 6.32 | 4.5 | pass |
| danger on surface-muted | 5.48 | 4.5 | pass |
| danger on surface-sunken | 6.70 | 4.5 | pass |
| border-strong (control / focus) on background | 4.12 | 3.0 | pass |
| border-strong (control / focus) on surface | 3.65 | 3.0 | pass |
| border-strong (control / focus) on surface-muted | 3.16 | 3.0 | pass |
| border-strong (control / focus) on surface-sunken | 3.86 | 3.0 | pass |
| ring (control / focus) on background | 10.61 | 3.0 | pass |
| ring (control / focus) on surface | 9.39 | 3.0 | pass |
| ring (control / focus) on surface-muted | 8.15 | 3.0 | pass |
| ring (control / focus) on surface-sunken | 9.95 | 3.0 | pass |
| primary-foreground on primary | 7.77 | 4.5 | pass |
| primary-foreground on primary-hover | 9.78 | 4.5 | pass |
| primary-soft-foreground on primary-soft | 11.52 | 4.5 | pass |
| success-foreground on success | 8.55 | 4.5 | pass |
| success-soft-foreground on success-soft | 10.95 | 4.5 | pass |
| warning-foreground on warning | 8.97 | 4.5 | pass |
| warning-soft-foreground on warning-soft | 10.90 | 4.5 | pass |
| danger-foreground on danger | 5.84 | 4.5 | pass |
| danger-soft-foreground on danger-soft | 8.58 | 4.5 | pass |
| track-1 text on background | 9.91 | 4.5 | pass |
| track-1 text on surface | 8.77 | 4.5 | pass |
| track-1 text on surface-muted | 7.61 | 4.5 | pass |
| track-1 text on surface-sunken | 9.29 | 4.5 | pass |
| track-1: track-foreground on track-1 | 9.91 | 4.5 | pass |
| track-1 text on track-1-soft | 8.02 | 4.5 | pass |
| track-2 text on background | 11.71 | 4.5 | pass |
| track-2 text on surface | 10.37 | 4.5 | pass |
| track-2 text on surface-muted | 8.99 | 4.5 | pass |
| track-2 text on surface-sunken | 10.98 | 4.5 | pass |
| track-2: track-foreground on track-2 | 11.71 | 4.5 | pass |
| track-2 text on track-2-soft | 9.38 | 4.5 | pass |
| track-3 text on background | 10.70 | 4.5 | pass |
| track-3 text on surface | 9.47 | 4.5 | pass |
| track-3 text on surface-muted | 8.22 | 4.5 | pass |
| track-3 text on surface-sunken | 10.03 | 4.5 | pass |
| track-3: track-foreground on track-3 | 10.70 | 4.5 | pass |
| track-3 text on track-3-soft | 8.56 | 4.5 | pass |
| track-4 text on background | 11.85 | 4.5 | pass |
| track-4 text on surface | 10.49 | 4.5 | pass |
| track-4 text on surface-muted | 9.10 | 4.5 | pass |
| track-4 text on surface-sunken | 11.11 | 4.5 | pass |
| track-4: track-foreground on track-4 | 11.85 | 4.5 | pass |
| track-4 text on track-4-soft | 8.89 | 4.5 | pass |
| track-5 text on background | 10.89 | 4.5 | pass |
| track-5 text on surface | 9.64 | 4.5 | pass |
| track-5 text on surface-muted | 8.36 | 4.5 | pass |
| track-5 text on surface-sunken | 10.21 | 4.5 | pass |
| track-5: track-foreground on track-5 | 10.89 | 4.5 | pass |
| track-5 text on track-5-soft | 9.07 | 4.5 | pass |
| track-6 text on background | 11.23 | 4.5 | pass |
| track-6 text on surface | 9.94 | 4.5 | pass |
| track-6 text on surface-muted | 8.62 | 4.5 | pass |
| track-6 text on surface-sunken | 10.53 | 4.5 | pass |
| track-6: track-foreground on track-6 | 11.23 | 4.5 | pass |
| track-6 text on track-6-soft | 9.06 | 4.5 | pass |
| track-7 text on background | 15.12 | 4.5 | pass |
| track-7 text on surface | 13.39 | 4.5 | pass |
| track-7 text on surface-muted | 11.61 | 4.5 | pass |
| track-7 text on surface-sunken | 14.18 | 4.5 | pass |
| track-7: track-foreground on track-7 | 15.12 | 4.5 | pass |
| track-7 text on track-7-soft | 11.53 | 4.5 | pass |
| track-8 text on background | 13.63 | 4.5 | pass |
| track-8 text on surface | 12.06 | 4.5 | pass |
| track-8 text on surface-muted | 10.46 | 4.5 | pass |
| track-8 text on surface-sunken | 12.78 | 4.5 | pass |
| track-8: track-foreground on track-8 | 13.63 | 4.5 | pass |
| track-8 text on track-8-soft | 10.41 | 4.5 | pass |
| heat-2 vs heat-0 (graphic, 3:1) | 4.05 | 3.0 | pass |
| heat-3 vs heat-0 (graphic, 3:1) | 8.15 | 3.0 | pass |
| heat-4 vs heat-0 (graphic, 3:1) | 13.46 | 3.0 | pass |
| heat-1 vs heat-0 (adjacent levels, ≥ 1.5 target) | 1.60 | 1.5 | pass |
| heat-2 vs heat-1 (adjacent levels, ≥ 1.5 target) | 2.53 | 1.5 | pass |
| heat-3 vs heat-2 (adjacent levels, ≥ 1.5 target) | 2.01 | 1.5 | pass |
| heat-4 vs heat-3 (adjacent levels, ≥ 1.5 target) | 1.65 | 1.5 | pass |

## Appendix B — ui-ux-pro-max query log

| Query | Mode | Used for |
| --- | --- | --- |
| "learning dashboard productivity calm focused education" | `--design-system` (variance 3, motion 2, density 6) | Style family (Minimalism & Swiss), dials, pre-delivery checklist; typography and anti-patterns rejected (§1) |
| "productivity habit tracker dashboard developer adults" | `--design-system` (retry) | Confirmed style; palette/typography rejected (§1) |
| "professional clean dashboard readable" | `--domain typography` | Lexend + Source Sans 3 considered (§4.1) |
| "vietnamese sans serif variable" | `--domain google-fonts` | Vietnamese subset candidates |
| "calm focus learning productivity" | `--domain color` | Teal "productivity tool" direction (§3) |
| "calendar heatmap streak activity" | `--domain chart` | Heatmap labels + table fallback (§3.4) |
| "focus visible keyboard navigation", "reduced motion animation", "bottom navigation mobile tabs", "dark mode contrast" | `--domain ux` | §5, §7, §10 |
| "theming css variables dark mode" | `--stack shadcn` | OKLCH variables, `:root` + `.dark`, `@theme inline` (tokens.css) |
