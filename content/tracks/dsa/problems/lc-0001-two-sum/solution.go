package main

func twoSum(nums []int, target int) []int {
	indexOf := make(map[int]int, len(nums)) // value -> index, for the numbers already passed
	for i, num := range nums {
		complement := target - num
		if j, found := indexOf[complement]; found {
			return []int{j, i}
		}
		indexOf[num] = i
	}
	return nil // unreachable: the input always has exactly one answer
}
