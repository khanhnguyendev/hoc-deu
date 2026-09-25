package main

func containsDuplicate(nums []int) bool {
	seen := make(map[int]bool, len(nums))
	for _, num := range nums {
		if seen[num] {
			return true // met this value before
		}
		seen[num] = true
	}
	return false
}
