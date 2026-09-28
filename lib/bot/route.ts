/**
 * What every bot route shares after `requireBotToken` (§6.4, Part B-M6 subagent contract): JSON
 * answers that are never cached, the `{ error, details? }` error form, and a bounded body read —
 * over 64 KB is `413 {"error":"too_large"}` before anything is parsed (decision 38), a body that
 * is not JSON `400 {"error":"invalid_json"}`, one the endpoint's strict Zod schema refuses `422
 * {"error":"invalid","details":[…]}`.
 */
import 'server-only'
import { z } from 'zod'

/** Decision 38. */
export const BODY_LIMIT_BYTES = 64 * 1024

/** A JSON answer with `Cache-Control: no-store`. */
export function botJson(status: number, body: unknown): Response {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

/** `{ error }`, or `{ error, details }` when details are given. */
export function botError(status: number, error: string, details?: unknown[]): Response {
  return botJson(status, details === undefined ? { error } : { error, details })
}

type Read<T> = { ok: true; data: T } | { ok: false; response: Response }

const tooLarge = (): Read<never> => ({ ok: false, response: botError(413, 'too_large') })

/** The body's bytes, stopping as soon as they pass the limit. Null: over the limit. */
async function boundedBytes(request: Request): Promise<Uint8Array | null> {
  if (request.body === null) return new Uint8Array()
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > BODY_LIMIT_BYTES) {
      await reader.cancel().catch(() => {})
      return null
    }
    chunks.push(value)
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return bytes
}

/**
 * The body as JSON, unvalidated: 413 over 64 KB (a declared `Content-Length` over it is refused
 * without reading), 400 when it is not UTF-8 JSON. Write routes hash this value (`idempotentWrite`).
 */
export type ReadOptions = {
  /** What an empty body reads as (`POST /runs`: `{}`); without it, empty is `invalid_json`. */
  empty?: unknown
}

export async function readBody(
  request: Request,
  options: ReadOptions = {},
): Promise<Read<unknown>> {
  const declared = Number(request.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > BODY_LIMIT_BYTES) return tooLarge()
  const bytes = await boundedBytes(request)
  if (bytes === null) return tooLarge()
  if (bytes.byteLength === 0 && options.empty !== undefined)
    return { ok: true, data: options.empty }
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    return { ok: true, data: JSON.parse(text) as unknown }
  } catch {
    return { ok: false, response: botError(400, 'invalid_json') }
  }
}

/** A Zod issue as a detail: where, which check, and Zod's own (English, technical) message. */
export function issueDetails(error: z.ZodError): { path: string; code: string; message: string }[] {
  return error.issues.map((issue) => ({
    path: issue.path.map(String).join('.'),
    code: issue.code,
    message: issue.message,
  }))
}

/** `readBody`, then the endpoint's schema: 422 `invalid` with the issues as details. */
export async function readJson<S extends z.ZodType>(
  request: Request,
  schema: S,
  options: ReadOptions = {},
): Promise<{ ok: true; data: z.infer<S> } | { ok: false; response: Response }> {
  const body = await readBody(request, options)
  if (!body.ok) return body
  const parsed = schema.safeParse(body.data)
  if (!parsed.success) {
    return { ok: false, response: botError(422, 'invalid', issueDetails(parsed.error)) }
  }
  return { ok: true, data: parsed.data }
}

/** A Postgres / PostgREST error code in the error's cause chain (`23505`, `PGRST116`, …). */
function causeCode(error: unknown): string | null {
  for (let current = error, depth = 0; current && depth < 5; depth += 1) {
    if (typeof current !== 'object') return null
    const { code, cause } = current as { code?: unknown; cause?: unknown }
    if (typeof code === 'string' && /^[A-Z0-9]{5,8}$/.test(code)) return code
    current = cause
  }
  return null
}

/**
 * `500 {"error":"internal"}` for an unexpected failure, logged as a code only — never a message,
 * a value or learner text (§6.7: M7's fallback logs are public).
 */
export function internalError(where: string, error: unknown): Response {
  const code = causeCode(error)
  console.error(`[bot] ${where} failed${code === null ? '' : ` (${code})`}`)
  return botError(500, 'internal')
}
