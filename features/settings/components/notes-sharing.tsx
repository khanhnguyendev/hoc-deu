'use client'

import { useId, useState } from 'react'
import { Banner } from '@/components/patterns/banner'
import { Section } from '@/components/patterns/section'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { vi } from '@/lib/i18n/vi'
import type { SettingsAction } from '../schema'
import { failureOf, useSettingsAction } from './use-settings-action'

const copy = vi.notesSharing

type NotesSharingProps = {
  /** `SettingsData.user.aiPersonalization`: the section shows only while this is on (§4.5,
   *  §4.6) — a stale page could still submit while it is off, so the action also maps the
   *  database's own refusal to `copy.errors.aiOff`. */
  aiPersonalization: boolean
  /** `SettingsData.user.shareNotesWithAi`. */
  shareNotesWithAi: boolean
  /** The page's per-render UUID (decision 9). */
  requestId: string
  updateNotesSharing: SettingsAction
}

/**
 * "Chia sẻ ghi chú với bot AI" (§4.6, §6.3): a switch that saves as soon as it is flipped (no
 * separate "Lưu" button), the same immediate-run pattern as TrackSettings' pause/resume. Turning
 * the AI flag off later leaves the stored value as it is — the bot context reads it only for AI
 * users (task 6.4b) — so nothing here needs to change when `aiPersonalization` flips; the section
 * simply stops rendering until it is on again.
 */
function NotesSharing({
  aiPersonalization,
  shareNotesWithAi,
  requestId,
  updateNotesSharing,
}: NotesSharingProps) {
  const uid = useId()
  const [synced, setSynced] = useState(shareNotesWithAi)
  const [checked, setChecked] = useState(shareNotesWithAi)
  // The page re-rendered with the saved value (a successful save, or another tab): follow it.
  if (synced !== shareNotesWithAi) {
    setSynced(shareNotesWithAi)
    setChecked(shareNotesWithAi)
  }
  const { result, pending, run } = useSettingsAction(updateNotesSharing)
  const failure = failureOf(result)

  if (!aiPersonalization) return null

  const toggle = (next: boolean) => {
    setChecked(next)
    const data = new FormData()
    data.set('requestId', requestId)
    data.set('shareNotesWithAi', String(next))
    run(data)
  }

  return (
    <Section title={copy.title} description={copy.description}>
      <div data-slot="notes-sharing" className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <Switch id={uid} checked={checked} disabled={pending} onCheckedChange={toggle} />
          <Label htmlFor={uid}>{copy.title}</Label>
        </div>
        <div role="alert">{failure !== null && <Banner tone="danger">{failure}</Banner>}</div>
      </div>
    </Section>
  )
}

export { NotesSharing }
export type { NotesSharingProps }
