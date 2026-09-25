package main

// groupByLength has a deliberate bug (content-verify fixture): it skips empty words.
func groupByLength(words []string) [][]string {
	groups := map[int][]string{}
	order := []int{}
	for _, word := range words {
		if word == "" {
			continue
		}
		if _, seen := groups[len(word)]; !seen {
			order = append(order, len(word))
		}
		groups[len(word)] = append(groups[len(word)], word)
	}
	result := [][]string{}
	for _, length := range order {
		result = append(result, groups[length])
	}
	return result
}
