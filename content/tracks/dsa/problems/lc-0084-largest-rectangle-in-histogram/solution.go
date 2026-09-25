package main

func largestRectangleArea(heights []int) int {
	best := 0
	// Indices of bars whose heights never decrease from bottom to top.
	rising := []int{}
	// A final bar of height 0 flushes every bar still on the stack.
	for i := 0; i <= len(heights); i++ {
		current := 0
		if i < len(heights) {
			current = heights[i]
		}
		for len(rising) > 0 && heights[rising[len(rising)-1]] >= current {
			height := heights[rising[len(rising)-1]]
			rising = rising[:len(rising)-1]
			// The popped bar extends right to i - 1 and left to just after the new top.
			left := 0
			if len(rising) > 0 {
				left = rising[len(rising)-1] + 1
			}
			best = max(best, height*(i-left))
		}
		rising = append(rising, i)
	}
	return best
}
