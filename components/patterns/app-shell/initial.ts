const graphemes = new Intl.Segmenter('vi', { granularity: 'grapheme' })

/**
 * The avatar letter for a real (OAuth) name: the first grapheme of the given name, which comes
 * last in Vietnamese names ("Nguyễn Văn An" → "A"). NFC first, so decomposed input from macOS/iOS
 * keyboards yields one precomposed letter (RF-3); graphemes keep emoji and marks whole.
 * Returns null when there is no name.
 */
export function initial(name: string): string | null {
  const given = name.normalize('NFC').trim().split(/\s+/).at(-1) ?? ''
  const first = graphemes.segment(given)[Symbol.iterator]().next().value?.segment
  return first ? first.toLocaleUpperCase('vi-VN') : null
}
