from typing import List


class Solution:
    def combinationSum(self, candidates: List[int], target: int) -> List[List[int]]:
        # Backtracking over sorted candidates: from index `start` on, so each combination is built
        # once (non-decreasing); the same index may repeat because a candidate can be reused.
        candidates = sorted(candidates)
        result: List[List[int]] = []
        current: List[int] = []

        def backtrack(start: int, remaining: int) -> None:
            if remaining == 0:
                result.append(current.copy())
                return
            for i in range(start, len(candidates)):
                if candidates[i] > remaining:
                    break  # sorted: every later candidate is larger too
                current.append(candidates[i])
                backtrack(i, remaining - candidates[i])
                current.pop()

        backtrack(0, target)
        return result
