/**
 * CLDR legacy IDs that ICU still reports (from `resolvedOptions()`) or accepts as input, mapped to
 * their current IANA name (decision 6, task 2.3). Observed on this machine's Node/ICU build:
 * `Intl.DateTimeFormat().resolvedOptions().timeZone` for `Asia/Ho_Chi_Minh` reports `Asia/Saigon`,
 * and `Intl.supportedValuesOf('timeZone')` omits `Asia/Ho_Chi_Minh` entirely.
 */
export const TIME_ZONE_ALIASES: Readonly<Record<string, string>> = {
  'Asia/Saigon': 'Asia/Ho_Chi_Minh',
  'Asia/Calcutta': 'Asia/Kolkata',
  'Asia/Katmandu': 'Asia/Kathmandu',
  'Asia/Rangoon': 'Asia/Yangon',
  'Europe/Kiev': 'Europe/Kyiv',
  'Atlantic/Faeroe': 'Atlantic/Faroe',
  'America/Godthab': 'America/Nuuk',
  'Pacific/Enderbury': 'Pacific/Kanton',
  'Pacific/Truk': 'Pacific/Chuuk',
  'Pacific/Ponape': 'Pacific/Pohnpei',
  'America/Buenos_Aires': 'America/Argentina/Buenos_Aires',
}

/** A legacy alias resolved to its current IANA name; any other identifier is returned unchanged. */
export function canonicalTimeZone(id: string): string {
  return TIME_ZONE_ALIASES[id] ?? id
}

/** Whether `Intl.DateTimeFormat` accepts `id` as a time zone. */
export function isValidTimeZone(id: string): boolean {
  try {
    Intl.DateTimeFormat('en-US', { timeZone: id })
    return true
  } catch {
    return false
  }
}

/** Sorted canonical IDs for pickers: `supportedValuesOf`, canonicalised, deduplicated, plus VN. */
export function timeZoneOptions(): readonly string[] {
  const canonical = new Set(Intl.supportedValuesOf('timeZone').map(canonicalTimeZone))
  canonical.add('Asia/Ho_Chi_Minh')
  return [...canonical].sort()
}
