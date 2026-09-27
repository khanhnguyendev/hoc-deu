import { CardSession } from '@/features/items/components/outcome/card-session'
import { ExerciseOutcome } from '@/features/items/components/outcome/exercise-outcome'
import {
  FlashcardGrades,
  FlashcardOutcome,
} from '@/features/items/components/outcome/flashcard-grades'
import { GradeButtons } from '@/features/items/components/outcome/grade-buttons'
import { ItemActions } from '@/features/items/components/outcome/item-actions'
import { LessonComplete } from '@/features/items/components/outcome/lesson-complete'
import { ProblemOutcome } from '@/features/items/components/outcome/problem-outcome'
import { PromptOutcome } from '@/features/items/components/outcome/prompt-outcome'
import { FlashcardView } from '@/features/items/components/flashcard-view'
import { Choice, Question, Quiz } from '@/features/items/components/mdx/quiz'
import { SolutionTabs } from '@/features/items/components/mdx/solution-tabs'
import {
  cardItem,
  derivedCardItem,
  fillBlankItem,
  outcomeBinding,
  REQUEST_ID,
  rewriteItem,
} from '@/features/items/fixtures'
import type { CardSessionProps, RecordOutcome } from '@/features/items/outcome'
import { mdxComponents as Md } from '@/features/items/mdx/components'
import { fill } from '@/lib/i18n/format'
import { vi } from '@/lib/i18n/vi'
import { JAVA_SAMPLE, PYTHON_SAMPLE } from '../code-samples'
import type { Entry } from '../types'

/** `/dev/components` entries of the item outcome components of features/items (task 5.2c) — Part B-M5 decision 3: only that task edits this file. */

const WIDE = 'flex w-full max-w-prose flex-col gap-4'
const WAIT_MS = 600

/** A stand-in `recordOutcome` that saves after a moment (nothing is sent anywhere). */
const saves: RecordOutcome = () =>
  new Promise((resolve) =>
    setTimeout(
      () => resolve({ ok: true, message: vi.checkIn.outcome.saved, autoCheckedIn: [] }),
      WAIT_MS,
    ),
  )

/** …one that finishes a block (the auto check-in, §5.5). */
const checksIn: RecordOutcome = () =>
  new Promise((resolve) =>
    setTimeout(
      () =>
        resolve({ ok: true, message: vi.checkIn.outcome.savedAndCheckedIn, autoCheckedIn: ['b'] }),
      WAIT_MS,
    ),
  )

/** …and one whose call fails (offline): the error state. */
const fails: RecordOutcome = () =>
  new Promise((_resolve, reject) => setTimeout(() => reject(new Error('offline')), WAIT_MS))

const TWO_SUM = 'dsa:lc-0001'
const PLAN = { blockId: 'b-new', label: vi.outcomes.plan.today }

/** A note stand-in: prose and the note's `<Solution />` (reveal it for the nudge). */
function Note() {
  return (
    <div className="flex flex-col gap-4">
      <Md.p>Lưu mỗi số vào hash map để tìm phần bù trong O(1).</Md.p>
      <SolutionTabs
        solutions={{ python: PYTHON_SAMPLE, java: JAVA_SAMPLE }}
        defaultLanguage="python"
      />
    </div>
  )
}

const SOLVE_GRADES = [
  { value: 'solved', label: vi.outcomes.problem.solve.solved },
  { value: 'hint', label: vi.outcomes.problem.solve.hint },
  { value: 'failed', label: vi.outcomes.problem.solve.failed },
] as const

const sides = (item: ReturnType<typeof cardItem>) => item.content
const CARDS: CardSessionProps['cards'] = [
  { itemId: 'english:w01-blocker', sides: sides(cardItem()), blockId: 'b-review' },
  {
    itemId: 'english:w01-unblock',
    sides: {
      ...sides(cardItem()),
      front: 'unblock',
      back: 'gỡ vướng cho ai đó',
      example: 'Can you unblock me by approving the PR?',
    },
    blockId: 'b-review',
  },
  { itemId: 'english:explaining-code:dsa:lc-0001', sides: sides(derivedCardItem()) },
]

