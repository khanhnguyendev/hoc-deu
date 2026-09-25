from typing import Dict


class Solution:
    def lengthOfLongestSubstring(self, s: str) -> int:
        # Sliding window: remember where each character was last seen; a repeat inside the window
        # moves the left edge just past it (never backwards).
        last_seen: Dict[str, int] = {}
        left = 0
        best = 0
        for right, char in enumerate(s):
            if last_seen.get(char, -1) >= left:
                left = last_seen[char] + 1
            last_seen[char] = right
            best = max(best, right - left + 1)
        return best
