package main

func searchMatrix(matrix [][]int, target int) bool {
	rows, cols := len(matrix), len(matrix[0])
	// Read row by row, the matrix is one sorted array of rows * cols values:
	// binary search over that virtual array, index i sits at (i / cols, i % cols).
	low, high := 0, rows*cols-1
	for low <= high {
		middle := low + (high-low)/2
		value := matrix[middle/cols][middle%cols]
		if value == target {
			return true
		}
		if value < target {
			low = middle + 1
		} else {
			high = middle - 1
		}
	}
	return false
}
