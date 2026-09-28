/**
 * `PUT /runs/{runId}/users/{userRef}/custom-items` (platform design §5.12, §6.4.4; Part B-M6
 * decisions 6, 10–12, 17, 17a, 33; task 6.6a): the write `idempotentWrite` runs for kind
 * `custom-items`, so an invalid answer is counted and never binds the key.
 *
 * In order: the AI flag still on (else `409 {"error":"ai_off"}`, not recorded); the body
 * (`customItemsRequest`); the learner's day (`loadDay` with the secret key — every read filters
 * `user_id`); then every item and retirement is checked and **every** issue collected — the track
 * one of the learner's active tracks, the type one of the three and in the track's `itemTypes`
 * (DSA has no exercises, §6.10), the topic in the track, the slug free (the same slug with the
 * same item again is a no-op), the payload by the repository's schema (`parseCustomPayload`,
 * decision 17a), every string plain text, the stored payload within 2 KB, the per-day and active
 * quotas (`effectiveLimits`, counted here for a precise detail — SQL enforces them again under
 * its lock), and only the learner's own IDs retired. **All or nothing:** any issue is `invalid`
 * with `details` and nothing is written. A dry run stores the proposal in
 * `bot_run_users.detail['custom-items']` and writes nothing else (decision 11). A live run
 * retires, then creates (`lib/events/user-items.ts`), each under its own event id
 * `deriveEventId(<run uuid>, '<ref>:custom-items:<slug>')` / `'…:retire:<itemId>'`, so a retry
 * after a crash is a `duplicate`. Server-only; nothing a learner wrote is logged.
 */
import 'server-only'
import { issueDetails } from './route'
import type { RunUser } from './runs'
import type { WriteOutcome } from './writes'
import { readBotSettings } from './settings'
import {
  customItemsRequest,
  type CustomItemInput,
  type CustomItemsRequest,
  type CustomItemsResponse,
} from '@/lib/bot/contract/custom-items'
import { canonicalJson } from '@/lib/canonical-json'
import { getTrack } from '@/lib/content/catalog'
import {
  customItemId,
  isPlainText,
  jsonbTextBytes,
  MAX_PAYLOAD_BYTES,
  parseCustomPayload,
  stringsOf,
  type UserItemRow,
} from '@/lib/content/user-items'
import { trackProgressOf } from '@/lib/domain/plan/trackProgress'
import { EventError } from '@/lib/events/apply'
import { deriveEventId } from '@/lib/events/ids'
import { createUserItem, retireUserItem } from '@/lib/events/user-items'
import { loadDay, type Day } from '@/lib/plans/day'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Json } from '@/lib/supabase/database.types'

export const KIND = 'custom-items'

/** Decision 11: a dry-run proposal is at most 16 KB as JSON. */
export const PROPOSAL_BYTES = 16 * 1024

export type Detail = {
  readonly path: string
  readonly code: string
  readonly message: string
  readonly [key: string]: unknown
}

/** An answer with an outcome is recorded by `idempotentWrite`; `409 ai_off` has none. */
export type CustomItemsAnswer = {
  status: number
  body: CustomItemsResponse | { error: string }
  outcome?: WriteOutcome
}

const invalid = (details: readonly Detail[]): CustomItemsAnswer => ({
  status: 422,
  body: { outcome: 'invalid', created: [], retired: [], details: [...details] },
  outcome: 'invalid',
})

type Admin = ReturnType<typeof createAdminClient>

/** An item that passed every check: to create, or already there (the same slug and item). */
type Checked = {
  readonly input: CustomItemInput
  readonly itemId: string
  readonly payload: Record<string, unknown>
  readonly unchanged: boolean
}

type ProfileRow = { ai_personalization: boolean; bot_ref: string }

async function readProfile(admin: Admin, userId: string): Promise<ProfileRow> {
  const { data, error } = await admin
    .from('profiles')
    .select('ai_personalization, bot_ref')
    .eq('id', userId)
    .single()
  if (error || !data) throw new Error("Could not read the learner's profile", { cause: error })
  return data
}

/** The `user_item.created` events of the learner's local day `today` (the per-day quota). */
async function createdToday(admin: Admin, userId: string, today: string): Promise<number> {
  const { count, error } = await admin
    .from('events')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('type', 'user_item.created')
    .eq('local_day', today)
  if (error) throw new Error("Could not count today's custom items", { cause: error })
  return count ?? 0
}

/** The stored payload with a changed `week` ignored: the week is the server's, taken at creation. */
const sameItem = (row: UserItemRow, input: CustomItemInput, payload: Record<string, unknown>) =>
  row.itemType === input.type &&
  row.trackId === input.trackId &&
  row.topicId === input.topicId &&
  canonicalJson({ ...(row.payload as object), week: null }) ===
    canonicalJson({ ...payload, week: null })

