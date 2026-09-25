'use client'

import { Eye, EyeOff } from 'lucide-react'
import { useId, useRef, useState } from 'react'
import { CodeBlock } from '@/components/patterns/code-block'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { HighlightedCode } from '@/lib/content/code-tokens'
import type { CodeLanguage } from '@/lib/content/schemas/common'
import { vi } from '@/lib/i18n/vi'
import { fill } from './copy'

const copy = vi.content.solution

/** Tab order (DESIGN_SYSTEM §9): Python, Java, Go — only the languages present. */
const ORDER: readonly CodeLanguage[] = ['python', 'java', 'go']

/**
 * A problem's solutions (`<Solution />` in a note): hidden behind "Xem lời giải" (DESIGN_SYSTEM
 * §9) — no code in the DOM until then — then Python / Java / Go tabs of build-time highlighted
 * `CodeBlock`s, opening on the viewer's language when present. `onReveal` fires on the first
 * reveal only (task 5.2 preselects "Cần gợi ý" with it).
 */
function SolutionTabs({
  solutions,
  defaultLanguage,
  onReveal,
}: {
  solutions: Partial<Record<CodeLanguage, HighlightedCode>>
  defaultLanguage: CodeLanguage
  onReveal?: () => void
}) {
  const [open, setOpen] = useState(false)
  const revealed = useRef(false)
  const panelId = useId()
  const languages = ORDER.filter((language) => solutions[language] !== undefined)
  if (languages.length === 0) return null
  const initial = languages.includes(defaultLanguage) ? defaultLanguage : languages[0]

  const toggle = () => {
    if (!open && !revealed.current) {
      revealed.current = true
      onReveal?.()
    }
    setOpen(!open)
  }

  return (
    <div data-slot="solution-tabs" className="space-y-3">
      <Button variant="outline" aria-expanded={open} aria-controls={panelId} onClick={toggle}>
        {open ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
        {open ? copy.hide : copy.show}
      </Button>
      <div id={panelId}>
        {open && (
          <Tabs defaultValue={initial}>
            <TabsList aria-label={copy.tabs}>
              {languages.map((language) => (
                <TabsTrigger key={language} value={language}>
                  {vi.content.languages[language]}
                </TabsTrigger>
              ))}
            </TabsList>
            {languages.map((language) => (
              <TabsContent key={language} value={language}>
                <CodeBlock
                  code={solutions[language]!}
                  label={fill(copy.label, { language: vi.content.languages[language] })}
                />
              </TabsContent>
            ))}
          </Tabs>
        )}
      </div>
    </div>
  )
}

export { SolutionTabs }
