package main

func isPalindrome(head *ListNode) bool {
	slow, fast := head, head
	for fast != nil && fast.Next != nil {
		slow, fast = slow.Next, fast.Next.Next
	}
	var previous *ListNode
	for slow != nil { // reverse the second half in place (never restored)
		slow.Next, previous, slow = previous, slow, slow.Next
	}
	for previous != nil {
		if previous.Val != head.Val {
			return false
		}
		previous, head = previous.Next, head.Next
	}
	return true
}