/** Every check of one item (§6.4.4); its issues, or the item to write. */
function checkItem(
  input: CustomItemInput,
  index: number,
  day: Day,
  botRef: string,
): { issues: Detail[]; item: Checked | null } {
  const at = `items.${index}`
  const issues: Detail[] = []
  const issue = (path: string, code: string, message: string) =>
    issues.push({ path: `${at}${path}`, code, message, slug: input.slug })

  const manifest = getTrack(input.trackId)
  const enrollment = day.enrollments.find(
    (candidate) => candidate.trackId === input.trackId && candidate.status === 'active',
  )
  if (manifest === null || enrollment === undefined) {
    issue('.trackId', 'not_enrolled', 'the track is not one of the learner’s active tracks')
    return { issues, item: null }
  }
  if (!(manifest.itemTypes as readonly string[]).includes(input.type)) {
    issue('.type', 'type_not_in_track', `the track does not list ${input.type} in its itemTypes`)
  }
  if (!manifest.topics.some((topic) => topic.id === input.topicId)) {
    issue('.topicId', 'unknown_topic', 'the topic is not in the track')
  }
  for (const text of stringsOf(input.payload)) {
    if (!isPlainText(text.value)) {
      issue(
        `.payload.${text.path}`,
        'not_plain_text',
        'plain text only: no markup, URL or control character',
      )
    }
  }
  const week = trackProgressOf(day.catalog, input.trackId, enrollment.variant, day.items).week
  const parsed = parseCustomPayload(input.type, input.payload, {
    trackId: input.trackId,
    topicId: input.topicId,
    week,
  })
  if (!parsed.ok) {
    for (const message of parsed.issues) issue('.payload', 'invalid_payload', message)
  } else if (jsonbTextBytes(parsed.payload) > MAX_PAYLOAD_BYTES) {
    issue('.payload', 'too_large', `the item is over ${MAX_PAYLOAD_BYTES} bytes`)
  }
  if (issues.length > 0 || !parsed.ok) return { issues, item: null }

  const itemId = customItemId(botRef, input.slug)
  const existing = day.userItems.find((row) => row.itemId === itemId)
  if (existing !== undefined && !sameItem(existing, input, parsed.payload)) {
    issue('.slug', 'slug_taken', 'the slug is in use by another item (retire it, use a new slug)')
    return { issues, item: null }
  }
  return {
    issues,
    item: { input, itemId, payload: parsed.payload, unchanged: existing !== undefined },
  }
}

/** What the request would do, or every reason it cannot (all or nothing). */
async function plan(
  admin: Admin,
  runUser: RunUser,
  request: CustomItemsRequest,
  day: Day,
  botRef: string,
  limits: { perDay: number; active: number },
): Promise<{ details: Detail[] } | { items: Checked[]; retire: UserItemRow[] }> {
  const details: Detail[] = []
  const items: Checked[] = []
  const slugs = new Set<string>()
  request.items.forEach((input, index) => {
    if (slugs.has(input.slug)) {
      details.push({
        path: `items.${index}.slug`,
        code: 'duplicate_slug',
        message: 'the slug is listed twice',
        slug: input.slug,
      })
      return
    }
    slugs.add(input.slug)
    const checked = checkItem(input, index, day, botRef)
    details.push(...checked.issues)
    if (checked.item !== null) items.push(checked.item)
  })

  const retire: UserItemRow[] = []
  const retiring = new Set<string>()
  request.retire.forEach((itemId, index) => {
    const row = day.userItems.find((candidate) => candidate.itemId === itemId)
    if (row === undefined) {
      details.push({
        path: `retire.${index}`,
        code: 'not_own_item',
        message: 'not one of the learner’s custom items',
        itemId,
      })
    } else if (!retiring.has(itemId)) {
      retiring.add(itemId)
      retire.push(row)
    }
  })
  for (const item of items) {
    if (retiring.has(item.itemId)) {
      details.push({
        path: 'retire',
        code: 'retire_and_create',
        message: 'an item cannot be created and retired in one request',
        itemId: item.itemId,
      })
    }
  }

  // The quotas (decision 33), as SQL counts them: new items of the local day, and active items
  // after this request's retirements (they run first).
  const fresh = items.filter((item) => !item.unchanged).length
  if (fresh > 0) {
    const today = await createdToday(admin, runUser.userId, day.today)
    if (today + fresh > limits.perDay) {
      details.push({
        path: 'items',
        code: 'limit_reached',
        message: `at most ${limits.perDay} new custom items a day`,
        limit: limits.perDay,
        count: today + fresh,
      })
    }
    const active =
      day.userItems.filter((row) => row.status === 'active').length -
      retire.filter((row) => row.status === 'active').length
    if (active + fresh > limits.active) {
      details.push({
        path: 'items',
        code: 'limit_reached',
        message: `at most ${limits.active} active custom items`,
        limit: limits.active,
        count: active + fresh,
      })
    }
  }
  return details.length > 0 ? { details } : { items, retire }
}

