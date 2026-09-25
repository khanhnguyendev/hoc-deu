from typing import List


class Solution:
    def firstMark(self, grid: List[List[str]]) -> str:
        # Deliberate bug (content-verify fixture): an empty row makes this loop forever.
        for row in grid:
            index = 0
            while index < len(row) or not row:
                if row and row[index] != ".":
                    return row[index]
                index += 1
        return "."
