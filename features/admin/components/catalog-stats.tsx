import {
  DataTable,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
  DataTableRowHeader,
} from '@/components/patterns/data-table'
import { fill, formatNumber } from '@/lib/i18n/format'
import { vi } from '@/lib/i18n/vi'
import type { TrackStats } from '../content'

const copy = vi.adminOverview.content.stats

/**
 * A track's catalog stats on `/admin/content` (§2.4): its items by type (the types the track
 * lists) and status, and — for a track with problems — the notes' verification (§3.7: tested,
 * compile-only, no note). A track without items says so instead of a table of zeros.
 */
function CatalogStats({ stats }: { stats: TrackStats }) {
  return (
    <div data-slot="catalog-stats" className="flex flex-col gap-3">
      <h3 className="text-lg font-semibold">{copy.title}</h3>
      {stats.total === 0 ? (
        <p className="text-sm text-muted-foreground">{copy.empty}</p>
      ) : (
        <DataTable label={fill(copy.label, { track: stats.trackTitle })}>
          <DataTableHead>
            <DataTableHeader>{copy.type}</DataTableHeader>
            <DataTableHeader>{copy.active}</DataTableHeader>
            <DataTableHeader>{copy.draft}</DataTableHeader>
            <DataTableHeader>{copy.retired}</DataTableHeader>
          </DataTableHead>
          <tbody>
            {stats.rows.map((row) => (
              <DataTableRow key={row.type}>
                <DataTableRowHeader lang="en">{row.label}</DataTableRowHeader>
                <DataTableCell numeric>{formatNumber(row.active)}</DataTableCell>
                <DataTableCell numeric>{formatNumber(row.draft)}</DataTableCell>
                <DataTableCell numeric>{formatNumber(row.retired)}</DataTableCell>
              </DataTableRow>
            ))}
          </tbody>
        </DataTable>
      )}
      {stats.verification && (
        <p data-slot="verification" className="text-sm text-muted-foreground">
          {fill(copy.verification, {
            tested: formatNumber(stats.verification.tested),
            compileOnly: formatNumber(stats.verification.compileOnly),
            noNote: formatNumber(stats.verification.noNote),
          })}
        </p>
      )}
    </div>
  )
}

export { CatalogStats }