/**
 * Decision 11: the proposal in `bot_run_users.detail['custom-items']` (its other keys — the
 * invalid attempts — kept), at most `PROPOSAL_BYTES`: past that, the payloads are left out.
 */
async function recordProposal(admin: Admin, runUser: RunUser, request: CustomItemsRequest) {
  const full: Json = request as unknown as Json
  const proposal =
    Buffer.byteLength(canonicalJson(full), 'utf8') <= PROPOSAL_BYTES
      ? full
      : ({
          items: request.items.map(({ slug, type, trackId, topicId }) => ({
            slug,
            type,
            trackId,
            topicId,
          })),
          retire: request.retire,
          payloadsOmitted: true,
        } as unknown as Json)
  const current = await admin
    .from('bot_run_users')
    .select('detail')
    .eq('id', runUser.runUserId)
    .single()
  if (current.error) throw new Error('Could not read the run detail', { cause: current.error })
  const detail =
    current.data.detail !== null &&
    typeof current.data.detail === 'object' &&
    !Array.isArray(current.data.detail)
      ? current.data.detail
      : {}
  const own = detail[KIND]
  const entry =
    own !== null && typeof own === 'object' && !Array.isArray(own)
      ? { ...own, proposal }
      : { proposal }
  const updated = await admin
    .from('bot_run_users')
    .update({ detail: { ...detail, [KIND]: entry } })
    .eq('id', runUser.runUserId)
  if (updated.error) throw new Error('Could not record the proposal', { cause: updated.error })
}

/** A database refusal of one write: the answer, or null to rethrow. */
function refused(error: unknown, path: string): CustomItemsAnswer | null {
  if (!(error instanceof EventError)) return null
  if (error.code === 'ai_off') return { status: 409, body: { error: 'ai_off' } }
  if (error.code === 'day_changed') {
    return invalid([
      {
        path,
        code: 'day_changed',
        message: "the learner's day changed during the request; retry it",
        retryable: true,
      },
    ])
  }
  if (['slug_taken', 'limit_reached', 'not_enrolled', 'invalid_transition'].includes(error.code)) {
    return invalid([{ path, code: error.code, message: 'refused by the database' }])
  }
  return null
}

/** The write `idempotentWrite` runs (the route's). */
export async function writeCustomItems(
  runUser: RunUser,
  body: unknown,
  now: Date,
): Promise<CustomItemsAnswer> {
  const admin = createAdminClient()
  const profile = await readProfile(admin, runUser.userId)
  // §5.12: no new custom items once the AI flag is off (SQL refuses them too).
  if (!profile.ai_personalization) return { status: 409, body: { error: 'ai_off' } }

  const parsed = customItemsRequest.safeParse(body)
  if (!parsed.success) return invalid(issueDetails(parsed.error))
  const request = parsed.data

  const { settings } = await readBotSettings()
  const limits = {
    perDay: settings.limits.customItemsPerDay,
    active: settings.limits.customItemsActive,
  }
  const day = await loadDay(admin, runUser.userId, now)
  const checked = await plan(admin, runUser, request, day, profile.bot_ref, limits)
  if ('details' in checked) return invalid(checked.details)

  const created = checked.items.map((item) => item.itemId)
  const retired = checked.retire.map((row) => row.itemId)
  if (runUser.mode === 'dry_run') {
    await recordProposal(admin, runUser, request)
    return { status: 200, body: { outcome: 'dry_run', created, retired }, outcome: 'dry_run' }
  }

  for (const row of checked.retire) {
    try {
      await retireUserItem(admin, runUser.userId, {
        eventId: deriveEventId(runUser.runUuid, `${runUser.userRef}:${KIND}:retire:${row.itemId}`),
        itemId: row.itemId,
        itemType: row.itemType,
        localDay: day.today,
      })
    } catch (error) {
      const answer = refused(error, 'retire')
      if (answer === null) throw error
      return answer
    }
  }
  for (const item of checked.items) {
    if (item.unchanged) continue
    try {
      await createUserItem(admin, runUser.userId, {
        eventId: deriveEventId(runUser.runUuid, `${runUser.userRef}:${KIND}:${item.input.slug}`),
        runKey: runUser.runKey,
        itemId: item.itemId,
        slug: item.input.slug,
        itemType: item.input.type,
        trackId: item.input.trackId,
        topicId: item.input.topicId,
        payload: item.payload,
        localDay: day.today,
        limits,
      })
    } catch (error) {
      const answer = refused(error, `items.${request.items.indexOf(item.input)}`)
      if (answer === null) throw error
      return answer
    }
  }
  return { status: 200, body: { outcome: 'applied', created, retired }, outcome: 'applied' }
}