export const OUTCOME_ENTRIES: Entry[] = [
  {
    name: 'GradeButtons',
    layer: 'features',
    file: 'features/items/components/outcome/grade-buttons.tsx',
    demos: [
      {
        title: 'Chưa chọn — bấm một mức là lưu ngay',
        render: () => (
          <div className={WIDE}>
            <GradeButtons
              label={vi.outcomes.problem.solveLabel}
              grades={SOLVE_GRADES}
              onGrade={() => {}}
            />
          </div>
        ),
      },
      {
        title: 'Chọn sẵn "Cần gợi ý" (đã xem lời giải), kèm lời nhắc',
        render: () => (
          <div className={WIDE}>
            <GradeButtons
              label={vi.outcomes.problem.solveLabel}
              grades={SOLVE_GRADES}
              selected="hint"
              description={fill(vi.outcomes.problem.nudge, {
                grade: vi.outcomes.problem.solve.hint,
              })}
              onGrade={() => {}}
            />
          </div>
        ),
      },
      {
        title: 'Đang lưu "Tự giải được" (các mức khác tạm khoá)',
        render: () => (
          <div className={WIDE}>
            <GradeButtons
              label={vi.outcomes.problem.solveLabel}
              grades={SOLVE_GRADES}
              pending="solved"
              onGrade={() => {}}
            />
          </div>
        ),
      },
    ],
  },
  {
    name: 'ProblemOutcome',
    layer: 'features',
    file: 'features/items/components/outcome/problem-outcome.tsx',
    demos: [
      {
        title: 'Bài mới trong kế hoạch: ghi chú rồi ba mức; "Xem lời giải" chọn sẵn "Cần gợi ý"',
        render: () => (
          <div className={WIDE}>
            <ProblemOutcome
              binding={outcomeBinding(checksIn, { itemId: TWO_SUM, plan: PLAN, blockId: 'b-new' })}
              hasNote
            >
              <Note />
            </ProblemOutcome>
          </div>
        ),
      },
      {
        title: 'Ôn nhanh (recall): câu hỏi trước, ghi chú sau "Xem ghi chú"; "Làm lại từ đầu"',
        render: () => (
          <div className={WIDE}>
            <ProblemOutcome binding={outcomeBinding(saves, { mode: 'recall' })} hasNote>
              <Note />
            </ProblemOutcome>
          </div>
        ),
      },
      {
        title: 'Làm lại (redo) — lưu không được: báo lỗi, mọi mức vẫn chọn được',
        render: () => (
          <div className={WIDE}>
            <ProblemOutcome binding={outcomeBinding(fails, { mode: 'redo' })} hasNote>
              <Note />
            </ProblemOutcome>
          </div>
        ),
      },
    ],
  },
  {
    name: 'FlashcardGrades',
    layer: 'features',
    file: 'features/items/components/outcome/flashcard-grades.tsx',
    demos: [
      {
        title: 'Biết / Chưa chắc / Không biết (phím 1 / 2 / 3)',
        render: () => (
          <div className={WIDE}>
            <FlashcardGrades onGrade={() => {}} />
          </div>
        ),
      },
      {
        title: 'Đã lưu "Chưa chắc"',
        render: () => (
          <div className={WIDE}>
            <FlashcardGrades onGrade={() => {}} selected="unsure" />
          </div>
        ),
      },
    ],
  },
  {
    name: 'FlashcardOutcome',
    layer: 'features',
    file: 'features/items/components/outcome/flashcard-grades.tsx',
    demos: [
      {
        title: 'Trang thẻ: "Xem nghĩa" rồi chấm — kết quả trong vùng thông báo',
        render: () => (
          <div className={WIDE}>
            <FlashcardView card={cardItem().content} headingLevel={3}>
              <FlashcardOutcome
                binding={outcomeBinding(saves, { itemId: 'english:w01-blocker' })}
              />
            </FlashcardView>
          </div>
        ),
      },
    ],
  },
  {
    name: 'CardSession',
    layer: 'features',
    file: 'features/items/components/outcome/card-session.tsx',
    demos: [
      {
        title: 'Ba thẻ, chấm lần lượt (phím 1 / 2 / 3), rồi "Đã ôn xong"',
        render: () => <CardSession cards={CARDS} requestId={REQUEST_ID} record={saves} />,
      },
      {
        title: 'Lưu không được: báo lỗi và "Thử lại"',
        render: () => (
          <CardSession cards={CARDS.slice(0, 1)} requestId={REQUEST_ID} record={fails} />
        ),
      },
      {
        title: 'Không có thẻ nào',
        render: () => <CardSession cards={[]} requestId={REQUEST_ID} record={saves} />,
      },
    ],
  },
  {
    name: 'LessonComplete',
    layer: 'features',
    file: 'features/items/components/outcome/lesson-complete.tsx',
    demos: [
      {
        title: 'Bài học rồi "Hoàn thành bài học" — kèm điểm Quiz khi đã "Kiểm tra"',
        render: () => (
          <div className={WIDE}>
            <LessonComplete binding={outcomeBinding(saves, { itemId: 'dsa:lesson-two-pointers' })}>
              <Quiz>
                <Question
                  prompt="Mảng chưa sắp xếp thì dùng hai con trỏ ngay được không?"
                  answer="b"
                >
                  <Choice id="a">Được, luôn luôn</Choice>
                  <Choice id="b">Không, phải sắp xếp trước hoặc dùng hash map</Choice>
                </Question>
              </Quiz>
            </LessonComplete>
          </div>
        ),
      },
    ],
  },
  {
    name: 'ExerciseOutcome',
    layer: 'features',
    file: 'features/items/components/outcome/exercise-outcome.tsx',
    demos: [
      {
        title: 'Điền từ: mỗi lần "Kiểm tra" nộp kết quả (Đạt / Gần đạt / Chưa đạt)',
        render: () => (
          <div className={WIDE}>
            <ExerciseOutcome
              exercise={fillBlankItem().content}
              binding={outcomeBinding(saves, { itemId: 'english:ex-w01-fill-1' })}
            />
          </div>
        ),
      },
      {
        title:
          'Viết lại: xem câu trả lời mẫu rồi tự chấm theo tiêu chí (câu trả lời không được gửi)',
        render: () => (
          <div className={WIDE}>
            <ExerciseOutcome
              exercise={rewriteItem().content}
              binding={outcomeBinding(saves, { itemId: 'english:ex-w01-rewrite-1' })}
            />
          </div>
        ),
      },
      {
        title: 'Chỉ xem (không có binding): không tự chấm',
        render: () => (
          <div className={WIDE}>
            <ExerciseOutcome exercise={rewriteItem().content} />
          </div>
        ),
      },
    ],
  },
  {
    name: 'PromptOutcome',
    layer: 'features',
    file: 'features/items/components/outcome/prompt-outcome.tsx',
    demos: [
      {
        title: 'Tự đánh giá 1–3 (không bắt buộc), rồi "Đã làm xong"',
        render: () => (
          <div className={WIDE}>
            <PromptOutcome
              binding={outcomeBinding(saves, { itemId: 'dsa:prompt-mock-interview' })}
            />
          </div>
        ),
      },
    ],
  },
  {
    name: 'ItemActions',
    layer: 'features',
    file: 'features/items/components/outcome/item-actions.tsx',
    demos: [
      {
        title: 'Chưa học (hoặc đến hạn ôn): "Bỏ qua mục này" hỏi lại trước',
        render: () => (
          <div className={WIDE}>
            <ItemActions binding={outcomeBinding(saves)} />
          </div>
        ),
      },
      {
        title: 'Đã thành thạo: "Ôn lại"',
        render: () => (
          <div className={WIDE}>
            <ItemActions
              binding={outcomeBinding(saves, {
                state: { status: 'mastered', level: 3, dueOn: null },
              })}
            />
          </div>
        ),
      },
    ],
  },
]
