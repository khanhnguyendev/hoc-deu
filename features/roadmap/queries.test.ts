import { beforeEach, describe, expect, it, vi } from 'vitest'

type Row = { track_id: string; status: string; roadmap_variant: string; budget_minutes: number }

const fake = vi.hoisted(() => ({
  user: {
    id: 'me',
    isAdmin: false,
    codeLanguage: 'java' as 'python' | 'java' | 'go' | null,
  },
  rows: [] as Row[],
  error: null as { message: string } | null,
  calls: [] as unknown[][],
}))

vi.mock('@/lib/auth/dal', () => ({
  requireOnboarded: async () => {
    fake.calls.push(['requireOnboarded'])
    return fake.user
  },
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => {
    fake.calls.push(['createClient'])
    // A thenable query builder: every filter is recorded and applied to the fake rows.
    const filters: [string, unknown][] = []
    const builder = {
      select(columns: string) {
        fake.calls.push(['select', columns])
        return builder
      },
      eq(column: string, value: unknown) {
        fake.calls.push(['eq', column, value])
        filters.push([column, value])
        return builder
      },
      then(resolve: (result: { data: Row[] | null; error: unknown }) => unknown) {
        const data = fake.rows.filter((row) =>
          filters.every(([column, value]) =>
            column === 'user_id' ? value === fake.user.id : row[column as keyof Row] === value,
          ),
        )
        return Promise.resolve(
          fake.error ? { data: null, error: fake.error } : { data, error: null },
        ).then(resolve)
      },
    }
    return {
      from(table: string) {
        fake.calls.push(['from', table])
        return builder
      },
    }
  },
}))

vi.mock('@/lib/content/catalog', async () => {
  const { FIXTURE_ACCESS } = await import('./fixtures')
  return { catalogAccess: FIXTURE_ACCESS }
})

const { getItemPage, getTrackPage, getTracksOverview } = await import('./queries')

const row = (
  track_id: string,
  status: string,
  roadmap_variant: string,
  budget_minutes: number,
) => ({
  track_id,
  status,
  roadmap_variant,
  budget_minutes,
})

const DSA = {
  id: 'dsa',
  title: 'Cấu trúc dữ liệu & Giải thuật',
  titleEn: 'Data Structures & Algorithms',
  accent: 'track-1',
  status: 'active',
}
const ENGLISH = {
  id: 'english',
  title: 'Tiếng Anh cho môi trường IT',
  titleEn: 'English for IT workplaces',
  accent: 'track-2',
  status: 'active',
}
const LEGACY = {
  id: 'legacy',
  title: 'Lộ trình cũ',
  titleEn: 'Legacy track',
  accent: 'track-4',
  status: 'retired',
}
const SYSDESIGN = {
  id: 'sysdesign',
  title: 'Thiết kế hệ thống',
  titleEn: 'System design',
  accent: 'track-3',
  status: 'draft',
}

beforeEach(() => {
  fake.user = { id: 'me', isAdmin: false, codeLanguage: 'java' }
  fake.rows = []
  fake.error = null
  fake.calls = []
})

describe('getTracksOverview', () => {
  it('guards first, then reads the learner’s own user_tracks rows with the session client', async () => {
    await getTracksOverview()
    expect(fake.calls).toEqual([
      ['requireOnboarded'],
      ['createClient'],
      ['from', 'user_tracks'],
      ['select', 'track_id, status, roadmap_variant, budget_minutes'],
      ['eq', 'user_id', 'me'],
    ])
  })

  it('lists active and paused enrollments as mine, in catalog order — a retired track included', async () => {
    fake.rows = [
      row('english', 'paused', '10w', 25),
      row('dsa', 'active', '8w', 60),
      row('legacy', 'active', '4w', 30),
    ]
    await expect(getTracksOverview()).resolves.toEqual({
      isAdmin: false,
      mine: [
        { track: DSA, enrollment: { status: 'active', roadmapVariant: '8w', budgetMinutes: 60 } },
        {
          track: ENGLISH,
          enrollment: { status: 'paused', roadmapVariant: '10w', budgetMinutes: 25 },
        },
        {
          track: LEGACY,
          enrollment: { status: 'active', roadmapVariant: '4w', budgetMinutes: 30 },
        },
      ],
      others: [],
    })
  })

  it('offers active tracks not enrolled (or removed) as others; never retired or draft ones', async () => {
    fake.rows = [row('english', 'removed', '10w', 25), row('gone', 'active', '8w', 60)]
    const overview = await getTracksOverview()
    expect(overview.mine).toEqual([])
    expect(overview.others).toEqual([DSA, ENGLISH])
  })

  it('shows draft tracks to admins', async () => {
    fake.user = { ...fake.user, isAdmin: true }
    const overview = await getTracksOverview()
    expect(overview.isAdmin).toBe(true)
    expect(overview.others).toEqual([DSA, ENGLISH, SYSDESIGN])
  })

  it('reads an unknown status as removed (not shown as mine)', async () => {
    fake.rows = [row('dsa', 'archived', '8w', 60)]
    const overview = await getTracksOverview()
    expect(overview.mine).toEqual([])
    expect(overview.others).toEqual([DSA, ENGLISH])
  })

  it('throws on a read error, so the error boundary offers "Thử lại"', async () => {
    fake.error = { message: 'boom' }
    await expect(getTracksOverview()).rejects.toThrow()
  })
})

