package main

func checkInclusion(s1 string, s2 string) bool {
	// Fixed-size sliding window over s2: compare its letter counts with s1's counts, adding the
	// letter that enters and removing the one that leaves at each step.
	if len(s1) > len(s2) {
		return false
	}
	var need, window [26]int
	for i := 0; i < len(s1); i++ {
		need[s1[i]-'a']++
	}
	for right := 0; right < len(s2); right++ {
		window[s2[right]-'a']++
		if right >= len(s1) {
			window[s2[right-len(s1)]-'a']--
		}
		if window == need {
			return true
		}
	}
	return false
}
