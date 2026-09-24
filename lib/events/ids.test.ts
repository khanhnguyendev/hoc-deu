import { describe, expect, it } from 'vitest'
import { deriveEventId } from './ids'

const REQUEST_ID = '3f2b8c1e-4d5a-4b6c-8e7f-9a0b1c2d3e4f'
const UUID_V5 = /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe('deriveEventId (decision 9)', () => {
  it('is the RFC 9562 UUIDv5 of the key (UTF-8) in the requestId namespace', () => {
    // Reference values from Python's uuid.uuid5 (the first is the RFC's DNS-namespace example).
    expect(deriveEventId('6ba7b810-9dad-11d1-80b4-00c04fd430c8', 'www.example.com')).toBe(
      '2ed6657d-e927-568b-95e1-2665a8aea6a2',
    )
    expect(deriveEventId(REQUEST_ID, 'track.enrolled:dsa')).toBe(
      'fad2a87f-8eea-5d3f-a1b7-f4d1639e7826',
    )
    expect(deriveEventId(REQUEST_ID, 'Tiếng Việt'.normalize('NFC'))).toBe(
      '0b70571c-8644-5ee0-a821-5e258dbf3bcd',
    )
  })

  it('returns the same id for the same inputs', () => {
    expect(deriveEventId(REQUEST_ID, 'schedule.changed')).toBe(
      deriveEventId(REQUEST_ID, 'schedule.changed'),
    )
  })

  it('treats the requestId case-insensitively, like any UUID', () => {
    expect(deriveEventId(REQUEST_ID.toUpperCase(), 'track.enrolled:dsa')).toBe(
      deriveEventId(REQUEST_ID, 'track.enrolled:dsa'),
    )
  })

  it('sets the version nibble to 5 and the variant to 8, 9, a or b', () => {
    for (const key of ['', 'a', 'track.enrolled:dsa', 'track.enrolled:english', 'x'.repeat(500)]) {
      expect(deriveEventId(REQUEST_ID, key)).toMatch(UUID_V5)
    }
  })

  it('gives different ids for different keys or request ids', () => {
    const ids = new Set([
      deriveEventId(REQUEST_ID, 'track.enrolled:dsa'),
      deriveEventId(REQUEST_ID, 'track.enrolled:english'),
      deriveEventId(REQUEST_ID, 'schedule.changed'),
      deriveEventId('6ba7b810-9dad-11d1-80b4-00c04fd430c8', 'track.enrolled:dsa'),
    ])
    expect(ids.size).toBe(4)
  })

  it.each([
    '',
    'not-a-uuid',
    '3f2b8c1e4d5a4b6c8e7f9a0b1c2d3e4f',
    '3f2b8c1e-4d5a-4b6c-8e7f-9a0b1c2d3e4',
    '3f2b8c1e-4d5a-4b6c-8e7f-9a0b1c2d3e4f0',
    '{3f2b8c1e-4d5a-4b6c-8e7f-9a0b1c2d3e4f}',
    'zf2b8c1e-4d5a-4b6c-8e7f-9a0b1c2d3e4f',
    ` ${REQUEST_ID}`,
  ])('throws for the invalid requestId %j', (requestId) => {
    expect(() => deriveEventId(requestId, 'track.enrolled:dsa')).toThrow(TypeError)
  })
})
