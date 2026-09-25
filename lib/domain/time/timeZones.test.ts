import { afterEach, describe, expect, it, vi } from 'vitest'
import { canonicalTimeZone, isTimeZoneOption, isValidTimeZone, timeZoneOptions } from './timeZones'

describe('canonicalTimeZone', () => {
  it('maps CLDR legacy aliases to their IANA name', () => {
    expect(canonicalTimeZone('Asia/Saigon')).toBe('Asia/Ho_Chi_Minh')
    expect(canonicalTimeZone('Asia/Calcutta')).toBe('Asia/Kolkata')
    expect(canonicalTimeZone('Asia/Katmandu')).toBe('Asia/Kathmandu')
    expect(canonicalTimeZone('Asia/Rangoon')).toBe('Asia/Yangon')
    expect(canonicalTimeZone('Europe/Kiev')).toBe('Europe/Kyiv')
    expect(canonicalTimeZone('Atlantic/Faeroe')).toBe('Atlantic/Faroe')
    expect(canonicalTimeZone('America/Godthab')).toBe('America/Nuuk')
    expect(canonicalTimeZone('Pacific/Enderbury')).toBe('Pacific/Kanton')
    expect(canonicalTimeZone('Pacific/Truk')).toBe('Pacific/Chuuk')
    expect(canonicalTimeZone('Pacific/Ponape')).toBe('Pacific/Pohnpei')
    expect(canonicalTimeZone('America/Buenos_Aires')).toBe('America/Argentina/Buenos_Aires')
  })

  it('returns an IANA name unchanged', () => {
    expect(canonicalTimeZone('Asia/Ho_Chi_Minh')).toBe('Asia/Ho_Chi_Minh')
    expect(canonicalTimeZone('America/New_York')).toBe('America/New_York')
  })
})

describe('isValidTimeZone', () => {
  it('accepts a valid IANA name and a valid legacy alias', () => {
    expect(isValidTimeZone('Asia/Ho_Chi_Minh')).toBe(true)
    expect(isValidTimeZone('Asia/Saigon')).toBe(true)
  })

  it('rejects an unknown identifier', () => {
    expect(isValidTimeZone('Mars/Base')).toBe(false)
  })
})

describe('timeZoneOptions', () => {
  const options = timeZoneOptions()

  it('includes canonical IANA names', () => {
    expect(options).toContain('Asia/Ho_Chi_Minh')
    expect(options).toContain('Asia/Kolkata')
  })

  it('excludes legacy aliases', () => {
    expect(options).not.toContain('Asia/Saigon')
    expect(options).not.toContain('Asia/Calcutta')
  })

  it('is sorted and duplicate-free', () => {
    expect(options).toEqual([...new Set(options)].sort())
  })
})

describe('isTimeZoneOption', () => {
  it('accepts exactly the picker spellings', () => {
    expect(isTimeZoneOption('Asia/Ho_Chi_Minh')).toBe(true)
    expect(isTimeZoneOption('Asia/Tokyo')).toBe(true)
  })

  it('rejects what Intl accepts but the picker does not offer, and unknown zones', () => {
    expect(isValidTimeZone('asia/tokyo')).toBe(true)
    expect(isTimeZoneOption('asia/tokyo')).toBe(false)
    expect(isTimeZoneOption('Asia/Saigon')).toBe(false)
    expect(isTimeZoneOption('Mars/Base')).toBe(false)
  })

  it('rejects an unknown zone (Mars/Olympus) and accepts a real one (M3 follow-up)', () => {
    expect(isTimeZoneOption('Asia/Ho_Chi_Minh')).toBe(true)
    expect(isTimeZoneOption('Mars/Olympus')).toBe(false)
  })
})

describe('isTimeZoneOption option-list caching (M3 follow-up)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
  })

  it('builds the option list at most once across many calls', async () => {
    vi.resetModules()
    const supportedValuesOf = vi.spyOn(Intl, 'supportedValuesOf')
    const fresh = await import('./timeZones')
    for (let i = 0; i < 100; i += 1) {
      expect(fresh.isTimeZoneOption('Asia/Ho_Chi_Minh')).toBe(true)
      expect(fresh.isTimeZoneOption('Mars/Olympus')).toBe(false)
    }
    expect(supportedValuesOf.mock.calls.length).toBeLessThanOrEqual(1)
  })
})
