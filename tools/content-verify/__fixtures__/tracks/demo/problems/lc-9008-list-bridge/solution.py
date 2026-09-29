from typing import List


class Solution:
    def keepLonger(self, words: List[str], minLength: int) -> List[str]:
        return [word for word in words if len(word) >= minLength]
