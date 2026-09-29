package main

/**
 * Definition for singly-linked list.
 * type ListNode struct {
 *     Val int
 *     Next *ListNode
 * }
 */
func reorderList(head *ListNode) {
	// 1. Find the middle: slow stops at the end of the first half.
	slow, fast := head, head.Next
	for fast != nil && fast.Next != nil {
		slow = slow.Next
		fast = fast.Next.Next
	}
	// 2. Cut the list in two and reverse the second half.
	second := slow.Next
	slow.Next = nil
	var previous *ListNode
	for second != nil {
		following := second.Next
		second.Next = previous
		previous = second
		second = following
	}
	// 3. Weave the halves: one node from the front, one from the reversed back.
	first := head
	second = previous
	for second != nil {
		firstNext, secondNext := first.Next, second.Next
		first.Next = second
		second.Next = firstNext
		first, second = firstNext, secondNext
	}
}
