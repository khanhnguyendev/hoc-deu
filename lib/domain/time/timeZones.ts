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

/**
 * `Intl.supportedValuesOf('timeZone')` is far more expensive than a `Set` lookup and never
 * changes within a process, so it is built at most once, lazily (M3 follow-up) — not a clock
 * read: its output depends only on the fixed ICU data of this process.
 */
let cachedOptions: Set<string> | null = null

function optionsSet(): Set<string> {
  if (cachedOptions === null) {
    const canonical = new Set(Intl.supportedValuesOf('timeZone').map(canonicalTimeZone))
    canonical.add('Asia/Ho_Chi_Minh')
    cachedOptions = canonical
  }
  return cachedOptions
}

/** Sorted canonical IDs for pickers: `supportedValuesOf`, canonicalised, deduplicated, plus VN. */
export function timeZoneOptions(): readonly string[] {
  return [...optionsSet()].sort()
}

/**
 * Whether `id` is exactly one of `timeZoneOptions()` — the only zones the server stores (M2 ruling
 * R17). Stricter than `isValidTimeZone`: `Intl` also accepts other capitalisations and aliases.
 * Canonicalise first (`canonicalTimeZone`).
 */
export function isTimeZoneOption(id: string): boolean {
  return optionsSet().has(id)
}
