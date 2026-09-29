package main

import "container/heap"

// minHeap implements heap.Interface over ints, smallest on top.
type minHeap []int

func (h minHeap) Len() int           { return len(h) }
func (h minHeap) Less(i, j int) bool { return h[i] < h[j] }
func (h minHeap) Swap(i, j int)      { h[i], h[j] = h[j], h[i] }
func (h *minHeap) Push(x any)        { *h = append(*h, x.(int)) }
func (h *minHeap) Pop() any {
	old := *h
	last := old[len(old)-1]
	*h = old[:len(old)-1]
	return last
}

// KthLargest keeps a min-heap of the k largest values seen so far: its top is the k-th largest.
type KthLargest struct {
	k    int
	heap *minHeap
}

func Constructor(k int, nums []int) KthLargest {
	kth := KthLargest{k: k, heap: &minHeap{}}
	for _, num := range nums {
		kth.Add(num)
	}
	return kth
}

func (this *KthLargest) Add(val int) int {
	heap.Push(this.heap, val)
	if this.heap.Len() > this.k {
		heap.Pop(this.heap)
	}
	return (*this.heap)[0]
}
