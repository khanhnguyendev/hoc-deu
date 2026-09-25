from typing import List


class Solution:
    def largestRectangleArea(self, heights: List[int]) -> int:
        best = 0
        # Indices of bars whose heights never decrease from bottom to top.
        rising: List[int] = []
        # A final bar of height 0 flushes every bar still on the stack.
        for i in range(len(heights) + 1):
            current = heights[i] if i < len(heights) else 0
            while rising and heights[rising[-1]] >= current:
                height = heights[rising.pop()]
                # The popped bar extends right to i - 1 and left to just after the new top.
                left = rising[-1] + 1 if rising else 0
                best = max(best, height * (i - left))
            rising.append(i)
        return best
