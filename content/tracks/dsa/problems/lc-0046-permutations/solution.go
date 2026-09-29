package main

func permute(nums []int) [][]int {
	// Backtracking: fill positions left to right with every number not used yet.
	result := [][]int{}
	current := []int{}
	used := make([]bool, len(nums))
	var backtrack func()
	backtrack = func() {
		if len(current) == len(nums) {
			result = append(result, append([]int{}, current...))
			return
		}
		for i, num := range nums {
			if used[i] {
				continue
			}
			used[i] = true
			current = append(current, num)
			backtrack()
			current = current[:len(current)-1]
			used[i] = false
		}
	}
	backtrack()
	return result
}
