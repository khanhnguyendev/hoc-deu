from typing import List


class Solution:
    def sumList(self, nums: List[int]) -> int:
        total = 0
        for value in nums:
            total += value
        return total
