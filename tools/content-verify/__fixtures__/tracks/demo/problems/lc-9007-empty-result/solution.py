from typing import List


class Solution:
    def evens(self, nums: List[int]) -> List[int]:
        return [value for value in nums if value % 2 == 0]
