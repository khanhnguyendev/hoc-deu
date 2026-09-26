import { fill, formatNumber } from '@/lib/i18n/format'
import { vi } from '@/lib/i18n/vi'
import type { TrackStats } from '../content'
import {
  HEAD_ROW,
  HEADER_CELL,
  NUMBER_CELL,
  ROW_HEADER_CELL,
  TABLE,
  TABLE_REGION,
  tableRow,
} from './table'

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
        <div
          role="region"
          tabIndex={0}
          aria-label={fill(copy.label, { track: stats.trackTitle })}
          className={TABLE_REGION}
        >
          <table className={TABLE}>
            <thead>
              <tr className={HEAD_ROW}>
                <th scope="col" className={HEADER_CELL}>
                  {copy.type}
                </th>
                <th scope="col" className={HEADER_CELL}>
                  {copy.active}
                </th>
                <th scope="col" className={HEADER_CELL}>
                  {copy.draft}
                </th>
                <th scope="col" className={HEADER_CELL}>
                  {copy.retired}
                </th>
              </tr>
            </thead>
            <tbody>
              {stats.rows.map((row) => (
                <tr key={row.type} className={tableRow()}>
                  <th scope="row" lang="en" className={ROW_HEADER_CELL}>
                    {row.label}
                  </th>
                  <td className={NUMBER_CELL}>{formatNumber(row.active)}</td>
                  <td className={NUMBER_CELL}>{formatNumber(row.draft)}</td>
                  <td className={NUMBER_CELL}>{formatNumber(row.retired)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
