import { describe, expect, it } from 'vitest'
import { loadTrackOptions } from './track-options'

describe('loadTrackOptions (real manifests)', () => {
  it('lists both active tracks, in manifest order, with their Vietnamese titles and accents', () => {
    const options = loadTrackOptions()
    expect(options.map(({ id, title, accent }) => ({ id, title, accent }))).toEqual([
      { id: 'dsa', title: 'Cấu trúc dữ liệu & Giải thuật', accent: 'track-1' },
      { id: 'english', title: 'Tiếng Anh cho môi trường IT', accent: 'track-2' },
    ])
  })

  it('carries the default budget and the roadmaps (DSA: 8w below 75 min/day, then 10w)', () => {
    const [dsa, english] = loadTrackOptions()
    expect(dsa?.defaultBudgetMinutes).toBe(60)
    expect(dsa?.roadmaps).toEqual([{ id: '8w', recommendedBelowMinutes: 75 }, { id: '10w' }])
    expect(english?.defaultBudgetMinutes).toBe(25)
    expect(english?.roadmaps).toEqual([{ id: '10w' }])
  })

  it('offers Python, Java and Go for DSA and no code language for English', () => {
    const [dsa, english] = loadTrackOptions()
    expect(dsa?.codeLanguages).toEqual(['python', 'java', 'go'])
    expect(english?.codeLanguages).toEqual([])
  })

  it('describes the weekly template as text and the English throttle as lines', () => {
    const [dsa, english] = loadTrackOptions()
    expect(dsa?.template.map((day) => day.label)).toEqual(['Thứ 2 – Thứ 6', 'Thứ 7', 'Chủ nhật'])
    expect(dsa?.throttle).toEqual([])
    expect(english?.throttle).toEqual([
      'Tối đa 8 thẻ mới mỗi ngày',
      'Trên 40 thẻ cần ôn: 4 thẻ mới mỗi ngày',
      'Trên 60 thẻ cần ôn: tạm dừng thẻ mới',
    ])
  })

  it('returns plain, serialisable data (it crosses to a client component as props)', () => {
    const options = loadTrackOptions()
    expect(JSON.parse(JSON.stringify(options))).toEqual(options)
  })
})
