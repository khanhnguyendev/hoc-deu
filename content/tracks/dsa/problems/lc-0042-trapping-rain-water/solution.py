from typing import List


class Solution:
    def trap(self, height: List[int]) -> int:
        # Two pointers: the side with the lower wall so far is bounded by that wall, so its water
        # can be counted and the pointer moved inward.
        left, right = 0, len(height) - 1
        left_max = right_max = 0
        water = 0
        while left < right:
            if height[left] < height[right]:
                left_max = max(left_max, height[left])
                water += left_max - height[left]
                left += 1
            else:
                right_max = max(right_max, height[right])
                water += right_max - height[right]
                right -= 1
        return water
