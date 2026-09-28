package main

func reverseList(head *ListNode) *ListNode {
	var previous *ListNode
	for head != nil {
		head.Next, previous, head = previous, head, head.Next
	}
	return previous
}
