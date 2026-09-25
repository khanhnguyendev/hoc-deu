import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { activeTracks, getTrack, loadTracks } from './tracks'

const fixturesRoot = (name: string) =>
  path.join(import.meta.dirname, '__fixtures__', 'tracks', name)

describe('loadTracks (real manifests)', () => {
  it('loads both real track manifests', () => {
    const tracks = loadTracks()
    expect(tracks.map((track) => track.id).sort()).toEqual(['dsa', 'english'])
  })

  it('dsa has the 8w/10w roadmaps, 8w recommended below 75 min/day', () => {
    const dsa = getTrack('dsa')
    expect(dsa?.roadmaps.map((roadmap) => roadmap.id)).toEqual(['8w', '10w'])
    expect(dsa?.roadmaps[0]).toEqual({ id: '8w', recommendedBelowMinutes: 75 })
  })

  it('english defaults to a 25-minute budget', () => {
    const english = getTrack('english')
    expect(english?.defaults.budgetMinutes).toBe(25)
  })

  it('getTrack returns null for an unknown id', () => {
    expect(getTrack('nope')).toBeNull()
  })
})

describe('loadTracks (fixtures)', () => {
  it('rejects an accent outside the design tokens, naming the file and the field', () => {
    const root = fixturesRoot('invalid-accent')
    expect(() => loadTracks(root)).toThrow(/track\.yaml: accent:/)
  })

  it('rejects an unknown weekday key in the weekly template', () => {
    const root = fixturesRoot('invalid-weekday')
    expect(() => loadTracks(root)).toThrow(/track\.yaml/)
  })

  it('accepts a weekly template that lists only sat and sun (partial record)', () => {
    const root = fixturesRoot('partial-template')
    const [track] = loadTracks(root)
    expect(Object.keys(track?.weeklyTemplate ?? {})).toEqual(['sat', 'sun'])
  })

  it('activeTracks excludes a draft track; getTrack still returns it', () => {
    const root = fixturesRoot('valid-status')
    expect(activeTracks(root).map((track) => track.id)).toEqual(['demo-active'])
    expect(getTrack('demo-draft', root)?.status).toBe('draft')
    expect(getTrack('nope', root)).toBeNull()
  })
})
