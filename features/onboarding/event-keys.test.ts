import { describe, expect, it } from 'vitest'
import { scheduleKey, settingsKey, trackEnrolledKey, trackRemovedKey } from './event-keys'

describe('onboarding event keys (M2 RF-2 "digest keys" minor)', () => {
  it('gives the same key for the same fields', () => {
    const fields = { roadmapVariant: '10w', budgetMinutes: 75, startDate: '2026-09-24' }
    expect(trackEnrolledKey('dsa', fields)).toBe(trackEnrolledKey('dsa', { ...fields }))
  })

  it('gives a different key when a chosen field changes', () => {
    const first = trackEnrolledKey('dsa', {
      roadmapVariant: '10w',
      budgetMinutes: 75,
      startDate: '2026-09-24',
    })
    const editedBudget = trackEnrolledKey('dsa', {
      roadmapVariant: '10w',
      budgetMinutes: 90,
      startDate: '2026-09-24',
    })
    const editedVariant = trackEnrolledKey('dsa', {
      roadmapVariant: '8w',
      budgetMinutes: 75,
      startDate: '2026-09-24',
    })
    const editedStart = trackEnrolledKey('dsa', {
      roadmapVariant: '10w',
      budgetMinutes: 75,
      startDate: '2026-09-25',
    })
    expect(new Set([first, editedBudget, editedVariant, editedStart]).size).toBe(4)
  })

  it('keys a track by its id, not only its fields', () => {
    const fields = { roadmapVariant: '10w', budgetMinutes: 25, startDate: '2026-09-24' }
    expect(trackEnrolledKey('dsa', fields)).not.toBe(trackEnrolledKey('english', fields))
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
