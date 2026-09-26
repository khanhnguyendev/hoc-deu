import { describe, expect, it } from 'vitest'
import { scheduleKey, settingsKey, trackEnrolledKey, trackRemovedKey } from './event-keys'

const FIELDS = {
  roadmapVariant: '10w',
  budgetMinutes: 75,
  startDate: '2026-09-24',
  currentStatus: null,
} as const

describe('onboarding event keys (M2 RF-2 "digest keys" minor)', () => {
  it('gives the same key for the same fields', () => {
    expect(trackEnrolledKey('dsa', FIELDS)).toBe(trackEnrolledKey('dsa', { ...FIELDS }))
  })

  it('gives a different key when a chosen field changes', () => {
    const first = trackEnrolledKey('dsa', FIELDS)
    const editedBudget = trackEnrolledKey('dsa', { ...FIELDS, budgetMinutes: 90 })
    const editedVariant = trackEnrolledKey('dsa', { ...FIELDS, roadmapVariant: '8w' })
    const editedStart = trackEnrolledKey('dsa', { ...FIELDS, startDate: '2026-09-25' })
    expect(new Set([first, editedBudget, editedVariant, editedStart]).size).toBe(4)
  })

  it('gives a different key when the track was removed since the first enrollment, even with the exact same chosen fields (M2 minor, A→B→A within one render)', () => {
    const neverEnrolled = trackEnrolledKey('dsa', { ...FIELDS, currentStatus: null })
    const reenrolledAfterRemoval = trackEnrolledKey('dsa', { ...FIELDS, currentStatus: 'removed' })
    const alreadyActive = trackEnrolledKey('dsa', { ...FIELDS, currentStatus: 'active' })
    const paused = trackEnrolledKey('dsa', { ...FIELDS, currentStatus: 'paused' })
    expect(new Set([neverEnrolled, reenrolledAfterRemoval, alreadyActive, paused]).size).toBe(4)
  })

  it('keys a track by its id, not only its fields', () => {
    expect(trackEnrolledKey('dsa', FIELDS)).not.toBe(trackEnrolledKey('english', FIELDS))
  })

  it('changes the schedule key only when the chosen schedule fields change', () => {
    const key = scheduleKey({ timezone: 'Asia/Ho_Chi_Minh', dayStartsAt: '04:00' })
    expect(scheduleKey({ timezone: 'Asia/Ho_Chi_Minh', dayStartsAt: '04:00' })).toBe(key)
    expect(scheduleKey({ timezone: 'Asia/Tokyo', dayStartsAt: '04:00' })).not.toBe(key)
    expect(scheduleKey({ timezone: 'Asia/Ho_Chi_Minh', dayStartsAt: '00:00' })).not.toBe(key)
  })

  it('changes the settings key with the code language', () => {
    expect(settingsKey('python')).not.toBe(settingsKey('java'))
  })

  it('keys a removed track by its id', () => {
    expect(trackRemovedKey('dsa')).not.toBe(trackRemovedKey('english'))
    expect(trackRemovedKey('dsa')).toBe(trackRemovedKey('dsa'))
  })
})
