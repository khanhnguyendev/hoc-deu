import { Check } from 'lucide-react'
import { useId } from 'react'
import { vi } from '@/lib/i18n/vi'

/**
 * An exercise's or prompt's self-check criteria under "Tiêu chí". `lang` is the rubric's language
 * (`lang.rubric` in content, M3-R5): an English rubric gets `lang="en"`, a Vietnamese one keeps
 * the page's. `h2` by default; `h3` inside another section. Nothing for an empty rubric.
 */
function RubricList({
  items,
  lang = 'vi',
  headingLevel = 2,
}: {
  items: readonly string[]
  lang?: 'en' | 'vi'
  headingLevel?: 2 | 3
}) {
  const headingId = useId()
  if (items.length === 0) return null
  const Heading = `h${headingLevel}` as const
  return (
    <div data-slot="rubric-list" className="flex flex-col gap-2">
      <Heading id={headingId} className="text-base font-semibold">
        {vi.items.rubric}
      </Heading>
      <ul
        role="list"
        aria-labelledby={headingId}
        lang={lang === 'vi' ? undefined : lang}
        className="flex flex-col gap-2"
      >
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
