package main

func topKFrequent(nums []int, k int) []int {
	counts := map[int]int{}
	for _, num := range nums {
		counts[num]++
	}
	// buckets[f]: the values that appear exactly f times (f is at most len(nums))
	buckets := make([][]int, len(nums)+1)
	for num, count := range counts {
		buckets[count] = append(buckets[count], num)
	}
	result := make([]int, 0, k)
	for count := len(nums); count > 0; count-- { // most frequent first
		for _, num := range buckets[count] {
			result = append(result, num)
			if len(result) == k {
				return result
			}
		}
	}
	return result
}
