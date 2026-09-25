import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createHighlighter, type Highlighter } from './highlight'

const PYTHON_SOLUTION = `class Solution:
    def twoSum(self, nums, target):
        seen = {}
        for i, n in enumerate(nums):
            # index of the complement, if we have already seen it
            if target - n in seen:
                return [seen[target - n], i]
            seen[n] = i
        return []
`

const JAVA_SOLUTION = `import java.util.*;

class Solution {
    public int[] twoSum(int[] nums, int target) {
        Map<Integer, Integer> seen = new HashMap<>();
        String msg = "x";
        for (int i = 0; i < nums.length; i++) {
            if (seen.containsKey(target - nums[i])) {
                return new int[] { seen.get(target - nums[i]), i };
            }
            seen.put(nums[i], i);
        }
        return new int[0];
    }
}
`

const GO_SOLUTION = `package solution

func twoSum(nums []int, target int) []int {
	seen := map[int]int{}
	for i, n := range nums {
		if j, ok := seen[target-n]; ok {
			return []int{j, i}
		}
		seen[n] = i
	}
	return []int{}
}
`

/** Every plain-text run and every [text, kind] run in a HighlightedCode, flattened. */
function allRuns(lines: readonly (readonly (string | readonly [string, string])[])[]) {
  return lines.flat()
}

function keywords(lines: readonly (readonly (string | readonly [string, string])[])[]) {
  return allRuns(lines)
    .filter((run): run is readonly [string, string] => Array.isArray(run) && run[1] === 'keyword')
    .map((run) => run[0])
}

describe('createHighlighter', () => {
  let highlighter: Highlighter

  beforeAll(async () => {
    highlighter = await createHighlighter()
  })

  afterAll(() => {
    highlighter.dispose()
  })

  it('marks Python keywords class, def, for, return and a comment run starting with #', () => {
    const code = highlighter.highlight(PYTHON_SOLUTION, 'python')
    expect(code.lang).toBe('python')
    const runs = allRuns(code.lines)
    const kw = keywords(code.lines)
    expect(kw).toEqual(expect.arrayContaining(['class', 'def', 'for', 'return']))
    const comment = runs.find(
      (run): run is readonly [string, string] => Array.isArray(run) && run[1] === 'comment',
    )
    expect(comment?.[0].startsWith('#')).toBe(true)
  })

  it('marks Java keywords public, new, return and "x" as a string', () => {
    const code = highlighter.highlight(JAVA_SOLUTION, 'java')
    const kw = keywords(code.lines)
    expect(kw).toEqual(expect.arrayContaining(['public', 'new', 'return']))
    const runs = allRuns(code.lines)
    const stringRun = runs.find(
      (run): run is readonly [string, string] => Array.isArray(run) && run[1] === 'string',
    )
    expect(stringRun?.[0]).toBe('"x"')
  })

  it('marks Go keywords func and return', () => {
    const code = highlighter.highlight(GO_SOLUTION, 'go')
    const kw = keywords(code.lines)
    expect(kw).toEqual(expect.arrayContaining(['func', 'return']))
  })

  it('never places two adjacent runs of the same kind (plain runs merge too)', () => {
    for (const [source, lang] of [
      [PYTHON_SOLUTION, 'python'],
      [JAVA_SOLUTION, 'java'],
      [GO_SOLUTION, 'go'],
    ] as const) {
      const code = highlighter.highlight(source, lang)
      for (const line of code.lines) {
        for (let i = 1; i < line.length; i++) {
          const prev = line[i - 1]
          const cur = line[i]
          const prevKind = Array.isArray(prev) ? prev[1] : 'plain'
          const curKind = Array.isArray(cur) ? cur[1] : 'plain'
          expect(curKind).not.toBe(prevKind)
        }
      }
    }
  })

  it('treats lang "text" as plain code, no highlighting', () => {
    const code = highlighter.highlight('x = 1\n', 'text')
    expect(code).toEqual({ lang: 'text', lines: [['x = 1']] })
  })

  it('throws on an unsupported language', () => {
    expect(() => highlighter.highlight('fn main() {}', 'rust')).toThrow(
      'unsupported language: rust',
    )
  })

  it('highlights 300 snippets in under 3s (the highlighter is created once, not per call)', () => {
    const cases: Array<{ source: string; lang: string }> = [
      { source: PYTHON_SOLUTION, lang: 'python' },
      { source: JAVA_SOLUTION, lang: 'java' },
      { source: GO_SOLUTION, lang: 'go' },
    ]
    const start = performance.now()
    for (let i = 0; i < 300; i++) {
      const { source, lang } = cases[i % 3]!
      highlighter.highlight(source, lang)
    }
    expect(performance.now() - start).toBeLessThan(3000)
  })
})
