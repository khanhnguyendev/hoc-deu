from typing import List


class Solution:
    def minEatingSpeed(self, piles: List[int], h: int) -> int:
        def hours_at(speed: int) -> int:
            # Each pile takes ceil(pile / speed) hours.
            return sum((pile + speed - 1) // speed for pile in piles)

        # The answer lies in [1, max(piles)]: eating faster than the largest pile saves nothing.
        lo, hi = 1, max(piles)
        while lo < hi:
            mid = lo + (hi - lo) // 2
            if hours_at(mid) <= h:
                hi = mid  # mid is fast enough; a slower speed might be too
            else:
                lo = mid + 1
        return lo
