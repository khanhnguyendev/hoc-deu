package main

type MinStack struct {
	items    []int
	minimums []int
}

func Constructor() MinStack {
	return MinStack{}
}

func (this *MinStack) Push(val int) {
	this.items = append(this.items, val)
	if len(this.minimums) > 0 && this.minimums[len(this.minimums)-1] < val {
		val = this.minimums[len(this.minimums)-1]
	}
	this.minimums = append(this.minimums, val)
}

func (this *MinStack) Pop() {
	this.items = this.items[:len(this.items)-1]
	this.minimums = this.minimums[:len(this.minimums)-1]
}

func (this *MinStack) Top() int {
	return this.items[len(this.items)-1]
}

func (this *MinStack) GetMin() int {
	return this.minimums[len(this.minimums)-1]
}
