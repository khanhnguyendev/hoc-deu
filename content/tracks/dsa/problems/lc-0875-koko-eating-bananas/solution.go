package main

func minEatingSpeed(piles []int, h int) int {
	// The answer lies in [1, max(piles)]: eating faster than the largest pile saves nothing.
	lo, hi := 1, 1
	for _, pile := range piles {
		hi = max(hi, pile)
	}
	for lo < hi {
		mid := lo + (hi-lo)/2
		if hoursAt(piles, mid) <= h {
			hi = mid // mid is fast enough; a slower speed might be too
		} else {
			lo = mid + 1
		}
	}
	return lo
}

func hoursAt(piles []int, speed int) int {
	// Each pile takes ceil(pile / speed) hours.
	hours := 0
	for _, pile := range piles {
		hours += (pile + speed - 1) / speed
	}
	return hours
}
