/** Renders a track's weekly template and throttle rules as Vietnamese text (platform design §3.4). */
import { formatMinutes, formatNumber } from '@/lib/i18n/format'
import { vi } from '@/lib/i18n/vi'
import {
  WEEKDAY_KEYS,
  type TemplateBlock,
  type TrackManifest,
  type WeeklyTemplate,
} from './schemas/manifest'

export type TemplateDay = { label: string; blocks: string[] }

const PRACTICE_TAGS: Record<string, string> = vi.template.tags

/** Replaces every `{key}` placeholder in `template` with the matching value from `values`. */
function fill(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replaceAll(`{${key}}`, value),
    template,
  )
}

function blockText(block: TemplateBlock): string {
  switch (block.kind) {
    case 'review':
      return block.maxMinutes === undefined
        ? vi.template.review
        : `${vi.template.review} ${fill(vi.template.reviewMax, { n: formatNumber(block.maxMinutes) })}`
    case 'new':
      return vi.template.newItems
    case 'recap':
      return fill(vi.template.recap, { count: formatNumber(block.count) })
    case 'practice': {
      // The schema requires exactly one of `tag` / `itemType`.
      const key = block.tag ?? block.itemType ?? ''
      return `${PRACTICE_TAGS[key] ?? key} · ${formatMinutes(block.minutes)}`
    }
  }
}

/** A block as text, with `(từ tuần n)` when it starts from a roadmap week (§3.4 `fromWeek`). */
function describeBlock(block: TemplateBlock): string {
  const text = blockText(block)
  return block.fromWeek === undefined
    ? text
    : `${text} ${fill(vi.template.fromWeek, { w: formatNumber(block.fromWeek) })}`
}

/**
 * The weekly template as Vietnamese day/block text, always in `mon-fri`, `mon`…`fri`, `sat`,
 * `sun` order — whatever order the manifest's YAML lists them in — and only the days present.
 */
export function describeWeeklyTemplate(template: WeeklyTemplate): TemplateDay[] {
  return WEEKDAY_KEYS.filter((day) => template[day] !== undefined).map((day) => ({
    label: vi.template.days[day],
    blocks: (template[day] ?? []).map(describeBlock),
  }))
}

/**
 * The track's new-item throttle as Vietnamese lines: the flat `newPerDay` cap (if any) first,
 * then each `throttle` rule — `[]` for a track with neither (e.g. DSA).
 */
export function describeThrottle(defaults: TrackManifest['defaults']): string[] {
  const lines: string[] = []
  if (defaults.newPerDay !== null) {
    lines.push(fill(vi.template.throttle.newPerDay, { n: formatNumber(defaults.newPerDay) }))
  }
  for (const rule of defaults.throttle) {
    const dueAbove = formatNumber(rule.dueAbove)
    lines.push(
      rule.newPerDay === 0
        ? fill(vi.template.throttle.paused, { dueAbove })
        : fill(vi.template.throttle.rule, { dueAbove, n: formatNumber(rule.newPerDay) }),
    )
  }
  return lines
}
