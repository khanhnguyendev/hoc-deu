import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { END, START, syncTokens } from './sync'

const globals = (body: string) =>
  `@import "tailwindcss";\n\n${START}\n${body}\n${END}\n\n/* shadcn extras */\n.x { color: var(--primary); }\n`

describe('syncTokens', () => {
  it('replaces only the token block', () => {
    const out = syncTokens(globals(':root { --a: 1; }'), ':root { --a: 2; }\n')
    expect(out).toBe(globals(':root { --a: 2; }'))
  })

  it('is idempotent', () => {
    const once = syncTokens(globals('old'), 'new')
    expect(syncTokens(once, 'new')).toBe(once)
  })

  it.each([
    ['missing start', `x\n${END}\n`],
    ['missing end', `${START}\nx\n`],
    ['duplicated start', `${START}\n${START}\nx\n${END}\n`],
    ['end before start', `${END}\nx\n${START}\n`],
  ])('fails clearly on %s', (_, css) => {
    expect(() => syncTokens(css, 'new')).toThrow(/tokens:start|tokens:end/)
  })

  it('keeps the repository in sync', () => {
    const repo = readFileSync('app/globals.css', 'utf8')
    expect(syncTokens(repo, readFileSync('docs/design/tokens.css', 'utf8'))).toBe(repo)
  })
})
