/**
 * The §6.10 contract suite's CI job (task 6.8; owner answer Q2, Part B-M6 decision 23). The bot
 * API spec (`e2e/bot-api.spec.ts`) changes the global `bot_settings` row and today's run keys, so
 * it runs in its own Playwright project `bot-api` and its own required CI job `bot-contract`,
 * never in the `e2e` job's `desktop` / `mobile` projects. This file pins both sides: the
 * Playwright projects and the two jobs of `ci.yml`.
 */
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { devices, type PlaywrightTestConfig } from '@playwright/test'
import { parse as parseYaml } from 'yaml'
import { beforeAll, describe, expect, it } from 'vitest'

const ROOT = resolve(import.meta.dirname, '..', '..')
const BOT_SPEC = 'bot-api.spec.ts'

type Step = { name?: string; if?: string; uses?: string; run?: string; with?: unknown }
type Job = {
  name?: string
  if?: unknown
  needs?: unknown
  'continue-on-error'?: unknown
  'runs-on': string
  steps: Step[]
}
type Workflow = { on: Record<string, unknown>; jobs: Record<string, Job> }

const workflow = parseYaml(
  readFileSync(join(ROOT, '.github', 'workflows', 'ci.yml'), 'utf8'),
) as Workflow

const job = (id: string): Job => {
  const found = workflow.jobs[id]
  if (found === undefined) throw new Error(`ci.yml has no job "${id}"`)
  return found
}
const runs = (steps: Step[]): string[] => steps.flatMap((step) => (step.run ? [step.run] : []))
const e2eRuns = (steps: Step[]) => runs(steps).filter((run) => run.includes('test:e2e'))
/** The steps before the test command: the local stack's setup. */
const setupOf = (steps: Step[]) =>
  steps.slice(
    0,
    steps.findIndex((step) => step.run?.includes('test:e2e')),
  )

type Project = NonNullable<PlaywrightTestConfig['projects']>[number]
let projects: Project[] = []
const project = (name: string): Project => {
  const found = projects.find((candidate) => candidate.name === name)
  if (found === undefined) throw new Error(`playwright.config.ts has no project "${name}"`)
  return found
}
const asList = (value: unknown): unknown[] =>
  value === undefined ? [] : Array.isArray(value) ? value : [value]

beforeAll(async () => {
  // The config reads the local stack through `supabase status` unless this is set.
  process.env.E2E_STACK_READY ??= '1'
  const config = (await import('../../playwright.config')).default as PlaywrightTestConfig
  projects = config.projects ?? []
})

describe('Playwright projects (decision 23)', () => {
  it('runs the bot API spec only in the bot-api project, on a desktop device', () => {
    const bot = project('bot-api')
    expect(bot.testMatch).toBe(BOT_SPEC)
    expect(bot.use).toMatchObject({ ...devices['Desktop Chrome'] })
  })

  it('keeps the bot API spec out of the desktop and mobile projects', () => {
    for (const name of ['desktop', 'mobile']) {
      expect(asList(project(name).testIgnore), name).toContain(BOT_SPEC)
    }
  })

  it('has exactly these three projects', () => {
    expect(projects.map((candidate) => candidate.name).sort()).toEqual([
      'bot-api',
      'desktop',
      'mobile',
    ])
  })
})

describe('ci.yml: the e2e and bot-contract jobs (owner Q2)', () => {
  it('runs on every pull request and every push to main', () => {
    expect(Object.keys(workflow.on).sort()).toEqual(['pull_request', 'push'])
    expect(workflow.on.pull_request ?? null).toBeNull()
  })

  it('the e2e job runs the desktop and mobile projects only', () => {
    expect(e2eRuns(job('e2e').steps)).toEqual(['pnpm test:e2e --project=desktop --project=mobile'])
    expect(runs(job('e2e').steps).join('\n')).not.toContain('bot-api')
  })

  it('the bot-contract job exists, always runs, and runs the bot-api project', () => {
    const bot = job('bot-contract')
    expect(bot.name).toBe('bot-contract')
    // Required check: no condition, no dependency that could skip it, never allowed to fail.
    expect(bot.if).toBeUndefined()
    expect(bot.needs).toBeUndefined()
    expect(bot['continue-on-error']).toBeUndefined()
    expect(e2eRuns(bot.steps)).toEqual(['pnpm test:e2e --project=bot-api'])
  })

  it('the bot-contract job sets up the same local stack as the e2e job', () => {
    expect(job('bot-contract')['runs-on']).toBe(job('e2e')['runs-on'])
    expect(setupOf(job('bot-contract').steps)).toEqual(setupOf(job('e2e').steps))
    expect(runs(setupOf(job('bot-contract').steps))).toContain('pnpm db:start')
  })

  it('uploads its own report on failure', () => {
    const upload = job('bot-contract').steps.find((step) =>
      step.uses?.startsWith('actions/upload-artifact'),
    )
    expect(upload?.if).toBe('failure()')
    expect(upload?.with).toMatchObject({ name: 'bot-contract-report' })
  })
})
