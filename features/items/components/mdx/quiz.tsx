'use client'

import { CircleCheck, CircleX } from 'lucide-react'
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { Button } from '@/components/ui/button'
import { vi } from '@/lib/i18n/vi'
import { cn } from '@/lib/utils'
import { fill, fillNode } from './copy'

const copy = vi.content.quiz

export type QuizScore = { correct: number; total: number; percent: number }

type QuizContextValue = {
  checked: boolean
  selections: Readonly<Record<string, string>>
  select: (question: string, choice: string) => void
  register: (question: string, answer: string) => () => void
}

type QuestionContextValue = {
  name: string
  selected: string | null
  checked: boolean
  select: (choice: string) => void
  registerLabel: (choice: string, label: ReactNode) => () => void
}

const QuizContext = createContext<QuizContextValue | null>(null)
const QuestionContext = createContext<QuestionContextValue | null>(null)

/**
 * `<Quiz>` — a lesson's quick check (platform design §3.5), scored in the browser: "Kiểm tra"
 * counts correct / total (an unanswered question is wrong), shows a verdict under each question,
 * announces "Đúng {correct}/{total}" in a polite live region and reports the score (`onScore`,
 * percent rounded — task 5.2 sends it with `lesson.completed`). "Làm lại" clears everything.
 * Questions register their answer here; the check never inspects children (decision 17).
 */
function Quiz({
  children,
  onScore,
}: {
  children?: ReactNode
  onScore?: (score: QuizScore) => void
}) {
  const answers = useRef(new Map<string, string>())
  const [selections, setSelections] = useState<Readonly<Record<string, string>>>({})
  const [score, setScore] = useState<QuizScore | null>(null)

  const register = useCallback((question: string, answer: string) => {
    answers.current.set(question, answer)
    return () => {
      answers.current.delete(question)
    }
  }, [])
  const select = useCallback((question: string, choice: string) => {
    setSelections((previous) => ({ ...previous, [question]: choice }))
  }, [])

  const check = () => {
    const entries = [...answers.current]
    const correct = entries.filter(([question, answer]) => selections[question] === answer).length
    const total = entries.length
    // An empty quiz is rejected by the check; never divide by zero anyway.
    const result = {
      correct,
      total,
      percent: total === 0 ? 0 : Math.round((correct / total) * 100),
    }
    setScore(result)
    onScore?.(result)
  }
  const retry = () => {
    setSelections({})
    setScore(null)
  }

  const checked = score !== null
  const value = useMemo(
    () => ({ checked, selections, select, register }),
    [checked, selections, select, register],
  )

  return (
    <QuizContext value={value}>
      <div data-slot="quiz" className="space-y-6">
        {children}
        <div className="flex flex-wrap items-center gap-4">
          <Button variant={checked ? 'outline' : 'primary'} onClick={checked ? retry : check}>
            {checked ? copy.retry : copy.check}
          </Button>
          <p role="status" aria-live="polite" className="font-semibold">
            {score === null ? '' : fill(copy.score, { correct: score.correct, total: score.total })}
          </p>
        </div>
      </div>
    </QuizContext>
  )
}

/**
 * `<Question prompt answer>` — a fieldset of `<Choice>`s with the prompt as its legend; after
 * "Kiểm tra", an icon and "Chính xác" or "Chưa đúng — đáp án: …" (the answer choice's content).
 */
function Question({
  prompt,
  answer,
  children,
}: {
  prompt: string
  answer: string
  children?: ReactNode
}) {
  const quiz = use(QuizContext)
  const register = quiz?.register
  const question = useId()
  const [labels, setLabels] = useState<ReadonlyMap<string, ReactNode>>(new Map())

  useEffect(() => register?.(question, answer), [register, question, answer])

  const registerLabel = useCallback((choice: string, label: ReactNode) => {
    setLabels((previous) => new Map(previous).set(choice, label))
    return () =>
      setLabels((previous) => {
        const next = new Map(previous)
        next.delete(choice)
        return next
      })
  }, [])

  const selected = quiz?.selections[question] ?? null
  const checked = quiz?.checked ?? false
  const selectInQuiz = quiz?.select
  const select = useCallback(
    (choice: string) => selectInQuiz?.(question, choice),
    [selectInQuiz, question],
  )
  const value = useMemo(
    () => ({ name: question, selected, checked, select, registerLabel }),
    [question, selected, checked, select, registerLabel],
  )

  const correct = selected === answer
  const Icon = correct ? CircleCheck : CircleX
  return (
    <QuestionContext value={value}>
      <fieldset data-slot="question" disabled={checked} className="min-w-0 space-y-3">
        <legend className="mb-3 font-semibold">{prompt}</legend>
        <div className="space-y-2">{children}</div>
        {checked && (
          // A <div>, not a <p>: the answer may be a paragraph-form choice (block content).
          <div
            data-slot="quiz-feedback"
            className={cn(
              'flex items-start gap-2 font-medium',
              correct ? 'text-success' : 'text-danger',
            )}
          >
            <Icon aria-hidden="true" strokeWidth={1.75} className="mt-0.5 size-5 shrink-0" />
            <div className="min-w-0">
              {correct
                ? copy.correct
                : fillNode(
                    copy.incorrect,
                    '{answer}',
                    <div className="inline-block max-w-full space-y-1">
                      {labels.get(answer) ?? answer}
                    </div>,
                  )}
            </div>
          </div>
        )}
      </fieldset>
    </QuestionContext>
  )
}

/**
 * `<Choice id>` — a native radio on a ≥ 44 px card: arrow keys move within its question (one radio
 * group per question), and the checked state shows on the radio itself, not colour alone. The
 * content may be paragraphs, which a `<label>` cannot hold (phrasing content only), so the radio
 * is named by the content (`aria-labelledby`) and an empty `<label>` stretched over the card makes
 * the whole card the click target.
 */
function Choice({ id, children }: { id: string; children?: ReactNode }) {
  const question = use(QuestionContext)
  const registerLabel = question?.registerLabel
  const inputId = useId()
  const contentId = useId()
  useEffect(() => registerLabel?.(id, children), [registerLabel, id, children])
  if (question === null) return <div>{children}</div>
  return (
    <div
      data-slot="choice"
      className="relative flex min-h-11 items-center gap-3 rounded-md border border-border-strong bg-surface px-3 py-2 transition-colors duration-(--duration-fast) ease-standard has-checked:border-primary has-checked:bg-primary-soft"
    >
      <input
        id={inputId}
        type="radio"
        name={question.name}
        value={id}
        checked={question.selected === id}
        onChange={() => question.select(id)}
        aria-labelledby={contentId}
        className="peer relative z-10 size-4 shrink-0 cursor-pointer accent-primary disabled:cursor-default"
      />
      <div id={contentId} className="min-w-0 flex-1 space-y-2">
        {children}
      </div>
      <label
        htmlFor={inputId}
        className="absolute inset-0 cursor-pointer rounded-md peer-disabled:cursor-default"
      />
    </div>
  )
}

export { Choice, Question, Quiz }
