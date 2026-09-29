package main

import "container/heap"

// farthestFirst is a max-heap of points by squared distance to the origin.
type farthestFirst [][]int

func squared(p []int) int { return p[0]*p[0] + p[1]*p[1] }

func (h farthestFirst) Len() int           { return len(h) }
func (h farthestFirst) Less(i, j int) bool { return squared(h[i]) > squared(h[j]) }
func (h farthestFirst) Swap(i, j int)      { h[i], h[j] = h[j], h[i] }
func (h *farthestFirst) Push(x any)        { *h = append(*h, x.([]int)) }
func (h *farthestFirst) Pop() any {
	old := *h
	last := old[len(old)-1]
	*h = old[:len(old)-1]
	return last
}

func kClosest(points [][]int, k int) [][]int {
	// A max-heap capped at size k keeps the k closest points seen so far.
	h := &farthestFirst{}
	for _, point := range points {
		heap.Push(h, point)
		if h.Len() > k {
			heap.Pop(h)
		}
	}
	return *h
}
