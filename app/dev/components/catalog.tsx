'use client'

import { ThemeToggle } from '@/components/patterns/theme-toggle'
import { Badge } from '@/components/ui/badge'
import { Toaster } from '@/components/ui/toaster'
import { TooltipProvider } from '@/components/ui/tooltip'
import { vi } from '@/lib/i18n/vi'
import { HydrationMarker } from '../hydration-marker'
import { CATALOG } from './registry'

const slug = (name: string) => name.toLowerCase()

/** Two panes: the entry list and every entry's demos (DESIGN_SYSTEM §5). */
export function Catalog() {
  return (
    <TooltipProvider>
      <HydrationMarker />
      <div className="mx-auto flex w-full max-w-app flex-col gap-8 px-4 py-6 md:px-6 lg:flex-row lg:px-8">
        <nav
          aria-label={vi.dev.catalogNav}
          className="lg:sticky lg:top-6 lg:h-fit lg:w-56 lg:shrink-0"
        >
          <ul role="list" className="flex flex-wrap gap-1 lg:flex-col">
            {CATALOG.map((entry) => (
              <li key={entry.name}>
                <a
                  href={`#${slug(entry.name)}`}
                  className="flex min-h-11 items-center rounded-md px-3 text-sm text-muted-foreground hover:bg-surface-muted hover:text-foreground"
                >
                  {entry.name}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex min-w-0 flex-1 flex-col gap-10">
          <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <h1 className="text-2xl font-semibold md:text-3xl">{vi.dev.catalogTitle}</h1>
            <ThemeToggle />
          </header>
          {CATALOG.map((entry) => (
            <section
              key={entry.name}
              id={slug(entry.name)}
              aria-labelledby={`${slug(entry.name)}-title`}
              className="flex scroll-mt-6 flex-col gap-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <h2 id={`${slug(entry.name)}-title`} className="text-xl font-semibold">
                  {entry.name}
                </h2>
                <Badge tone="outline">{entry.layer}</Badge>
                <code className="font-mono text-xs text-muted-foreground">{entry.file}</code>
              </div>
              {entry.demos.map((demo) => (
                <div key={demo.title} className="flex flex-col gap-2">
                  <h3 className="text-sm font-medium text-muted-foreground">{demo.title}</h3>
                  <div className="flex flex-wrap items-start gap-3 rounded-lg border border-border bg-background p-4">
                    {demo.render()}
                  </div>
                </div>
              ))}
            </section>
          ))}
        </div>
      </div>
      <Toaster />
    </TooltipProvider>
  )
}
