/**
 * What content:build and the catalog would give the /dev/content samples (task 3.3b): the code
 * bundle (hand-written highlighting — no shiki at runtime) and a practice resolver.
 * `fixtures.test.ts` keeps them in step with the samples.
 */
import type { MdxBindings, PracticeTarget } from '@/features/items/mdx/bind'
import { codeBlockKey, type HighlightedCode } from '@/lib/content/code-tokens'
import { GO_SAMPLE, JAVA_SAMPLE, PYTHON_SAMPLE } from '../components/code-samples'

/** The sample lesson's fenced block, as written in sample-lesson.mdx. */
const LESSON_CODE = `def pair_sum(numbers: list[int], target: int) -> list[int]:
    left, right = 0, len(numbers) - 1
    while left < right:
        total = numbers[left] + numbers[right]
        if total == target:
            return [left, right]
        if total < target:
            left += 1  # the sum must grow
        else:
            right -= 1
    return []`

/** `LESSON_CODE` as tools/content/highlight.ts highlights it. */
const LESSON_CODE_HIGHLIGHTED: HighlightedCode = {
  lang: 'python',
  lines: [
    [
      ['def', 'keyword'],
      ' pair_sum(numbers: list[',
      ['int', 'constant'],
      '], target: ',
      ['int', 'constant'],
      ') -> list[',
      ['int', 'constant'],
      ']:',
    ],
    [
      '    left, right ',
      ['=', 'keyword'],
      ' ',
      ['0', 'constant'],
      ', len(numbers) ',
      ['-', 'keyword'],
      ' ',
      ['1', 'constant'],
    ],
    ['    ', ['while', 'keyword'], ' left ', ['<', 'keyword'], ' right:'],
    ['        total ', ['=', 'keyword'], ' numbers[left] ', ['+', 'keyword'], ' numbers[right]'],
    ['        ', ['if', 'keyword'], ' total ', ['==', 'keyword'], ' target:'],
    ['            ', ['return', 'keyword'], ' [left, right]'],
    ['        ', ['if', 'keyword'], ' total ', ['<', 'keyword'], ' target:'],
    [
      '            left ',
      ['+=', 'keyword'],
      ' ',
      ['1', 'constant'],
      '  ',
      ['# the sum must grow', 'comment'],
    ],
    ['        ', ['else', 'keyword'], ':'],
    ['            right ', ['-=', 'keyword'], ' ', ['1', 'constant']],
    ['    ', ['return', 'keyword'], ' []'],
  ],
}

const PRACTICE: Readonly<Record<string, PracticeTarget>> = {
  'dsa:lc-0015': { title: '3Sum', href: '/t/dsa/items/lc-0015', leetcode: 15, difficulty: 'M' },
}

export const SAMPLE_BINDINGS: MdxBindings = {
  code: {
    solutions: { python: PYTHON_SAMPLE, java: JAVA_SAMPLE, go: GO_SAMPLE },
    blocks: { [codeBlockKey('python', LESSON_CODE)]: LESSON_CODE_HIGHLIGHTED },
  },
  codeLanguage: 'python',
  resolvePractice: (itemId) => (Object.hasOwn(PRACTICE, itemId) ? PRACTICE[itemId]! : null),
}
