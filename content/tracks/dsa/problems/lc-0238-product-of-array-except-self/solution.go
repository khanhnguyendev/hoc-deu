package main

func productExceptSelf(nums []int) []int {
	n := len(nums)
	answer := make([]int, n)
	// First pass: answer[i] = product of everything left of i.
	answer[0] = 1
	for i := 1; i < n; i++ {
		answer[i] = answer[i-1] * nums[i-1]
	}
	// Second pass: multiply in the product of everything right of i.
	right := 1
	for i := n - 1; i >= 0; i-- {
		answer[i] *= right
		right *= nums[i]
	}
	return answer
}
