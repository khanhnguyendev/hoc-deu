package main

func isAnagram(s string, t string) bool {
	if len(s) != len(t) {
		return false
	}
	// counts[i]: occurrences of letter i in s minus those in t
	var counts [26]int
	for i := 0; i < len(s); i++ {
		counts[s[i]-'a']++
		counts[t[i]-'a']--
	}
	for _, count := range counts {
		if count != 0 {
			return false
		}
	}
	return true
}
