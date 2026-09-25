import { vi } from '@/lib/i18n/vi'

const copy = vi.content.complexity

/** `<Complexity time space>` — time and space complexity as a description list, values in mono. */
function Complexity({ time, space }: { time: string; space: string }) {
  const rows = [
    { term: copy.time, value: time },
    { term: copy.space, value: space },
  ]
  return (
    <div
      role="group"
      aria-label={copy.title}
      data-slot="complexity"
      className="rounded-lg border border-border bg-surface p-4"
    >
      <dl className="flex flex-wrap gap-x-8 gap-y-2">
        {rows.map((row) => (
          <div key={row.term} className="flex items-baseline gap-2">
            <dt className="text-sm text-muted-foreground">{row.term}</dt>
            <dd className="font-mono font-medium">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

export { Complexity }
