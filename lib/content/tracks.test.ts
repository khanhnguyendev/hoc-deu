import { readdirSync, readFileSync } from 'node:fs'
import { join, sep } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getCatalog } from './catalog'
import type { Catalog } from './catalog-types'
import type { TrackManifest } from './schemas/manifest'
import { activeTracks, getTrack, loadTracks } from './tracks'

// A fixture catalog when a test sets one; the generated catalog otherwise.
const fixture = vi.hoisted(() => ({ catalog: null as Catalog | null }))
vi.mock('./catalog', async (importOriginal) => {
  const real = await importOriginal<typeof import('./catalog')>()
  return { ...real, getCatalog: () => fixture.catalog ?? real.getCatalog() }
})

beforeEach(() => {
  fixture.catalog = null
})

describe('the track manifests, from the generated catalog (decision 6)', () => {
  it('are the catalog’s tracks: both real tracks, parsed once by content:build', () => {
    expect(loadTracks()).toBe(getCatalog().tracks)
    expect(loadTracks().map((track) => track.id)).toEqual(['dsa', 'english'])
  })

  it('dsa has the 8w/10w roadmaps, 8w recommended below 75 min/day', () => {
    const dsa = getTrack('dsa')
    expect(dsa?.roadmaps.map((roadmap) => roadmap.id)).toEqual(['8w', '10w'])
    expect(dsa?.roadmaps[0]).toEqual({ id: '8w', recommendedBelowMinutes: 75 })
  })

  it('english defaults to a 25-minute budget', () => {
    expect(getTrack('english')?.defaults.budgetMinutes).toBe(25)
  })

  it('getTrack returns null for an unknown id, and for Object.prototype names', () => {
    expect(getTrack('nope')).toBeNull()
    expect(getTrack('constructor')).toBeNull()
  })
})

describe('activeTracks / getTrack (fixture catalog)', () => {
  const track = (id: string, status: TrackManifest['status']) => ({ id, status }) as TrackManifest

  it('activeTracks excludes draft and retired tracks; getTrack still returns them', () => {
    fixture.catalog = {
      ...getCatalog(),
      tracks: [
        track('demo-active', 'active'),
        track('demo-draft', 'draft'),
        track('demo-retired', 'retired'),
      ],
    }
    expect(activeTracks().map((t) => t.id)).toEqual(['demo-active'])
    expect(getTrack('demo-draft')?.status).toBe('draft')
    expect(getTrack('demo-retired')?.status).toBe('retired')
    expect(getTrack('nope')).toBeNull()
  })

  it('a catalog without tracks lists none (RF-4)', () => {
    fixture.catalog = { ...getCatalog(), tracks: [] }
    expect(loadTracks()).toEqual([])
    expect(activeTracks()).toEqual([])
  })
})

describe('no runtime YAML in app code (decision 6)', () => {
  it('nothing under app/, components/, features/ or lib/ imports the yaml package', () => {
    const root = process.cwd()
    const offenders: string[] = []
    for (const dir of ['app', 'components', 'features', 'lib']) {
      for (const entry of readdirSync(join(root, dir), { recursive: true, encoding: 'utf8' })) {
        if (!/\.[cm]?[jt]sx?$/.test(entry) || /\.test\.[jt]sx?$/.test(entry)) continue
        const file = `${dir}/${entry.split(sep).join('/')}`
        if (
          /from ['"]yaml['"]|import\(['"]yaml['"]\)/.test(readFileSync(join(root, file), 'utf8'))
        ) {
          offenders.push(file)
        }
      }
    }
    expect(offenders).toEqual([])
  })
})
