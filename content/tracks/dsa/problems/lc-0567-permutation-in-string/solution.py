from typing import List


class Solution:
    def checkInclusion(self, s1: str, s2: str) -> bool:
        # Fixed-size sliding window over s2: compare its letter counts with s1's counts, adding the
        # letter that enters and removing the one that leaves at each step.
        if len(s1) > len(s2):
            return False
        need: List[int] = [0] * 26
        window: List[int] = [0] * 26
        for char in s1:
            need[ord(char) - ord("a")] += 1
        for right, char in enumerate(s2):
            window[ord(char) - ord("a")] += 1
            if right >= len(s1):
                window[ord(s2[right - len(s1)]) - ord("a")] -= 1
            if window == need:
                return True
        return False
