class Solution {
    public boolean searchMatrix(int[][] matrix, int target) {
        int rows = matrix.length;
        int cols = matrix[0].length;
        // Read row by row, the matrix is one sorted array of rows * cols values:
        // binary search over that virtual array, index i sits at (i / cols, i % cols).
        int low = 0;
        int high = rows * cols - 1;
        while (low <= high) {
            int middle = low + (high - low) / 2;
            int value = matrix[middle / cols][middle % cols];
            if (value == target) {
                return true;
            }
            if (value < target) {
                low = middle + 1;
            } else {
                high = middle - 1;
            }
        }
        return false;
    }
}
