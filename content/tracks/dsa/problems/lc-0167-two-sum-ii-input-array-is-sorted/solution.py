from typing import List


class Solution:
    def twoSum(self, numbers: List[int], target: int) -> List[int]:
        # The array is sorted: a sum that is too small moves the left end up, too large moves the
        # right end down. The answer is 1-indexed.
        left, right = 0, len(numbers) - 1
        while left < right:
            total = numbers[left] + numbers[right]
            if total == target:
                return [left + 1, right + 1]
            if total < target:
                left += 1
            else:
                right -= 1
        return []
