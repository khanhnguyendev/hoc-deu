package main

func characterReplacement(s string, k int) int {
	// Sliding window: the window is valid while (length - count of its most frequent letter)
	// <= k. The best count seen so far never needs to shrink: only a larger count can give a
	// longer answer.
	var counts [26]int
	left, top, best := 0, 0, 0
	for right := 0; right < len(s); right++ {
		index := s[right] - 'A'
		counts[index]++
		top = max(top, counts[index])
		for right-left+1-top > k {
			counts[s[left]-'A']--
			left++
		}
		best = max(best, right-left+1)
	}
	return best
}
