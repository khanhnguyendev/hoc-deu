import { describe, expect, it } from 'vitest'
import { EXERCISE_KINDS } from '@/lib/content/item-types/exercise'
import { CARD_TIERS, PARTS_OF_SPEECH, REGISTERS } from '@/lib/content/item-types/flashcard'
import { RECAP_MODES } from '@/lib/content/schemas/roadmap'
import { BUDGET_MINUTES, MAX_START_DAYS_AHEAD } from '@/lib/domain/settings'
import { vi } from './vi'

/** Every key the components and lib/events read. */
const USED = [
  'common.close',
  'common.openMenu',
  'common.loading',
  'common.retry',
  'common.cancel',
  'common.confirm',
  'common.skipToContent',
  'common.notifications',
  'nav.main',
  'nav.today',
  'nav.review',
  'nav.roadmap',
  'nav.progress',
  'nav.settings',
  'nav.admin',
  'nav.adminUsers',
  'nav.adminContent',
  'nav.account',
  'nav.signOut',
  'nav.collapse',
  'nav.expand',
  'theme.label',
  'theme.light',
  'theme.dark',
  'theme.system',
  'status.notStarted',
  'status.weak',
  'status.ok',
  'status.strong',
  'status.mastered',
  'status.skipped',
  'block.done',
  'block.partial',
  'block.skipped',
  'streak.suffix',
  'heatmap.legend',
  'heatmap.levels',
  'heatmap.weekdays',
  'heatmap.showTable',
  'heatmap.hideTable',
  'heatmap.previousMonth',
  'heatmap.nextMonth',
  'heatmap.day',
  'heatmap.minutes',
  'heatmap.noActivity',
  'heatmap.pickDay',
  'states.errorTitle',
  'states.errorBody',
  'states.notFoundTitle',
  'states.notFoundBody',
  'states.backHome',
  'states.globalErrorTitle',
  'states.globalErrorBody',
  'errors.quotaExceeded',
  'errors.saveFailed',
  'errors.notAllowed',
  'errors.invalidTransition',
  'errors.invalidTimezone',
  'errors.tooManyTracks',
  'errors.tooManyPendingSchedules',
  'forms.required',
  'forms.errorSummaryTitle',
  'forms.step',
  'auth.signInTitle',
  'auth.signInDescription',
  'auth.continueWithGoogle',
  'auth.continueWithGitHub',
  'auth.signInFailed',
  'auth.testLoginTitle',
  'auth.testLoginDescription',
  'auth.testLoginFormLabel',
  'auth.email',
  'auth.password',
  'auth.submit',
  'auth.wrongCredentials',
  'auth.testLoginDisabled',
  'landing.deletedBanner',
  'account.pending.title',
  'account.pending.description',
  'account.rejected.title',
  'account.rejected.description',
  'account.suspended.title',
  'account.suspended.description',
  'account.signOutFailed',
  'onboarding.pageTitle',
  'onboarding.title',
  'onboarding.description',
  'onboarding.steps.tracks',
  'onboarding.steps.minutes',
  'onboarding.steps.variant',
  'onboarding.steps.schedule',
  'onboarding.steps.language',
  'onboarding.steps.preview',
  'onboarding.back',
  'onboarding.next',
  'onboarding.submit',
  'onboarding.tracks.description',
  'onboarding.tracks.suggested',
  'onboarding.minutes.description',
  'onboarding.minutes.helper',
  'onboarding.variant.description',
  'onboarding.schedule.description',
  'onboarding.schedule.startDate',
  'onboarding.schedule.startDateHelper',
  'onboarding.schedule.timezone',
  'onboarding.schedule.dayStart',
  'onboarding.schedule.dayStartHelper',
  'onboarding.language.description',
  'onboarding.language.python',
  'onboarding.language.java',
  'onboarding.language.go',
  'onboarding.preview.description',
  'onboarding.errors.invalid',
  'onboarding.errors.noTrack',
  'onboarding.errors.duplicateTrack',
  'onboarding.errors.unknownTrack',
  'onboarding.errors.minutes',
  'onboarding.errors.variant',
  'onboarding.errors.startDate',
  'onboarding.errors.startDateTooLate',
  'onboarding.errors.timezone',
  'onboarding.errors.dayStart',
  'onboarding.errors.codeLanguage',
  'onboarding.errors.codeLanguageUnused',
  'tracks.throttleTitle',
  'onboarding.noTracks.title',
  'onboarding.noTracks.description',
  'roadmap.description',
  'roadmap.mine',
  'roadmap.others',
  'roadmap.status.active',
  'roadmap.status.paused',
  'roadmap.budget',
  'roadmap.view',
  'roadmap.addInSettings',
  'roadmap.retired',
  'roadmap.draft',
  'roadmap.noOthers',
  'roadmap.emptyMine.title',
  'roadmap.emptyMine.description',
  'roadmap.emptyMine.action',
  'roadmap.empty.title',
  'roadmap.empty.description',
  'roadmap.variants',
  'roadmap.template',
  'roadmap.noContent.title',
  'roadmap.noContent.description',
  'roadmap.noContent.action',
  'roadmap.week.title',
  'roadmap.week.topics',
  'roadmap.week.lessons',
  'roadmap.week.core',
  'roadmap.week.recap',
  'roadmap.week.bonus',
  'roadmap.week.decks',
  'roadmap.week.deckCounts',
  'roadmap.week.showCards',
  'roadmap.week.exercises',
  'roadmap.week.prompts',
  'roadmap.week.empty',
  'roadmap.recapMode.redo',
  'roadmap.recapMode.recall',
  'roadmap.recapMode.explain-aloud',
  'roadmap.anytime.title',
  'roadmap.anytime.description',
  'roadmap.anytime.derivedCount',
  'roadmap.anytime.derivedHint',
  'roadmap.backToTrack',
  'settings.description',
  'settings.admin.title',
  'settings.admin.description',
  'settings.schedule.title',
  'settings.schedule.description',
  'settings.schedule.timezone',
  'settings.schedule.dayStart',
  'settings.schedule.dayStartHelper',
  'settings.schedule.save',
  'settings.schedule.pending',
  'settings.schedule.unchanged',
  'settings.schedule.cancelled',
  'settings.tracks.title',
  'settings.tracks.description',
  'settings.tracks.emptyTitle',
  'settings.tracks.emptyBody',
  'settings.tracks.status.active',
  'settings.tracks.status.paused',
  'settings.tracks.minutes',
  'settings.tracks.minutesHelper',
  'settings.tracks.variant',
  'settings.tracks.templateTitle',
  'settings.tracks.save',
  'settings.tracks.actionsFor',
  'settings.tracks.dismissFailure',
  'settings.tracks.pause',
  'settings.tracks.resume',
  'settings.tracks.remove',
  'settings.tracks.confirmRemove.title',
  'settings.tracks.confirmRemove.description',
  'settings.tracks.updated',
  'settings.tracks.unchanged',
  'settings.tracks.paused',
  'settings.tracks.resumed',
  'settings.tracks.removed',
  'settings.add.title',
  'settings.add.description',
  'settings.add.emptyTitle',
  'settings.add.track',
  'settings.add.removed',
  'settings.add.startDate',
  'settings.add.startDateHelper',
  'settings.add.submit',
  'settings.add.added',
  'settings.codeLanguage.title',
  'settings.codeLanguage.description',
  'settings.codeLanguage.save',
  'settings.codeLanguage.saved',
  'settings.codeLanguage.unchanged',
  'settings.theme.title',
  'settings.theme.description',
  'settings.deleteAccount.title',
  'settings.deleteAccount.description',
  'settings.deleteAccount.privacy',
  'settings.deleteAccount.confirm',
  'settings.deleteAccount.confirmDialog.title',
  'settings.deleteAccount.confirmDialog.description',
  'settings.deleteAccount.failed',
  'settings.errors.invalid',
  'settings.errors.fields',
  'settings.errors.alreadyEnrolled',
  'admin.users.pending',
  'admin.users.active',
  'admin.users.suspended',
  'admin.users.rejected',
  'admin.users.emptyPending',
  'admin.users.emptyActive',
  'admin.users.emptySuspended',
  'admin.users.emptyRejected',
  'admin.users.adminBadge',
  'admin.users.you',
  'admin.users.joined',
  'admin.users.unnamed',
  'admin.users.actionsFor',
  'admin.actions.approve',
  'admin.actions.reject',
  'admin.actions.suspend',
  'admin.actions.reactivate',
  'admin.actions.promote',
  'admin.actions.demote',
  'admin.confirm.reject.title',
  'admin.confirm.reject.description',
  'admin.confirm.suspend.title',
  'admin.confirm.suspend.description',
  'admin.confirm.promote.title',
  'admin.confirm.promote.description',
  'admin.confirm.demote.title',
  'admin.confirm.demote.description',
  'admin.results.approved',
  'admin.results.rejected',
  'admin.results.suspended',
  'admin.results.reactivated',
  'admin.results.promoted',
  'admin.results.demoted',
  'admin.errors.invalid',
  'admin.errors.self',
  'admin.errors.notFound',
  'admin.errors.changed',
  'admin.errors.noChange',
  'admin.errors.failed',
  'template.days.mon-fri',
  'template.days.mon',
  'template.days.tue',
  'template.days.wed',
  'template.days.thu',
  'template.days.fri',
  'template.days.sat',
  'template.days.sun',
  'template.review',
  'template.reviewMax',
  'template.newItems',
  'template.recap',
  'template.fromWeek',
  'template.tags.exercise',
  'template.tags.shadowing',
  'template.tags.mock-interview',
  'template.tags.weekend-task',
  'template.throttle.newPerDay',
  'template.throttle.rule',
  'template.throttle.paused',
  'dev.contentTitle',
  'dev.sampleLesson',
  'dev.sampleNote',
  'content.sections.signals',
  'content.sections.analogy',
  'content.sections.visual',
  'content.sections.approach',
  'content.sections.code',
  'content.sections.complexity',
  'content.sections.bilingual',
  'content.sections.practice',
  'content.sections.quiz',
  'content.varTable',
  'content.table',
  'content.complexity.title',
  'content.complexity.time',
  'content.complexity.space',
  'content.bilingual.vi',
  'content.bilingual.en',
  'content.callout.info',
  'content.callout.tip',
  'content.callout.warning',
  'content.quiz.check',
  'content.quiz.retry',
  'content.quiz.correct',
  'content.quiz.incorrect',
  'content.quiz.score',
  'content.reveal.show',
  'content.reveal.hide',
  'content.solution.show',
  'content.solution.hide',
  'content.solution.tabs',
  'content.solution.label',
  'content.practice.title',
  'content.task.done',
  'content.task.todo',
  'content.codeBlock.label',
  'content.codeBlock.text',
  'content.newTab',
  'dev.itemsTitle',
  'items.difficulty.E',
  'items.difficulty.M',
  'items.difficulty.H',
  'items.status.draft',
  'items.status.retired',
  'items.notice.draft',
  'items.notice.retired',
  'items.related',
  'items.problem.openOnLeetCode',
  'items.problem.premium',
  'items.problem.freeAlternatives',
  'items.problem.noNote',
  'items.problem.noNoteBody',
  'items.problem.deepDive',
  'items.verification.tested',
  'items.verification.testedHint',
  'items.verification.compileOnly',
  'items.verification.compileOnlyHint',
  'items.lessonFormat.pattern',
  'items.lessonFormat.deep-dive',
  'items.lesson.anchor',
  'items.lesson.about',
  'items.lesson.practice',
  'items.lesson.noBody',
  'items.flashcard.reveal',
  'items.flashcard.hide',
  'items.flashcard.hint',
  'items.flashcard.usage',
  'items.flashcard.example',
  'items.flashcard.pronunciation',
  'items.flashcard.tier.core',
  'items.flashcard.tier.extended',
  'items.flashcard.tier.derived',
  'items.flashcard.pos.noun',
  'items.flashcard.pos.verb',
  'items.flashcard.pos.adjective',
  'items.flashcard.pos.adverb',
  'items.flashcard.pos.phrase',
  'items.flashcard.pos.phrasal-verb',
  'items.flashcard.pos.idiom',
  'items.flashcard.pos.abbreviation',
  'items.flashcard.register.formal',
  'items.flashcard.register.neutral',
  'items.flashcard.register.informal',
  'items.exercise.kind.fill-blank',
  'items.exercise.kind.respond',
  'items.exercise.kind.rewrite',
  'items.exercise.blank',
  'items.exercise.check',
  'items.exercise.showHint',
  'items.exercise.hideHint',
  'items.exercise.pass',
  'items.exercise.close',
  'items.exercise.miss',
  'items.exercise.answer',
  'items.exercise.notSaved',
  'items.exercise.showSamples',
  'items.exercise.hideSamples',
  'items.exercise.samples',
  'items.rubric',
]

