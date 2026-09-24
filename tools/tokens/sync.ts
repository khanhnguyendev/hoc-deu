/**
 * `app/globals.css` holds the design tokens (generated from docs/design/tokens.css) between two
 * markers, plus anything else the app needs (e.g. CSS merged from shadcn/ui). `pnpm tokens:sync`
 * replaces only the marked block, so the rest of the file survives a token change.
 */
export const START =
  '/* tokens:start — generated from docs/design/tokens.css by `pnpm tokens:sync`; do not edit by hand */'
export const END = '/* tokens:end */'

function indexOnce(css: string, marker: string, name: string): number {
  const first = css.indexOf(marker)
  if (first === -1) throw new Error(`app/globals.css has no ${name} marker`)
  if (css.indexOf(marker, first + marker.length) !== -1) {
    throw new Error(`app/globals.css has more than one ${name} marker`)
  }
  return first
}

/** Return `globals` with the token block replaced by `tokens`. */
export function syncTokens(globals: string, tokens: string): string {
  const start = indexOnce(globals, START, 'tokens:start')
  const end = indexOnce(globals, END, 'tokens:end')
  if (end < start) throw new Error('app/globals.css has tokens:end before tokens:start')
  return `${globals.slice(0, start)}${START}\n${tokens.trim()}\n${globals.slice(end)}`
}
