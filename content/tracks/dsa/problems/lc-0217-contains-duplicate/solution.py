from typing import List, Set


class Solution:
    def containsDuplicate(self, nums: List[int]) -> bool:
        seen: Set[int] = set()
        for num in nums:
            if num in seen:
                return True  # met this value before
            seen.add(num)
        return False