describe('getTrackPage', () => {
  it('guards first; an unknown track is null without a database read', async () => {
    await expect(getTrackPage('nope', undefined)).resolves.toBeNull()
    expect(fake.calls).toEqual([['requireOnboarded']])
  })

  it('reads only this track’s row of the learner', async () => {
    await getTrackPage('dsa', undefined)
    expect(fake.calls.slice(0, 6)).toEqual([
      ['requireOnboarded'],
      ['createClient'],
      ['from', 'user_tracks'],
      ['select', 'track_id, status, roadmap_variant, budget_minutes'],
      ['eq', 'user_id', 'me'],
      ['eq', 'track_id', 'dsa'],
    ])
  })

  it('hides a draft track from a learner and shows it to an admin', async () => {
    await expect(getTrackPage('sysdesign', undefined)).resolves.toBeNull()
    fake.user = { ...fake.user, isAdmin: true }
    const page = await getTrackPage('sysdesign', undefined)
    expect(page?.track).toEqual(SYSDESIGN)
    expect(page?.isAdmin).toBe(true)
  })

  it('shows a retired track only to its enrolled learners (and admins)', async () => {
    await expect(getTrackPage('legacy', undefined)).resolves.toBeNull()
    fake.rows = [row('legacy', 'removed', '4w', 30)]
    await expect(getTrackPage('legacy', undefined)).resolves.toBeNull()
    fake.rows = [row('legacy', 'paused', '4w', 30)]
    const page = await getTrackPage('legacy', undefined)
    expect(page?.track).toEqual(LEGACY)
    expect(page?.enrollment).toEqual({ status: 'paused', roadmapVariant: '4w', budgetMinutes: 30 })
    fake.rows = []
    fake.user = { ...fake.user, isAdmin: true }
    expect((await getTrackPage('legacy', undefined))?.track).toEqual(LEGACY)
  })

  it('picks the variant: the parameter, else the enrolled one, else the budget default (2.9)', async () => {
    const current = async (variant: string | undefined) =>
      (await getTrackPage('dsa', variant))?.variants.find((v) => v.current)?.id
    // No enrollment: defaultVariant(roadmaps, 60 min) → 8w (recommended below 75).
    expect(await current(undefined)).toBe('8w')
    expect(await current('nope')).toBe('8w')
    expect(await current('10w')).toBe('10w')
    fake.rows = [row('dsa', 'active', '10w', 90)]
    expect(await current(undefined)).toBe('10w')
    expect(await current('nope')).toBe('10w')
    expect(await current('8w')).toBe('8w')
    // A stale enrolled variant the manifest no longer lists falls back to the default.
    fake.rows = [row('dsa', 'active', '12w', 90)]
    expect(await current(undefined)).toBe('8w')
    // A removed enrollment does not count.
    fake.rows = [row('dsa', 'removed', '10w', 90)]
    expect(await current(undefined)).toBe('8w')
  })

  it('links every manifest roadmap by label, marking the current one', async () => {
    const page = await getTrackPage('dsa', '10w')
    expect(page?.variants).toEqual([
      { id: '8w', label: '8 tuần', href: '/t/dsa?variant=8w', current: false },
      { id: '10w', label: '10 tuần', href: '/t/dsa?variant=10w', current: true },
    ])
  })

  it('builds the view of an existing roadmap file; a missing one is view: null (decision 4)', async () => {
    fake.rows = [row('dsa', 'active', '8w', 60)]
    const page = await getTrackPage('dsa', undefined)
    expect(page?.view?.variant).toBe('8w')
    expect(page?.view?.weeks.map((week) => week.week)).toEqual([1, 2, 3])
    expect(page?.enrollment).toEqual({ status: 'active', roadmapVariant: '8w', budgetMinutes: 60 })
    expect(page?.isAdmin).toBe(false)
    await expect(getTrackPage('dsa', '10w')).resolves.toMatchObject({ view: null })
  })

  it('includes drafts in the view for admins only', async () => {
    const coreOf = async () =>
      (await getTrackPage('dsa', '8w'))?.view?.weeks[0]?.core.map((item) => item.id)
    expect(await coreOf()).toEqual(['dsa:lc-0001', 'dsa:lc-0167'])
    fake.user = { ...fake.user, isAdmin: true }
    expect(await coreOf()).toEqual(['dsa:lc-0001', 'dsa:lc-0217', 'dsa:lc-0167'])
  })

  it('describes the weekly template and throttle as Vietnamese text', async () => {
    const dsa = await getTrackPage('dsa', undefined)
    expect(dsa?.template).toEqual([
      { label: 'Thứ 2 – Thứ 6', blocks: ['Ôn tập (tối đa 15 phút)', 'Bài mới'] },
      { label: 'Thứ 7', blocks: ['Ôn tập'] },
    ])
    expect(dsa?.throttle).toEqual([])
    const english = await getTrackPage('english', undefined)
    expect(english?.throttle).toEqual([
      'Tối đa 8 thẻ mới mỗi ngày',
      'Trên 40 thẻ cần ôn: 4 thẻ mới mỗi ngày',
    ])
    expect(english?.enrollment).toBeNull()
  })
})

