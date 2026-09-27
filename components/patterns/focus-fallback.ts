/**
 * Where focus goes when the control that held it disappears (DESIGN_SYSTEM §10): an action that
 * re-renders the page — a check-in, "Học tiếp hôm nay", "Học thêm" — can remove its own button,
 * which leaves focus on `<body>`. A page marks one heading as its fallback (`Section`'s
 * `focusFallback`: `tabIndex={-1}` and this attribute), and `useActionFeedback` moves focus there
 * when its control unmounts with focus lost. A plain module: server components use the attribute.
 */
export const FOCUS_FALLBACK_ATTRIBUTE = 'data-focus-fallback'

/** Whether nothing holds focus (a removed control leaves it on `<body>`). Browser only. */
export function focusLost(): boolean {
  return document.activeElement === null || document.activeElement === document.body
}

/** The page's focus fallback (a heading marked with `FOCUS_FALLBACK_ATTRIBUTE`), if any. */
export function focusFallbackElement(): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[${FOCUS_FALLBACK_ATTRIBUTE}]`)
}
