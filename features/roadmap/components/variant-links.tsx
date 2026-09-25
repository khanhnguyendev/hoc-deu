import { cva } from 'class-variance-authority'
import { Check } from 'lucide-react'
import Link from 'next/link'
import { useId } from 'react'
import { vi } from '@/lib/i18n/vi'
import type { VariantLink } from '../queries'

const variantLink = cva(
  'inline-flex min-h-11 items-center gap-1.5 rounded-md border px-4 text-sm transition-colors duration-(--duration-fast) ease-standard [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      current: {
        true: 'border-primary bg-primary-soft font-semibold text-primary-soft-foreground',
        false: 'border-border-strong bg-surface font-medium text-foreground hover:bg-surface-muted',
      },
    },
  },
)

/**
 * The track's roadmap variants as links (`?variant=8w`), labelled with `variantLabel` ("8 tuần").
 * The current one carries `aria-current="true"`, a check and a heavier weight — never colour alone.
 */
function VariantLinks({ variants }: { variants: readonly VariantLink[] }) {
  const labelId = useId()
  return (
    <nav data-slot="variant-links" aria-labelledby={labelId} className="flex flex-col gap-2">
      <p id={labelId} className="text-sm font-medium text-muted-foreground">
        {vi.roadmap.variants}
      </p>
      <ul role="list" className="flex flex-wrap gap-2">
        {variants.map((variant) => (
          <li key={variant.id}>
            <Link
              href={variant.href}
              aria-current={variant.current ? 'true' : undefined}
              className={variantLink({ current: variant.current })}
            >
              {variant.current && <Check aria-hidden="true" strokeWidth={1.75} />}
              {variant.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export { VariantLinks }
