import { beforeEach, describe, expect, it, vi } from 'vitest'

const fake = vi.hoisted(() => ({
  denied: null as Response | null,
  signalsAccess: vi.fn(),
  contentSignals: vi.fn(),
}))
vi.mock('@/lib/auth/bot', () => ({ requireBotToken: vi.fn(async () => fake.denied) }))
vi.mock('@/lib/bot/signals', () => ({
  signalsAccess: fake.signalsAccess,
  contentSignals: fake.contentSignals,
}))

const { GET } = await import('./route')

const RUN = 'run_2026-10-05'
const SIGNALS = {
  highFail: [
    { itemId: 'dsa:lc-0049', attempts: 14, failRate: 0.43, hintRate: 0.21, hasDeepDive: false },
  ],
  missing: [],
  englishGaps: [{ week: 4, extendedCards: 0 }],
  derivedDeckGaps: [],
  openProposals: ['dsa:lc-0049#note'],
}

const get = () =>
  new Request(`https://hocdeu.test/api/bot/v1/runs/${RUN}/content-signals`, {
    headers: { authorization: 'Bearer hdb_x' },
  })
const context = (runId = RUN) => ({ params: Promise.resolve({ runId }) })

beforeEach(() => {
  fake.denied = null
  fake.signalsAccess.mockReset()
  fake.signalsAccess.mockResolvedValue('ok')
  fake.contentSignals.mockReset()
  fake.contentSignals.mockResolvedValue(SIGNALS)
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('GET /api/bot/v1/runs/[runId]/content-signals (§6.4.7)', () => {
  it('answers the guard’s denial first and reads nothing', async () => {
    fake.denied = Response.json({ error: 'disabled' }, { status: 503 })
    const response = await GET(get(), context())
    expect(response.status).toBe(503)
    expect(fake.signalsAccess).not.toHaveBeenCalled()
    expect(fake.contentSignals).not.toHaveBeenCalled()
  })

  it('not today’s plan run → 404 not_found', async () => {
    fake.signalsAccess.mockResolvedValue('not_found')
    const response = await GET(get(), context('run_2026-10-04'))
    expect(fake.signalsAccess).toHaveBeenCalledWith('run_2026-10-04', expect.any(Date))
    expect(response.status).toBe(404)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await response.json()).toEqual({ error: 'not_found' })
    expect(fake.contentSignals).not.toHaveBeenCalled()
  })

  it('content proposals off → 409 content_proposals_off', async () => {
    fake.signalsAccess.mockResolvedValue('content_proposals_off')
    const response = await GET(get(), context())
    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({ error: 'content_proposals_off' })
    expect(fake.contentSignals).not.toHaveBeenCalled()
  })

  it('answers 200 with the signals, never cached', async () => {
    const response = await GET(get(), context())
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await response.json()).toEqual(SIGNALS)
  })

  it('a failure → 500 internal, logged by code only', async () => {
    fake.contentSignals.mockRejectedValue(new Error('secret detail', { cause: { code: '42501' } }))
    const response = await GET(get(), context())
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'internal' })
    const logged = vi.mocked(console.error).mock.calls.flat().join(' ')
    expect(logged).toContain('42501')
    expect(logged).not.toContain('secret detail')
  })
})
