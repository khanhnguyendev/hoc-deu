from typing import List


class Solution:
    def characterReplacement(self, s: str, k: int) -> int:
        # Sliding window: the window is valid while (length - count of its most frequent letter)
        # <= k. The best count seen so far never needs to shrink: only a larger count can give a
        # longer answer.
        counts: List[int] = [0] * 26
        left = 0
        top = 0
        best = 0
        for right, char in enumerate(s):
            index = ord(char) - ord("A")
            counts[index] += 1
            top = max(top, counts[index])
            while right - left + 1 - top > k:
                counts[ord(s[left]) - ord("A")] -= 1
                left += 1
            best = max(best, right - left + 1)
        return best
