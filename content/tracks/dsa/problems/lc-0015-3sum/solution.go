package main

import "sort"

func threeSum(nums []int) [][]int {
	// Sort, fix the smallest number, then find the other two with two pointers. Skipping equal
	// neighbours keeps every triplet unique.
	sorted := append([]int(nil), nums...)
	sort.Ints(sorted)
	result := [][]int{}
	for i := 0; i < len(sorted)-2; i++ {
		if sorted[i] > 0 {
			break
		}
		if i > 0 && sorted[i] == sorted[i-1] {
			continue
		}
		left, right := i+1, len(sorted)-1
		for left < right {
			total := sorted[i] + sorted[left] + sorted[right]
			if total < 0 {
				left++
			} else if total > 0 {
				right--
			} else {
				result = append(result, []int{sorted[i], sorted[left], sorted[right]})
				left++
				right--
				for left < right && sorted[left] == sorted[left-1] {
					left++
				}
			}
		}
	}
	return result
}
