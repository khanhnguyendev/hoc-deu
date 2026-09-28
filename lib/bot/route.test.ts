import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { BODY_LIMIT_BYTES, botError, botJson, readBody, readJson } from './route'

const schema = z.strictObject({ kind: z.enum(['plan', 'publish']).default('plan') })

const post = (body: BodyInit | null, headers: Record<string, string> = {}) =>
  new Request('https://hocdeu.test/api/bot/v1/runs', { method: 'POST', body, headers })

describe('botJson / botError (§6.4: JSON only, never cached)', () => {
  it('answers JSON with Cache-Control: no-store', async () => {
    const response = botJson(201, { ok: true })
    expect(response.status).toBe(201)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.get('content-type')).toMatch(/^application\/json/)
    expect(await response.json()).toEqual({ ok: true })
  })

  it('an error is { error } or { error, details }', async () => {
    expect(await botError(404, 'not_found').json()).toEqual({ error: 'not_found' })
    const withDetails = botError(422, 'invalid', [{ path: 'kind' }])
    expect(withDetails.headers.get('cache-control')).toBe('no-store')
    expect(await withDetails.json()).toEqual({ error: 'invalid', details: [{ path: 'kind' }] })
  })
})

describe('readJson (decision 38: 64 KB before parsing; 400 invalid_json; 422 invalid)', () => {
  it('parses a valid body with the schema (defaults applied)', async () => {
    await expect(readJson(post('{}'), schema)).resolves.toEqual({
      ok: true,
      data: { kind: 'plan' },
    })
  })

  it('answers 422 invalid with the issues as details', async () => {
    const result = await readJson(post('{"kind":"x","extra":1}'), schema)
    if (result.ok) throw new Error('expected a refusal')
    expect(result.response.status).toBe(422)
    expect(result.response.headers.get('cache-control')).toBe('no-store')
    const body = (await result.response.json()) as { error: string; details: unknown[] }
    expect(body.error).toBe('invalid')
    expect(body.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'kind' }),
        expect.objectContaining({ code: 'unrecognized_keys' }),
      ]),
    )
  })

  it.each([['not json'], [''], ['{"a":']])('answers 400 invalid_json for %j', async (text) => {
    const result = await readJson(post(text), schema)
    if (result.ok) throw new Error('expected a refusal')
    expect(result.response.status).toBe(400)
    expect(await result.response.json()).toEqual({ error: 'invalid_json' })
  })

  it('an empty body reads as the given default when the route allows one', async () => {
    await expect(readJson(post(null), schema, { empty: {} })).resolves.toEqual({
      ok: true,
      data: { kind: 'plan' },
    })
    await expect(readJson(post(''), schema, { empty: {} })).resolves.toEqual({
      ok: true,
      data: { kind: 'plan' },
    })
  })

  it('answers 413 too_large over 64 KB, before parsing', async () => {
    expect(BODY_LIMIT_BYTES).toBe(64 * 1024)
    const big = `{"kind":"plan","pad":"${'x'.repeat(65 * 1024)}"}`
    const result = await readJson(post(big), schema)
    if (result.ok) throw new Error('expected a refusal')
    expect(result.response.status).toBe(413)
    expect(await result.response.json()).toEqual({ error: 'too_large' })
  })

  it('refuses a declared Content-Length over the limit without reading the body', async () => {
    const request = post('{}', { 'content-length': String(BODY_LIMIT_BYTES + 1) })
    const result = await readBody(request)
    if (result.ok) throw new Error('expected a refusal')
    expect(result.response.status).toBe(413)
    expect(request.bodyUsed).toBe(false)
  })

  it('accepts a body of exactly 64 KB (multi-byte characters counted as bytes)', async () => {
    const prefix = '{"a":"'
    const suffix = '"}'
    const exact = `${prefix}${'x'.repeat(BODY_LIMIT_BYTES - prefix.length - suffix.length)}${suffix}`
    await expect(readBody(post(exact))).resolves.toMatchObject({ ok: true })
    const over = `${prefix}${'é'.repeat((BODY_LIMIT_BYTES - 6) / 2)}${suffix}`
    await expect(readBody(post(over))).resolves.toMatchObject({ ok: false })
  })
})