describe('getItemPage', () => {
  it('guards first and never reads the database', async () => {
    await getItemPage('dsa', 'lc-0001')
    expect(fake.calls).toEqual([['requireOnboarded']])
  })

  it('returns the item, its track, the viewer and the back link', async () => {
    const model = await getItemPage('dsa', 'lc-0001')
    expect(model?.item.id).toBe('dsa:lc-0001')
    expect(model?.track).toEqual(DSA)
    expect(model?.viewer).toEqual({ codeLanguage: 'java', isAdmin: false })
    expect(model?.backHref).toBe('/t/dsa')
    expect(model).not.toHaveProperty('data')
  })

  it('falls back to the track’s first code language when the learner has none', async () => {
    fake.user = { ...fake.user, codeLanguage: null }
    expect((await getItemPage('dsa', 'lc-0001'))?.viewer.codeLanguage).toBe('python')
    expect((await getItemPage('english', 'ex-w01-fill-1'))?.viewer.codeLanguage).toBe('python')
  })

  it('decodes a derived card ID from the route (encoded or not)', async () => {
    const encoded = await getItemPage('english', 'explaining-code%3Adsa%3Alc-0001')
    expect(encoded?.item.id).toBe('english:explaining-code:dsa:lc-0001')
    const raw = await getItemPage('english', 'explaining-code:dsa:lc-0001')
    expect(raw?.item.id).toBe('english:explaining-code:dsa:lc-0001')
  })

  it('is null for an unknown item or track, and for another track’s item', async () => {
    await expect(getItemPage('dsa', 'lc-99999')).resolves.toBeNull()
    await expect(getItemPage('nope', 'lc-0001')).resolves.toBeNull()
    await expect(getItemPage('english', 'lc-0001')).resolves.toBeNull()
    await expect(getItemPage('dsa', '%E0%A4%A')).resolves.toBeNull()
  })

  it('hides a draft item and a draft track’s items from learners; admins see both', async () => {
    await expect(getItemPage('dsa', 'lc-0217')).resolves.toBeNull()
    await expect(getItemPage('sysdesign', 'prompt-intro')).resolves.toBeNull()
    fake.user = { ...fake.user, isAdmin: true }
    expect((await getItemPage('dsa', 'lc-0217'))?.item.status).toBe('draft')
    expect((await getItemPage('sysdesign', 'prompt-intro'))?.track).toEqual(SYSDESIGN)
  })

  it('keeps a retired item viewable (its page shows the notice)', async () => {
    expect((await getItemPage('dsa', 'lc-0015'))?.item.status).toBe('retired')
  })

  it('resolves links like the page’s viewer: drafts for admins only', async () => {
    const learner = await getItemPage('dsa', 'lc-0001')
    expect(learner?.resolveItem('dsa:lc-0167')?.href).toBe('/t/dsa/items/lc-0167')
    expect(learner?.resolveItem('dsa:lc-0217')).toBeNull()
    expect(learner?.resolveItem('sysdesign:prompt-intro')).toBeNull()
    fake.user = { ...fake.user, isAdmin: true }
    const admin = await getItemPage('dsa', 'lc-0001')
    expect(admin?.resolveItem('dsa:lc-0217')?.id).toBe('dsa:lc-0217')
    expect(admin?.resolveItem('sysdesign:prompt-intro')?.id).toBe('sysdesign:prompt-intro')
  })
})
