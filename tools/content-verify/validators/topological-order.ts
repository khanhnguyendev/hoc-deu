/**
 * `topological-order` validator (platform design §3.7; used by 210 Course Schedule II). Several
 * orderings can satisfy the same prerequisites, so `exact`/`unordered` cannot check the result —
 * this validator instead checks that `actual` is *a* valid topological order of `input`, using
 * LeetCode's `[course, prerequisite]` pair convention.
 */
import type { Validator } from './index'

export const topologicalOrder: Validator = (input, actual, expected) => {
  const numCourses = input.numCourses
  const prerequisites = input.prerequisites
  if (typeof numCourses !== 'number' || !Array.isArray(prerequisites)) {
    return 'topological-order needs numCourses and prerequisites in the input'
  }
  if (!Array.isArray(actual)) return 'expected an array of course indices'
  if (!Array.isArray(expected)) return 'expected an array of course indices'

  // No valid ordering exists (a cycle): tests.yaml records this as an empty expected array, and
  // actual must match it exactly — there is nothing else to check a cycle result against.
  if (expected.length === 0) {
    return actual.length === 0
      ? true
      : 'expected no valid ordering (a cycle), but actual is non-empty'
  }

  if (actual.length !== numCourses) {
    return `expected ${numCourses} course(s), got ${actual.length}`
  }
  const position = new Map<unknown, number>()
  actual.forEach((course, index) => position.set(course, index))
  if (position.size !== numCourses) {
    return 'actual must list every course exactly once'
  }
  for (let course = 0; course < numCourses; course++) {
    if (!position.has(course)) return `course ${course} is missing from actual`
  }

  for (const pair of prerequisites) {
    if (!Array.isArray(pair) || pair.length !== 2) {
      return 'each prerequisite must be a [course, prerequisite] pair'
    }
    const [course, prerequisite] = pair as [unknown, unknown]
    const coursePosition = position.get(course)
    const prerequisitePosition = position.get(prerequisite)
    if (coursePosition === undefined || prerequisitePosition === undefined) {
      return `prerequisite pair [${String(course)}, ${String(prerequisite)}] references an unknown course`
    }
    if (prerequisitePosition >= coursePosition) {
      return `course ${String(prerequisite)} must come before course ${String(course)}`
    }
  }
  return true
}
