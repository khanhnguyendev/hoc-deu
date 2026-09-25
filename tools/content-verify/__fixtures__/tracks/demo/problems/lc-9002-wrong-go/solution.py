from typing import Dict, List


class Solution:
    def groupByLength(self, words: List[str]) -> List[List[str]]:
        groups: Dict[int, List[str]] = {}
        for word in words:
            groups.setdefault(len(word), []).append(word)
        return list(groups.values())
