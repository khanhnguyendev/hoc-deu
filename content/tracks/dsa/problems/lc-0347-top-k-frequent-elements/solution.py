from typing import Dict, List


class Solution:
    def topKFrequent(self, nums: List[int], k: int) -> List[int]:
        counts: Dict[int, int] = {}
        for num in nums:
            counts[num] = counts.get(num, 0) + 1
        # buckets[f]: the values that appear exactly f times (f is at most len(nums))
        buckets: List[List[int]] = [[] for _ in range(len(nums) + 1)]
        for num, count in counts.items():
            buckets[count].append(num)
        result: List[int] = []
        for count in range(len(nums), 0, -1):  # most frequent first
            for num in buckets[count]:
                result.append(num)
                if len(result) == k:
                    return result
        return result
