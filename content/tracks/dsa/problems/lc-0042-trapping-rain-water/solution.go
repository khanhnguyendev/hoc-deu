package main

func trap(height []int) int {
	// Two pointers: the side with the lower wall so far is bounded by that wall, so its water
	// can be counted and the pointer moved inward.
	left, right := 0, len(height)-1
	leftMax, rightMax := 0, 0
	water := 0
	for left < right {
		if height[left] < height[right] {
			leftMax = max(leftMax, height[left])
			water += leftMax - height[left]
			left++
		} else {
			rightMax = max(rightMax, height[right])
			water += rightMax - height[right]
			right--
		}
	}
	return water
}
