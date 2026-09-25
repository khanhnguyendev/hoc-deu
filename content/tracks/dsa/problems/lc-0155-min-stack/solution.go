package main

// minStackEntry keeps a value and the minimum of the stack up to and including it.
type minStackEntry struct {
	val     int
	minimum int
}

type MinStack struct {
	entries []minStackEntry
}

func Constructor() MinStack {
	return MinStack{}
}

func (this *MinStack) Push(val int) {
	minimum := val
	if len(this.entries) > 0 && this.entries[len(this.entries)-1].minimum < val {
		minimum = this.entries[len(this.entries)-1].minimum
	}
	this.entries = append(this.entries, minStackEntry{val: val, minimum: minimum})
}

func (this *MinStack) Pop() {
	this.entries = this.entries[:len(this.entries)-1]
}

func (this *MinStack) Top() int {
	return this.entries[len(this.entries)-1].val
}

func (this *MinStack) GetMin() int {
	return this.entries[len(this.entries)-1].minimum
}
