package main

import "sort"

func combinationSum(candidates []int, target int) [][]int {
	// Backtracking over sorted candidates: from index start on, so each combination is built
	// once (non-decreasing); the same index may repeat because a candidate can be reused.
	sorted := append([]int{}, candidates...)
	sort.Ints(sorted)
	result := [][]int{}
	current := []int{}
	var backtrack func(start, remaining int)
	backtrack = func(start, remaining int) {
		if remaining == 0 {
			result = append(result, append([]int{}, current...))
			return
		}
		for i := start; i < len(sorted); i++ {
			if sorted[i] > remaining {
				break // sorted: every later candidate is larger too
			}
			current = append(current, sorted[i])
			backtrack(i, remaining-sorted[i])
			current = current[:len(current)-1]
		}
	}
	backtrack(0, target)
	return result
}
