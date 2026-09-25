package main

func dailyTemperatures(temperatures []int) []int {
	answer := make([]int, len(temperatures))
	// Indices of days still waiting for a warmer day; their temperatures never increase
	// from bottom to top.
	waiting := []int{}
	for day, temp := range temperatures {
		for len(waiting) > 0 && temperatures[waiting[len(waiting)-1]] < temp {
			earlier := waiting[len(waiting)-1]
			waiting = waiting[:len(waiting)-1]
			answer[earlier] = day - earlier
		}
		waiting = append(waiting, day)
	}
	return answer
}
