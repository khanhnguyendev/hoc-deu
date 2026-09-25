package main

func longestConsecutive(nums []int) int {
	values := make(map[int]bool, len(nums))
	for _, num := range nums {
		values[num] = true
	}
	longest := 0
	for num := range values {
		if values[num-1] {
			continue // not the start of a run: its run is counted from the smallest value
		}
		length := 1
		for values[num+length] {
			length++
		}
		longest = max(longest, length)
	}
	return longest
}
