package main

func maxProfit(prices []int) int {
	// One pass: remember the cheapest day so far and try selling on each day.
	cheapest := prices[0]
	best := 0
	for _, price := range prices {
		cheapest = min(cheapest, price)
		best = max(best, price-cheapest)
	}
	return best
}
