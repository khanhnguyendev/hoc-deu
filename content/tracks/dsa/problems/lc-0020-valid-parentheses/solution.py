from typing import List


class Solution:
    def isValid(self, s: str) -> bool:
        # Each closing bracket must match the most recent unmatched opening bracket.
        opener = {")": "(", "]": "[", "}": "{"}
        stack: List[str] = []
        for ch in s:
            if ch in opener:
                if not stack or stack[-1] != opener[ch]:
                    return False
                stack.pop()
            else:
                stack.append(ch)
        # Anything left open was never closed.
        return not stack