function lookup(path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>((node, key) => (node as Record<string, unknown>)?.[key], vi)
}

function strings(node: unknown, path = 'vi'): [string, string][] {
  if (typeof node === 'string') return [[path, node]]
  if (Array.isArray(node)) return node.flatMap((item, i) => strings(item, `${path}[${i}]`))
  return Object.entries(node as Record<string, unknown>).flatMap(([k, v]) =>
    strings(v, `${path}.${k}`),
  )
}

describe('lib/i18n/vi.ts', () => {
  it.each(USED)('has %s', (path) => {
    expect(lookup(path)).toBeDefined()
  })

  it('has five heatmap level labels and seven weekday labels (Monday first)', () => {
    expect(vi.heatmap.levels).toHaveLength(5)
    expect(vi.heatmap.weekdays).toEqual(['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'])
  })

  it('labels the lesson sections of decision 33 and keeps the placeholders (task 3.3b)', () => {
    expect(vi.content.sections).toEqual({
      signals: 'Dấu hiệu nhận biết',
      analogy: 'Ví dụ đời thường',
      visual: 'Minh hoạ',
      approach: 'Cách tiếp cận',
      code: 'Code',
      complexity: 'Độ phức tạp',
      bilingual: 'Giải thích song ngữ',
      practice: 'Luyện tập',
      quiz: 'Kiểm tra nhanh',
    })
    expect(vi.content.quiz.incorrect).toBe('Chưa đúng — đáp án: {answer}')
    expect(vi.content.quiz.score).toBe('Đúng {correct}/{total}')
    expect(vi.content.solution.label).toBe('Lời giải {language}')
    expect(vi.content.codeBlock.label).toContain('{language}')
  })

  it('names the item-type copy of task 3.4a', () => {
    // M3-R3: LeetCode's difficulty terms, one source (the practice card reads it too).
    expect(vi.items.difficulty).toEqual({ E: 'Easy', M: 'Medium', H: 'Hard' })
    expect(vi.content.practice).toEqual({ title: 'Bài luyện tập' })
    expect(vi.items.verification.tested).toBe('Đã kiểm thử')
    expect(vi.items.verification.compileOnly).toBe('Chỉ biên dịch')
    expect(vi.items.problem).toMatchObject({
      openOnLeetCode: 'Mở trên LeetCode',
      premium: 'Premium',
      freeAlternatives: 'Bản miễn phí:',
      noNote: 'Chưa có ghi chú',
      noNoteBody: 'Bạn vẫn có thể giải bài trên LeetCode.',
      deepDive: 'Bài học chuyên sâu',
    })
    expect(vi.items.status).toEqual({ draft: 'Bản nháp', retired: 'Đã ngừng' })
    expect(vi.items.lessonFormat).toEqual({ pattern: 'Pattern', 'deep-dive': 'Deep-dive' })
    expect(vi.items.flashcard.reveal).toBe('Xem nghĩa')
    expect(vi.items.flashcard.tier).toEqual({
      core: 'Cốt lõi',
      extended: 'Mở rộng',
      derived: 'Giải thích code',
    })
    expect(vi.items.exercise.kind).toEqual({
      'fill-blank': 'Điền từ',
      respond: 'Trả lời',
      rewrite: 'Viết lại',
    })
    expect(vi.items.exercise).toMatchObject({
      check: 'Kiểm tra',
      showHint: 'Xem gợi ý',
      pass: 'Chính xác',
      close: 'Gần đúng — bạn đã xem gợi ý',
      miss: 'Chưa đúng — đáp án: {answer}',
      notSaved: 'Câu trả lời không được lưu.',
      showSamples: 'Xem câu trả lời mẫu',
    })
  })

  it('names the tracks, roadmap and item-route copy of task 3.4b', () => {
    const copy = vi.roadmap
    expect(vi.nav.roadmap).toBe('Lộ trình')
    expect(copy.description).toBe('Các lộ trình bạn đang học và các lộ trình khác.')
    expect(copy.mine).toBe('Lộ trình của bạn')
    expect(copy.others).toBe('Lộ trình khác')
    expect(copy.status).toEqual({ active: 'Đang học', paused: 'Tạm dừng' })
    expect(copy.view).toBe('Xem lộ trình')
    expect(copy.addInSettings).toBe('Thêm trong Cài đặt')
    expect(copy.retired).toBe('Lộ trình đã ngừng — không nhận học viên mới.')
    expect(copy.variants).toBe('Phiên bản lộ trình')
    expect(copy.noContent.title).toBe('Lộ trình này chưa có nội dung.')
    expect(copy.noContent.description).toBe('Nội dung đang được bổ sung.')
    expect(copy.week).toMatchObject({
      title: 'Tuần {n}',
      core: 'Bài chính',
      recap: 'Ôn lại cuối tuần',
      bonus: 'Bài thêm',
      decks: 'Bộ thẻ',
      deckCounts: '{core} thẻ cốt lõi · {extended} thẻ mở rộng',
      exercises: 'Bài tập',
      prompts: 'Nhiệm vụ',
    })
    expect(copy.recapMode).toEqual({
      redo: 'Làm lại',
      recall: 'Nhớ lại',
      'explain-aloud': 'Giải thích thành lời',
    })
    expect(Object.keys(copy.recapMode).sort()).toEqual([...RECAP_MODES].sort())
    expect(copy.anytime.title).toBe('Không theo tuần')
    expect(copy.backToTrack).toBe('Về lộ trình {title}')
    // RF-4: no active track → the onboarding wizard's empty state.
    expect(vi.onboarding.noTracks.title).toBe('Chưa có lộ trình nào để học')
  })

  it('has a Vietnamese label for every part of speech and register of the card schema', () => {
    expect(Object.keys(vi.items.flashcard.pos).sort()).toEqual([...PARTS_OF_SPEECH].sort())
    expect(Object.keys(vi.items.flashcard.register).sort()).toEqual([...REGISTERS].sort())
    expect(Object.keys(vi.items.flashcard.tier).sort()).toEqual([...CARD_TIERS].sort())
    expect(Object.keys(vi.items.exercise.kind).sort()).toEqual([...EXERCISE_KINDS].sort())
  })

  it('stores every string non-empty, trimmed and in NFC (RF-3)', () => {
    for (const [path, value] of strings(vi)) {
      expect(value, path).not.toBe('')
      expect(value, path).toBe(value.trim())
      expect(value, path).toBe(value.normalize('NFC'))
    }
  })

  it('states the budget and start-date rules of lib/domain/settings', () => {
    const { min, max, step } = BUDGET_MINUTES
    expect(vi.onboarding.errors.minutes).toContain(`từ ${min} đến ${max}, bước ${step} phút`)
    expect(vi.settings.tracks.minutesHelper).toBe(`Từ ${min} đến ${max} phút, bước ${step} phút.`)
    expect(vi.onboarding.errors.startDateTooLate).toContain(`${MAX_START_DAYS_AHEAD} ngày`)
    expect(vi.onboarding.schedule.startDateHelper).toContain(`${MAX_START_DAYS_AHEAD} ngày`)
    expect(vi.settings.add.startDateHelper).toContain(`${MAX_START_DAYS_AHEAD} ngày`)
  })
})
