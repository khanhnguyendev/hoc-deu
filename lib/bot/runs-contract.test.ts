import { describe, expect, it } from 'vitest'
import {
  planRunResponse,
  runFinishRequest,
  runKeySchema,
  runStartRequest,
  userRefSchema,
} from './contract/runs'

describe('the runs contract (§6.4.1, §6.4.6)', () => {
  it('defaults kind to plan and refuses unknown keys and modes', () => {
    expect(runStartRequest.parse({})).toEqual({ kind: 'plan' })
    expect(runStartRequest.parse({ kind: 'publish', requestedMode: 'dry_run' })).toEqual({
      kind: 'publish',
      requestedMode: 'dry_run',
    })
    expect(runStartRequest.safeParse({ kind: 'plan', extra: 1 }).success).toBe(false)
    expect(runStartRequest.safeParse({ requestedMode: 'turbo' }).success).toBe(false)
  })

  it('run keys and user refs follow the tables’ checks', () => {
    for (const key of ['run_2026-10-05', 'run_2026-10-05_publish-1', 'run_2026-10-05_publish-999'])
      expect(runKeySchema.safeParse(key).success).toBe(true)
    for (const key of [
      'run_2026-10-5',
      'run_2026-10-05_publish-0',
      'run_2026-10-05_publish-1000',
      'x',
    ])
      expect(runKeySchema.safeParse(key).success).toBe(false)
    expect(userRefSchema.safeParse(`u_${'a2'.repeat(8)}`).success).toBe(true)
    expect(userRefSchema.safeParse(`u_${'A'.repeat(16)}`).success).toBe(false)
    expect(userRefSchema.safeParse(`u_${'1'.repeat(16)}`).success).toBe(false)
  })

  it('a plan response is strict', () => {
    const body = {
      runId: 'run_2026-10-05',
      mode: 'live',
      catalogVersion: 'c9f2aa00c9f2aa00',
      rulesVersion: 3,
      contentProposals: true,
      users: [],
      deferredUsers: 0,
    }
    expect(planRunResponse.parse(body)).toEqual(body)
    expect(planRunResponse.safeParse({ ...body, userIds: [] }).success).toBe(false)
  })

  it('a finish takes the repository’s PR URLs only and at most 100 request ids', () => {
    const ok = {
      status: 'completed',
      summary: '10 users: 7 plans, 4 custom-item sets, 2 overrides; PR #41',
      contentPrUrl: 'https://github.com/khanhnguyendev/hoc-deu/pull/41',
      publishRequestIds: [17],
    }
    expect(runFinishRequest.parse(ok)).toEqual(ok)
    for (const url of [
      'https://github.com/someone/hoc-deu/pull/41',
      'https://github.com/khanhnguyendev/hoc-deu/pull/0',
      'http://github.com/khanhnguyendev/hoc-deu/pull/41',
    ]) {
      expect(runFinishRequest.safeParse({ ...ok, contentPrUrl: url }).success).toBe(false)
    }
    const many = Array.from({ length: 101 }, (_, index) => index + 1)
    expect(runFinishRequest.safeParse({ ...ok, publishRequestIds: many }).success).toBe(false)
    expect(runFinishRequest.safeParse({ status: 'running' }).success).toBe(false)
  })

  it('a summary holds counts only: no ref, address, URL, markup or control character', () => {
    for (const summary of [
      `u_${'abcdefgh'.repeat(2)} failed`,
      'mail me: someone@example.com',
      'see https://example.com',
      'see www.example.com',
      '<b>10</b> users',
      'line\nbreak',
      'x'.repeat(501),
    ]) {
      expect(runFinishRequest.safeParse({ status: 'failed', summary }).success, summary).toBe(false)
    }
    expect(
      runFinishRequest.safeParse({ status: 'failed', summary: '3 users: 1 invalid' }).success,
    ).toBe(true)
  })
})
