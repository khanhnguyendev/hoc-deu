import java.util.*;

class Solution {
    public boolean isValidSudoku(char[][] board) {
        // rows[r][d] is true once digit d + 1 has appeared in row r; the same for columns and boxes.
        boolean[][] rows = new boolean[9][9];
        boolean[][] cols = new boolean[9][9];
        boolean[][] boxes = new boolean[9][9];
        for (int r = 0; r < 9; r++) {
            for (int c = 0; c < 9; c++) {
                char cell = board[r][c];
                if (cell == '.') {
                    continue;
                }
                int d = cell - '1';
                int b = (r / 3) * 3 + c / 3; // boxes are numbered 0..8, row by row
                if (rows[r][d] || cols[c][d] || boxes[b][d]) {
                    return false;
                }
                rows[r][d] = cols[c][d] = boxes[b][d] = true;
            }
        }
        return true;
    }
}
