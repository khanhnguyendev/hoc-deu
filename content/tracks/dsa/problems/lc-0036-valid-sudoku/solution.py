from typing import List


class Solution:
    def isValidSudoku(self, board: List[List[str]]) -> bool:
        # rows[r][d] is True once digit d + 1 has appeared in row r; the same for columns and boxes.
        rows = [[False] * 9 for _ in range(9)]
        cols = [[False] * 9 for _ in range(9)]
        boxes = [[False] * 9 for _ in range(9)]
        for r in range(9):
            for c in range(9):
                cell = board[r][c]
                if cell == ".":
                    continue
                d = int(cell) - 1
                b = (r // 3) * 3 + c // 3  # boxes are numbered 0..8, row by row
                if rows[r][d] or cols[c][d] or boxes[b][d]:
                    return False
                rows[r][d] = cols[c][d] = boxes[b][d] = True
        return True
