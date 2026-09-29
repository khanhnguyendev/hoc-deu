package main

/**
 * Definition for singly-linked list.
 * type ListNode struct {
 *     Val int
 *     Next *ListNode
 * }
 */
func reverseList(head *ListNode) *ListNode {
	var previous *ListNode
	for head != nil {
		following := head.Next
		head.Next = previous // turn this node's pointer around
		previous = head
		head = following
	}
	return previous
}
