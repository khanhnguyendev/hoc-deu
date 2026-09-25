from typing import List


class Solution:
    def maxArea(self, height: List[int]) -> int:
        # Start with the widest container; only moving the shorter wall inward can find a taller
        # limit, so move that one each step.
        left, right = 0, len(height) - 1
        best = 0
        while left < right:
            best = max(best, min(height[left], height[right]) * (right - left))
            if height[left] < height[right]:
                left += 1
            else:
                right -= 1
        return best
