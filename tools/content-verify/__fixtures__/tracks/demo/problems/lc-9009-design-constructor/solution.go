package main

type Counter struct {
	total int
	added map[int]bool // nil in a struct literal: only Constructor makes it usable
}

func Constructor(start int) Counter {
	return Counter{total: start, added: map[int]bool{}}
}

func (this *Counter) Add(n int) int {
	this.added[n] = true
	this.total += n
	return this.total
}

func (this *Counter) Seen(n int) bool {
	return this.added[n]
}
