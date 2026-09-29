from typing import List


class Solution:
    def searchMatrix(self, matrix: List[List[int]], target: int) -> bool:
        rows, cols = len(matrix), len(matrix[0])
        # Read row by row, the matrix is one sorted array of rows * cols values:
        # binary search over that virtual array, index i sits at (i // cols, i % cols).
        low, high = 0, rows * cols - 1
        while low <= high:
            middle = (low + high) // 2
            value = matrix[middle // cols][middle % cols]
            if value == target:
                return True
            if value < target:
                low = middle + 1
            else:
                high = middle - 1
        return False
