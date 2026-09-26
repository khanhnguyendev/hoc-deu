import { describe, expect, it } from 'vitest'
import { EVENT_PAYLOADS } from '@/lib/domain/events'
import { vi } from '../vi'
import { outcomes } from './outcomes'

/** Every string of `node`, with its path. */
function strings(node: unknown, path = 'outcomes'): [string, string][] {
  if (typeof node === 'string') return [[path, node]]
  return Object.entries(node as Record<string, unknown>).flatMap(([key, value]) =>
    strings(value, `${path}.${key}`),
  )
}

describe('lib/i18n/strings/outcomes.ts (task 5.2c)', () => {
  it('is vi.outcomes', () => {
    expect(vi.outcomes).toBe(outcomes)
  })

  it.each(strings(outcomes))('%s is trimmed, non-empty NFC text', (_path, text) => {
    expect(text.length).toBeGreaterThan(0)
    expect(text).toBe(text.trim())
    expect(text).toBe(text.normalize('NFC'))
  })

  it('names the problem grades of the brief: solve (new, redo) and recall (decision 17)', () => {
    expect(outcomes.problem.solve).toEqual({
      solved: 'Tự giải được',
      hint: 'Cần gợi ý',
      failed: 'Chưa giải được',
    })
    expect(outcomes.problem.recall).toEqual({
      solved: 'Nhớ rõ',
      hint: 'Nhớ một phần',
      failed: 'Không nhớ',
    })
    expect(outcomes.problem.recallPrompt).toBe('Nêu pattern, cách làm và độ phức tạp')
    expect(outcomes.problem.showNote).toBe('Xem ghi chú')
    expect(outcomes.problem.redo).toBe('Làm lại từ đầu')
    expect(outcomes.problem.nudge).toContain('{grade}')
  })

  it('labels exactly the results the item.result payload knows (§4.4)', () => {
    const results = EVENT_PAYLOADS['item.result'].shape.result.options
    const labelled = [
      ...Object.keys(outcomes.problem.solve),
      ...Object.keys(outcomes.flashcard.grades),
    ].sort()
    expect(labelled).toEqual([...results].sort())
    expect(Object.keys(outcomes.problem.recall).sort()).toEqual(
      Object.keys(outcomes.problem.solve).sort(),
    )
  })

  it('names the flashcard grades (DESIGN_SYSTEM §9) and the exercise self-grades', () => {
    expect(outcomes.flashcard.grades).toEqual({
      know: 'Biết',
      unsure: 'Chưa chắc',
      dont_know: 'Không biết',
    })
    const grades = EVENT_PAYLOADS['exercise.submitted'].shape.grade.options
    expect(Object.keys(outcomes.exercise.grades).sort()).toEqual([...grades].sort())
    expect(outcomes.exercise.grades).toEqual({ pass: 'Đạt', close: 'Gần đạt', miss: 'Chưa đạt' })
  })

  it('has the lesson, prompt, item-wide and session copy of the brief', () => {
    expect(outcomes.lesson.complete).toBe('Hoàn thành bài học')
    expect(outcomes.lesson.quizScore).toContain('{percent}')
    expect(outcomes.prompt.done).toBe('Đã làm xong')
    expect(Object.keys(outcomes.prompt.ratings)).toEqual(['1', '2', '3'])
    expect(outcomes.actions.skip).toBe('Bỏ qua mục này')
    expect(outcomes.actions.readd).toBe('Ôn lại')
    expect(outcomes.plan.today).toBe('Trong kế hoạch hôm nay')
    expect(outcomes.session.doneTitle).toBe('Đã ôn xong')
    expect(outcomes.session.remaining).toContain('{count}')
    expect(outcomes.mockInterview.none).toBe('Chưa có bài Medium nào đã học')
  })
})
