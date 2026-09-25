package main

func findMin(nums []int) int {
	// The minimum always lies in nums[lo..hi]; compare the middle with the right end.
	lo, hi := 0, len(nums)-1
	for lo < hi {
		mid := lo + (hi-lo)/2
		if nums[mid] > nums[hi] {
			lo = mid + 1 // the drop is right of mid
		} else {
			hi = mid // nums[mid..hi] is sorted, so mid may be the minimum
		}
	}
	return nums[lo]
}
