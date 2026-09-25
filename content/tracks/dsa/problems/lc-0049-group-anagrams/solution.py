from typing import Dict, List, Tuple


class Solution:
    def groupAnagrams(self, strs: List[str]) -> List[List[str]]:
        # Anagrams share the same letter counts, so the 26 counts are the group key.
        groups: Dict[Tuple[int, ...], List[str]] = {}
        for word in strs:
            counts = [0] * 26
            for ch in word:
                counts[ord(ch) - ord("a")] += 1
            groups.setdefault(tuple(counts), []).append(word)
        return list(groups.values())
