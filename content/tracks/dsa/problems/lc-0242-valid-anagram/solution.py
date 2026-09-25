from typing import List


class Solution:
    def isAnagram(self, s: str, t: str) -> bool:
        if len(s) != len(t):
            return False
        # counts[i]: occurrences of letter i in s minus those in t
        counts: List[int] = [0] * 26
        for a, b in zip(s, t):
            counts[ord(a) - ord("a")] += 1
            counts[ord(b) - ord("a")] -= 1
        return all(count == 0 for count in counts)
