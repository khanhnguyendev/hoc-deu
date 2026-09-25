from typing import List


class Solution:
    def longestConsecutive(self, nums: List[int]) -> int:
        values = set(nums)
        longest = 0
        for num in values:
            if num - 1 in values:
                continue  # not the start of a run: its run is counted from the smallest value
            length = 1
            while num + length in values:
                length += 1
            longest = max(longest, length)
        return longest
