'use client'

import { useId, useState } from 'react'
import { Section } from '@/components/patterns/section'
import { SwitchField } from '@/components/patterns/switch-field'
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
 * separate "Lưu" button), the same immediate-run pattern as TrackSettings' pause/resume. A failed
 * save puts the switch back on the saved value, so it never shows a consent that was not stored.
 * Turning the AI flag off clears `share_notes_with_ai` too (decision 34, `admin_set_ai_flag`), and
 * the section stops rendering until the flag is on again — then it starts from "off".
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
  // A new answer: a failed save goes back to the saved value (a failed "off" is still shared).
  const [answered, setAnswered] = useState(result)
  if (answered !== result) {
    setAnswered(result)
    if (result?.ok === false) setChecked(shareNotesWithAi)
  }

  if (!aiPersonalization) return null

  const toggle = (next: boolean) => {
    setChecked(next)
    const data = new FormData()
    data.set('requestId', requestId)
    data.set('shareNotesWithAi', String(next))
    run(data)
  }

  return (
    <Section title={copy.title}>
      <div data-slot="notes-sharing">
        <SwitchField
          id={uid}
          label={copy.title}
          description={copy.description}
          error={failure}
          checked={checked}
          disabled={pending}
          pending={pending}
          onCheckedChange={toggle}
        />
      </div>
    </Section>
  )
}

export { NotesSharing }
export type { NotesSharingProps }
