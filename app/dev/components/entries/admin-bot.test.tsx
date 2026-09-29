import { describe, expect, it } from 'vitest'
import { ADMIN_BOT_ENTRIES } from './admin-bot'

// Regression for e2e/app-shell.spec.ts "catalog width" and e2e/components.spec.ts "theme toggle
// on a phone" (both broke when this file's BotRunLog demos landed without it): the catalog lays
// entries out as unconstrained flex-row items (app/dev/components/catalog.tsx), so a demo whose
// component can be wider than the viewport (BotRunLog's DataTable) must opt into the row's full
// width — the same `w-full` wrapper every other DataTable/table-driven entry already uses (see
// admin.tsx's AdminOverview/AdminWarnings/CatalogStats/ContentCoverage/DraftsList entries and
// publish.tsx's PublishRequests entry) — otherwise the flex item shrink-wraps to the table's
// intrinsic width and the whole page scrolls sideways.
describe('ADMIN_BOT_ENTRIES catalog demos', () => {
  it('wraps every BotRunLog demo in a `w-full` container', () => {
    const entry = ADMIN_BOT_ENTRIES.find((candidate) => candidate.name === 'BotRunLog')
    expect(entry).toBeDefined()
    expect(entry!.demos.length).toBeGreaterThan(0)
    for (const demo of entry!.demos) {
      const element = demo.render() as { type: string; props: { className?: string } }
      expect(element.type, demo.title).toBe('div')
      expect(element.props.className, demo.title).toContain('w-full')
    }
  })
})
