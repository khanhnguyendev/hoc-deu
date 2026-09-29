from typing import List


class Solution:
    def subsets(self, nums: List[int]) -> List[List[int]]:
        # Backtracking: at each index, either take nums[i] or skip it; every leaf is a subset.
        result: List[List[int]] = []
        current: List[int] = []

        def backtrack(i: int) -> None:
            if i == len(nums):
                result.append(current.copy())
                return
            current.append(nums[i])
            backtrack(i + 1)
            current.pop()
            backtrack(i + 1)

        backtrack(0)
        return result
