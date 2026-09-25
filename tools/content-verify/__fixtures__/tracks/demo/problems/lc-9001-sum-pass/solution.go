package main

func sumList(nums []int) int {
	total := 0
	for _, value := range nums {
		total += value
	}
	return total
}
