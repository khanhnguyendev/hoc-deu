package main

type Faulty struct {
	total  int
	values []int
}

func Constructor(start int) Faulty {
	return Faulty{total: start, values: make([]int, 0, 8)}
}

func (this *Faulty) Add(n int) int {
	this.values = append(this.values, n)
	this.total += n
	return this.total
}

func (this *Faulty) Items() []int {
	return this.values // the object's own slice
}

func (this *Faulty) Boom() int {
	return this.total / (this.total - this.total)
}

func (this *Faulty) Spin() {
	for {
		this.total += 0
	}
}
