import { Check } from 'lucide-react'
import { useId } from 'react'
import { vi } from '@/lib/i18n/vi'

/**
 * An exercise's or prompt's self-check criteria under "Tiêu chí". `lang="en"` when the criteria
 * are English (exercises); nothing for an empty rubric.
 */
function RubricList({ items, lang }: { items: readonly string[]; lang?: 'en' }) {
  const headingId = useId()
  if (items.length === 0) return null
  return (
    <div data-slot="rubric-list" className="flex flex-col gap-2">
      <h2 id={headingId} className="text-base font-semibold">
        {vi.items.rubric}
      </h2>
      <ul role="list" aria-labelledby={headingId} lang={lang} className="flex flex-col gap-2">
        {items.map((item, index) => (
          // Criteria are an ordered list and may repeat: position is their identity.
          <li key={index} className="flex items-start gap-2">
            <Check
              aria-hidden="true"
              strokeWidth={1.75}
              className="mt-1 size-4 shrink-0 text-muted-foreground"
            />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export { RubricList }
