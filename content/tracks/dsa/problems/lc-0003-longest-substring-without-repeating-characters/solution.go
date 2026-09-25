package main

func lengthOfLongestSubstring(s string) int {
	// Sliding window: remember where each character was last seen; a repeat inside the window
	// moves the left edge just past it (never backwards).
	lastSeen := map[byte]int{}
	left := 0
	best := 0
	for right := 0; right < len(s); right++ {
		c := s[right]
		if previous, ok := lastSeen[c]; ok && previous >= left {
			left = previous + 1
		}
		lastSeen[c] = right
		best = max(best, right-left+1)
	}
	return best
}
