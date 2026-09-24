/** Renders a track's weekly template and throttle rules as Vietnamese text (platform design §3.4). */
import { formatMinutes, formatNumber } from '@/lib/i18n/format'
import { vi } from '@/lib/i18n/vi'
import type { TemplateBlock, TrackManifest, WeeklyTemplate } from './schemas/manifest'

export type TemplateDay = { label: string; blocks: string[] }

/** Always this order, whatever the YAML's key order. */
const DAY_ORDER = ['mon-fri', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const

const PRACTICE_TAGS: Record<string, string> = vi.template.tags

/** Replaces every `{key}` placeholder in `template` with the matching value from `values`. */
function fill(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replaceAll(`{${key}}`, value),
    template,
  )
}

function practiceLabel(block: TemplateBlock): string {
  const key = block.tag ?? block.itemType
  if (key === undefined) return ''
  return PRACTICE_TAGS[key] ?? key
}

function describeBlock(block: TemplateBlock): string {
  switch (block.kind) {
    case 'review': {
      const max = block.maxMinutes
      const suffix =
        max === undefined ? '' : ` ${fill(vi.template.reviewMax, { n: formatNumber(max) })}`
      return `${vi.template.review}${suffix}`
    }
    case 'new':
      return vi.template.newItems
    case 'recap':
      return fill(vi.template.recap, { count: formatNumber(block.count ?? 0) })
    case 'practice': {
      const label = practiceLabel(block)
      const minutes = block.minutes === undefined ? '' : ` · ${formatMinutes(block.minutes)}`
      const fromWeek =
        block.fromWeek === undefined
          ? ''
          : ` ${fill(vi.template.fromWeek, { w: formatNumber(block.fromWeek) })}`
      return `${label}${minutes}${fromWeek}`
    }
  }
}

/**
 * The weekly template as Vietnamese day/block text, always in `mon-fri`, `mon`…`fri`, `sat`,
 * `sun` order — whatever order the manifest's YAML lists them in — and only the days present.
 */
export function describeWeeklyTemplate(template: WeeklyTemplate): TemplateDay[] {
  return DAY_ORDER.filter((day) => template[day] !== undefined).map((day) => ({
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
