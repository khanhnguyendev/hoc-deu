package main

func groupAnagrams(strs []string) [][]string {
	// Anagrams share the same letter counts, so the 26 counts are the group key.
	groups := map[[26]int][]string{}
	for _, word := range strs {
		var counts [26]int
		for i := 0; i < len(word); i++ {
			counts[word[i]-'a']++
		}
		groups[counts] = append(groups[counts], word)
	}
	result := make([][]string, 0, len(groups))
	for _, group := range groups {
		result = append(result, group)
	}
	return result
}
