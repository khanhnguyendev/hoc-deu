import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { userRef } from './refs'

const SECRET = 'test-ref-secret-0123456789abcdefghijklmnop'
const USER = '6f1d2c3b-4a59-4e8f-9a0b-1c2d3e4f5a6b'
const RUN_A = '0d3c2b1a-9f8e-4d7c-8b6a-5f4e3d2c1b0a'
const RUN_B = '1e2d3c4b-5a69-4788-97a6-b5c4d3e2f1a0'

describe('userRef (§6.3: u_ + 16 base32 characters of HMAC-SHA256(BOT_REF_SECRET, user:run))', () => {
  it('is deterministic and has the u_ + 16 lowercase base32 form of bot_run_users.user_ref', () => {
    const ref = userRef(USER, RUN_A, SECRET)
    expect(ref).toMatch(/^u_[a-z2-7]{16}$/)
    expect(userRef(USER, RUN_A, SECRET)).toBe(ref)
  })

  it('differs per run, per user and per secret', () => {
    const ref = userRef(USER, RUN_A, SECRET)
    expect(userRef(USER, RUN_B, SECRET)).not.toBe(ref)
    expect(userRef(RUN_B, RUN_A, SECRET)).not.toBe(ref)
    expect(userRef(USER, RUN_A, `${SECRET}x`)).not.toBe(ref)
  })

  it('contains no part of the user id (unlinkable to it without the secret)', () => {
    const body = userRef(USER, RUN_A, SECRET).slice(2)
    const hexRuns = USER.replaceAll('-', '').match(/.{4}/g) ?? []
    for (const part of [...USER.split('-'), ...hexRuns]) expect(body).not.toContain(part)
  })

  it('matches a known HMAC vector (RFC 4648 base32 of the first 10 bytes)', () => {
    expect(userRef('a', 'b', 'key')).toBe(expectedRef('key', 'a:b'))
  })
})

/** An independent base32 of the digest's first 10 bytes, bit by bit. */
function expectedRef(secret: string, message: string): string {
  const bytes = createHmac('sha256', secret).update(message, 'utf8').digest().subarray(0, 10)
  const bits = [...bytes].map((byte) => byte.toString(2).padStart(8, '0')).join('')
  const alphabet = 'abcdefghijklmnopqrstuvwxyz234567'
  let out = ''
  for (let i = 0; i < 80; i += 5) out += alphabet[Number.parseInt(bits.slice(i, i + 5), 2)]
  return `u_${out}`
}
