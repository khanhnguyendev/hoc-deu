/**
 * Where focus goes when the control that held it disappears (DESIGN_SYSTEM §10): an action that
 * re-renders the page — a check-in, "Học tiếp hôm nay", "Học thêm", "Bắt đầu lại" — can remove its
 * own button, which leaves focus on `<body>`. Headings mark themselves as fallbacks (`tabIndex={-1}`
 * and this attribute): a `Section` with `focusFallback` (`"section"`: the part of the page the
 * control belonged to — `/today`'s plan) wins over PageHeader's `h1` (`"page"`: every page has
 * one, so the track page and `/today` without a plan have a fallback too, re-review M2).
 * `useActionFeedback` moves focus there when its answer's re-render removes the control with
 * focus lost. A plain module: server components use the attribute.
 */
export const FOCUS_FALLBACK_ATTRIBUTE = 'data-focus-fallback'

/** A Section's heading (the control's own part of the page) or the page's `h1`. */
export type FocusFallbackScope = 'section' | 'page'

/** The attributes that make a heading a focus fallback of `scope`: focusable by script only. */
export function focusFallbackProps(scope: FocusFallbackScope) {
  return { tabIndex: -1, [FOCUS_FALLBACK_ATTRIBUTE]: scope } as const
}

/** Whether nothing holds focus (a removed control leaves it on `<body>`). Browser only. */
export function focusLost(): boolean {
  return document.activeElement === null || document.activeElement === document.body
}

/** The page's focus fallback: its Section fallback, else its `h1` (PageHeader), if any. */
export function focusFallbackElement(): HTMLElement | null {
  const scoped = (scope: FocusFallbackScope) =>
    document.querySelector<HTMLElement>(`[${FOCUS_FALLBACK_ATTRIBUTE}="${scope}"]`)
  return scoped('section') ?? scoped('page')
}
