from typing import List


class Solution:
    def permute(self, nums: List[int]) -> List[List[int]]:
        # Backtracking: fill positions left to right with every number not used yet.
        result: List[List[int]] = []
        current: List[int] = []
        used = [False] * len(nums)

        def backtrack() -> None:
            if len(current) == len(nums):
                result.append(current.copy())
                return
            for i, num in enumerate(nums):
                if used[i]:
                    continue
                used[i] = True
                current.append(num)
                backtrack()
                current.pop()
                used[i] = False

        backtrack()
        return result
