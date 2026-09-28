package main

func subsets(nums []int) [][]int {
	// Backtracking: at each index, either take nums[i] or skip it; every leaf is a subset.
	result := [][]int{}
	current := []int{}
	var backtrack func(i int)
	backtrack = func(i int) {
		if i == len(nums) {
			result = append(result, append([]int{}, current...))
			return
		}
		current = append(current, nums[i])
		backtrack(i + 1)
		current = current[:len(current)-1]
		backtrack(i + 1)
	}
	backtrack(0)
	return result
}
