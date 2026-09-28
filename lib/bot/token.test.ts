import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'

import { newBotToken, tokenHash, tokenMatches } from './token'

const NOW = new Date('2026-09-28T10:00:00Z')
const sha256 = (value: string) => createHash('sha256').update(value, 'utf8').digest('hex')

describe('newBotToken (decision 7)', () => {
  it('is hdb_ + 43 base64url characters (32 random bytes), with its SHA-256 hex', () => {
    const { token, hash } = newBotToken()
    expect(token).toMatch(/^hdb_[A-Za-z0-9_-]{43}$/)
    expect(Buffer.from(token.slice(4), 'base64url')).toHaveLength(32)
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
    expect(hash).toBe(sha256(token))
  })

  it('is random', () => {
    const tokens = new Set(Array.from({ length: 50 }, () => newBotToken().token))
    expect(tokens.size).toBe(50)
  })
})

describe('tokenHash', () => {
  it('is the lowercase SHA-256 hex of the whole token', () => {
    expect(tokenHash('hdb_abc')).toBe(sha256('hdb_abc'))
  })
})

describe('tokenMatches', () => {
  const current = newBotToken()
  const previous = newBotToken()
  const inOneHour = new Date(NOW.getTime() + 3_600_000)
  const anHourAgo = new Date(NOW.getTime() - 3_600_000)

  it('matches the current token', () => {
    const state = { hash: current.hash, prevHash: null, prevValidUntil: null }
    expect(tokenMatches(current.token, state, NOW)).toBe(true)
  })

  it('matches the previous token only while it is valid', () => {
    const state = { hash: current.hash, prevHash: previous.hash, prevValidUntil: inOneHour }
    expect(tokenMatches(previous.token, state, NOW)).toBe(true)
    expect(tokenMatches(previous.token, { ...state, prevValidUntil: anHourAgo }, NOW)).toBe(false)
    expect(tokenMatches(previous.token, { ...state, prevValidUntil: NOW }, NOW)).toBe(false)
    expect(tokenMatches(previous.token, { ...state, prevValidUntil: null }, NOW)).toBe(false)
  })

  it('matches nothing while no token exists', () => {
    const state = { hash: null, prevHash: null, prevValidUntil: null }
    expect(tokenMatches(current.token, state, NOW)).toBe(false)
    expect(tokenMatches('', state, NOW)).toBe(false)
  })

  it.each([
    ['another token', () => newBotToken().token],
    ['the token with a character more', () => `${current.token}x`],
    ['the token with a character less', () => current.token.slice(0, -1)],
    ['the hash itself', () => current.hash],
    ['an empty string', () => ''],
  ])('refuses %s', (_, presented) => {
    const state = { hash: current.hash, prevHash: previous.hash, prevValidUntil: inOneHour }
    expect(tokenMatches(presented(), state, NOW)).toBe(false)
  })

  it('refuses everything against a malformed stored hash', () => {
    const state = { hash: 'not-hex', prevHash: null, prevValidUntil: null }
    expect(tokenMatches('not-hex', state, NOW)).toBe(false)
  })
})
