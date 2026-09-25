from typing import Dict, List


class Solution:
    def twoSum(self, nums: List[int], target: int) -> List[int]:
        index_of: Dict[int, int] = {}  # value -> index, for the numbers already passed
        for i, num in enumerate(nums):
            complement = target - num
            if complement in index_of:
                return [index_of[complement], i]
            index_of[num] = i
        return []  # unreachable: the input always has exactly one answer
