from typing import List


class Solution:
    def reverse(self, nums: List[int]) -> None:
        left, right = 0, len(nums) - 1
        while left < right:
            nums[left], nums[right] = nums[right], nums[left]
            left += 1
            right -= 1
