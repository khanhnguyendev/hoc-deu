import 'server-only'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { parse as parseYaml } from 'yaml'
import type { z } from 'zod'
import { trackManifestSchema, type TrackManifest } from './schemas/manifest'

const defaultRoot = (): string => path.join(process.cwd(), 'content', 'tracks')

/** One manifest per process for a given `root` (decision 12): re-parsing costs a disk read per request. */
const cache = new Map<string, readonly TrackManifest[]>()

function fileLabel(file: string): string {
  const relative = path.relative(process.cwd(), file)
  return relative.split(path.sep).join('/')
}

function formatManifestError(file: string, error: z.ZodError): string {
  const [issue] = error.issues
  const field = issue !== undefined && issue.path.length > 0 ? issue.path.join('.') : '(root)'
  const message = issue?.message ?? 'invalid manifest'
  return `${fileLabel(file)}: ${field}: ${message}`
}

function readManifest(file: string): TrackManifest {
  const raw = readFileSync(file, 'utf8')
  const data: unknown = parseYaml(raw)
  const result = trackManifestSchema.safeParse(data)
  if (!result.success) {
    throw new Error(formatManifestError(file, result.error))
  }
  return result.data
}

function readAll(root: string): readonly TrackManifest[] {
  const dirs = readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
  return dirs.map((dir) => readManifest(path.join(root, dir, 'track.yaml')))
}

/**
 * Loads and validates every track's `track.yaml` under `root` (defaults to
 * `<cwd>/content/tracks`), parsed once per process for a given root.
 */
export function loadTracks(root: string = defaultRoot()): readonly TrackManifest[] {
  const cached = cache.get(root)
  if (cached !== undefined) return cached
  const tracks = readAll(root)
  cache.set(root, tracks)
  return tracks
}

/** Tracks with `status: active` — the only ones a learner may enroll in. */
export function activeTracks(root?: string): readonly TrackManifest[] {
  return loadTracks(root).filter((track) => track.status === 'active')
}

/** A track by id, including `draft` and `retired` ones, or `null` when it does not exist. */
export function getTrack(id: string, root?: string): TrackManifest | null {
  return loadTracks(root).find((track) => track.id === id) ?? null
}
