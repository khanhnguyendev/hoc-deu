import { formatDay, formatMinutes } from '@/lib/i18n/format'

/** "3 tháng 2, 2026: 45 phút" — the accessible name and hover title of a day. */
export function cellLabel(day: string, minutes: number): string {
  return `${formatDay(day)}: ${formatMinutes(minutes)}`
}
