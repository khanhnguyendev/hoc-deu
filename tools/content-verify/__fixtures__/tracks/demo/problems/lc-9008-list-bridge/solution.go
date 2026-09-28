package main

func keepLonger(words []string, minLength int) []string {
	kept := []string{}
	for _, word := range words {
		if len(word) >= minLength {
			kept = append(kept, word)
		}
	}
	return kept
}
