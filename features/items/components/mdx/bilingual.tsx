import { vi as copy } from '@/lib/i18n/vi'

/**
 * `<Bilingual vi en>` — the one-line explanation in Vietnamese, then in English (`lang="en"`),
 * each under a visible label. A note's line becomes its "Explaining code" card (§3.5).
 */
function Bilingual({ vi, en }: { vi: string; en: string }) {
  const lines = [
    { label: copy.content.bilingual.vi, text: vi, lang: undefined },
    { label: copy.content.bilingual.en, text: en, lang: 'en' },
  ]
  return (
    <dl data-slot="bilingual" className="space-y-3 rounded-lg border border-border bg-surface p-4">
      {lines.map((line) => (
        <div key={line.label} className="space-y-1">
          <dt data-slot="bilingual-label" className="text-sm font-medium text-muted-foreground">
            {line.label}
          </dt>
          <dd lang={line.lang}>{line.text}</dd>
        </div>
      ))}
    </dl>
  )
}

export { Bilingual }
