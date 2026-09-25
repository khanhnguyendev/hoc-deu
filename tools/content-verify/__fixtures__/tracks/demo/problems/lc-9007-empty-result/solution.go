package main

func evens(nums []int) []int {
	var result []int // stays nil when nothing matches: the harness must still print [] (fix 8)
	for _, value := range nums {
		if value%2 == 0 {
			result = append(result, value)
		}
	}
	return result
}
