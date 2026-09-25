package main

func twoSum(numbers []int, target int) []int {
	// The array is sorted: a sum that is too small moves the left end up, too large moves the
	// right end down. The answer is 1-indexed.
	left, right := 0, len(numbers)-1
	for left < right {
		total := numbers[left] + numbers[right]
		if total == target {
			return []int{left + 1, right + 1}
		}
		if total < target {
			left++
		} else {
			right--
		}
	}
	return []int{}
}
