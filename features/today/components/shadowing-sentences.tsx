import { useId } from 'react'
import { vi } from '@/lib/i18n/vi'
import type { ShadowingSentence } from '../slots'

const copy = vi.today.shadowing

/**
 * The shadowing block (§5.6): the example sentences of its cards, read aloud — English learning
 * content, so each is `lang="en"` (DESIGN_SYSTEM §4.3). No card with a sentence: says so.
 */
function ShadowingSentences({ sentences }: { sentences: readonly ShadowingSentence[] }) {
  const titleId = useId()
  if (sentences.length === 0) {
    return <p className="text-sm text-muted-foreground">{copy.empty}</p>
  }
  return (
    <div data-slot="shadowing-sentences" className="flex flex-col gap-2">
      <p id={titleId} className="text-sm font-medium text-muted-foreground">
        {copy.title}
      </p>
      <ol role="list" aria-labelledby={titleId} className="flex flex-col gap-2">
        {sentences.map((sentence) => (
          <li
            key={sentence.itemId}
            lang="en"
            className="rounded-md bg-surface-muted px-3 py-2 text-base leading-relaxed"
          >
            {sentence.text}
          </li>
        ))}
      </ol>
    </div>
  )
}

export { ShadowingSentences }
