package main

func maxArea(height []int) int {
	// Start with the widest container; only moving the shorter wall inward can find a taller
	// limit, so move that one each step.
	left, right := 0, len(height)-1
	best := 0
	for left < right {
		best = max(best, min(height[left], height[right])*(right-left))
		if height[left] < height[right] {
			left++
		} else {
			right--
		}
	}
	return best
}
