from typing import List


class Solution:
    def maxProfit(self, prices: List[int]) -> int:
        # One pass: remember the cheapest day so far and try selling on each day.
        cheapest = prices[0]
        best = 0
        for price in prices:
            cheapest = min(cheapest, price)
            best = max(best, price - cheapest)
        return best
