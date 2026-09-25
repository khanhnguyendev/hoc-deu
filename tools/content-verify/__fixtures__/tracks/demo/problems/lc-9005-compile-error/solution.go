package main

func weightedSum(values []float64, weight int64) float64 {
	total := 0.0
	for _, value := range values {
		total += value
	}
	return total * float64(weight)
}
