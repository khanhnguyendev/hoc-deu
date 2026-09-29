package main

/**
 * Definition for singly-linked list.
 * type ListNode struct {
 *     Val int
 *     Next *ListNode
 * }
 */
func removeNthFromEnd(head *ListNode, n int) *ListNode {
	dummy := &ListNode{Next: head} // lets us remove the head like any other node
	fast := head
	for step := 0; step < n; step++ { // open a gap of n nodes
		fast = fast.Next
	}
	slow := dummy
	for fast != nil { // move both until fast falls off the end
		fast = fast.Next
		slow = slow.Next
	}
	slow.Next = slow.Next.Next // slow is just before the node to remove
	return dummy.Next
}
