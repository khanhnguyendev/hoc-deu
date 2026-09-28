'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { itemPageHref } from '@/features/items/href'
import { requireOnboarded } from '@/lib/auth/dal'
import { CUSTOM_ITEM_ID_PATTERN } from '@/lib/bot/contract/custom-items'
import { EventError } from '@/lib/events/apply'
import { deriveEventId, digest } from '@/lib/events/ids'
import { hideUserItem } from '@/lib/events/user-items'
import { vi } from '@/lib/i18n/vi'
import { readUserItems } from '@/lib/plans/reads'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

const copy = vi.customItems.hide

/** What "Ẩn" answers its button (`useActionFeedback`). */
export type ActionResult = { readonly ok: boolean; readonly message: string }

const hideInputSchema = z.strictObject({
  requestId: z.uuid(),
  itemId: z.string().regex(CUSTOM_ITEM_ID_PATTERN),
})

/**
 * "Ẩn" on the track page's "Mục riêng" tab (§5.12 "the learner can hide any item"; takes effect
 * from the next plan, §5.9; task 6.6a): `requireOnboarded` first; the item must be one of the
 * learner's own (read through the session client — RLS); then `user_item.hidden` through
 * `apply_system_event` with the secret key (`source: 'system'`, the learner as the actor —
 * `hideUserItem`), its event id derived from the page's per-render `requestId` and a digest of
 * the input (decision 16: a double tap hides once). An item already hidden is `unchanged`, said
 * as such. Revalidates the track page and the item's page. An EventError becomes its Vietnamese
 * message; anything else reaches the error boundary.
 */
export async function hideCustomItem(input: {
  requestId: string
  itemId: string
}): Promise<ActionResult> {
  const user = await requireOnboarded()
  const parsed = hideInputSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: vi.errors.saveFailed }
  const { requestId, itemId } = parsed.data
  const rows = await readUserItems(await createClient(), user.id)
  const row = rows.find((candidate) => candidate.itemId === itemId)
  if (row === undefined) return { ok: false, message: copy.notFound }

  let outcome: 'applied' | 'unchanged'
  try {
    outcome = await hideUserItem(createAdminClient(), user.id, {
      eventId: deriveEventId(requestId, `user_item.hidden:${digest({ itemId })}`),
      itemId,
      itemType: row.itemType,
    })
  } catch (error) {
    if (!(error instanceof EventError)) throw error
    return { ok: false, message: error.userMessage }
  }
  revalidatePath(`/t/${row.trackId}`)
  revalidatePath(itemPageHref({ id: itemId, trackId: row.trackId }))
  return { ok: true, message: outcome === 'applied' ? copy.done : copy.already }
}
