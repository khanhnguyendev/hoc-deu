import java.util.*;

class Solution {
    public char firstMark(char[][] grid) {
        for (char[] row : grid) {
            for (char cell : row) {
                if (cell != '.') {
                    return cell;
                }
            }
        }
        return '.';
    }
}
