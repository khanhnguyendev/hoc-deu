/**
 * Hand-written `HighlightedCode` fixtures for the `CodeBlock` catalog entry (task 3.3a). This
 * module is imported by the `/dev/components` catalog, a client module — it must not import
 * `shiki` (build-time only, tools/content/highlight.ts) or `lib/content` (server-only).
 */
import type { HighlightedCode } from '@/components/patterns/code-block'

export const PYTHON_SAMPLE: HighlightedCode = {
  lang: 'python',
  lines: [
    [['class', 'keyword'], ' Solution:'],
    ['    ', ['def', 'keyword'], ' twoSum(self, nums, target):'],
    ['        seen = ', ['{}', 'constant']],
    ['        ', ['for', 'keyword'], ' i, n ', ['in', 'keyword'], ' enumerate(nums):'],
    ['            ', ['# complement already seen?', 'comment']],
    ['            ', ['if', 'keyword'], ' target - n ', ['in', 'keyword'], ' seen:'],
    ['                ', ['return', 'keyword'], ' [seen[target - n], i]'],
    ['            seen[n] = i'],
    ['        ', ['return', 'keyword'], ' []'],
  ],
}

export const JAVA_SAMPLE: HighlightedCode = {
  lang: 'java',
  lines: [
    ['import java.util.*;'],
    [],
    [['class', 'keyword'], ' Solution {'],
    ['    ', ['public', 'keyword'], ' int[] twoSum(int[] nums, int target) {'],
    ['        Map<Integer, Integer> seen = ', ['new', 'keyword'], ' HashMap<>();'],
    ['        String hint = ', ['"cần gợi ý"', 'string'], ';'],
    ['        ', ['for', 'keyword'], ' (int i = ', ['0', 'constant'], '; i < nums.length; i++) {'],
    ['            ', ['if', 'keyword'], ' (seen.containsKey(target - nums[i])) {'],
    [
      '                ',
      ['return', 'keyword'],
      ' ',
      ['new', 'keyword'],
      ' int[] { seen.get(target - nums[i]), i };',
    ],
    ['            }'],
    ['            seen.put(nums[i], i);'],
    ['        }'],
    ['        ', ['return', 'keyword'], ' ', ['new', 'keyword'], ' int[0];'],
    ['    }'],
    ['}'],
  ],
}

export const GO_SAMPLE: HighlightedCode = {
  lang: 'go',
  lines: [
    [['package', 'keyword'], ' solution'],
    [],
    [['func', 'keyword'], ' twoSum(nums []int, target int) []int {'],
    ['\tseen := map[int]int{}'],
    ['\t', ['for', 'keyword'], ' i, n := ', ['range', 'keyword'], ' nums {'],
    ['\t\t', ['if', 'keyword'], ' j, ok := seen[target-n]; ok {'],
    ['\t\t\t', ['return', 'keyword'], ' []int{j, i}'],
    ['\t\t}'],
    ['\t\tseen[n] = i'],
    ['\t}'],
    ['\t', ['return', 'keyword'], ' []int{}'],
    ['}'],
  ],
}

/** A single very long plain line, so the catalog can show the region's horizontal scroll. */
export const LONG_LINE_SAMPLE: HighlightedCode = {
  lang: 'text',
  lines: [
    [
      'seen = {nums[i]: i for i in range(len(nums)) if nums[i] not in seen and (target - nums[i]) not in seen}  # một dòng rất dài để kiểm tra cuộn ngang của vùng mã nguồn',
    ],
  ],
}
