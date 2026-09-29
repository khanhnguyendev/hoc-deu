package main

func mergeKLists(lists []*ListNode) *ListNode {
	dummy := &ListNode{}
	tail := dummy
	for {
		best := -1
		for index, node := range lists {
			if node != nil && (best == -1 || node.Val < lists[best].Val) {
				best = index
			}
		}
		if best == -1 {
			return dummy.Next
		}
		tail.Next = lists[best]
		tail = tail.Next
		lists[best] = lists[best].Next
	}
}
