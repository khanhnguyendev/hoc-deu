package main

/**
 * Definition for singly-linked list.
 * type ListNode struct {
 *     Val int
 *     Next *ListNode
 * }
 */
func mergeKLists(lists []*ListNode) *ListNode {
	if len(lists) == 0 {
		return nil
	}
	// Merge the lists in pairs, round after round: log k rounds of n nodes each.
	for len(lists) > 1 {
		merged := make([]*ListNode, 0, (len(lists)+1)/2)
		for index := 0; index < len(lists); index += 2 {
			var second *ListNode
			if index+1 < len(lists) {
				second = lists[index+1]
			}
			merged = append(merged, mergeTwo(lists[index], second))
		}
		lists = merged
	}
	return lists[0]
}

func mergeTwo(first *ListNode, second *ListNode) *ListNode {
	dummy := &ListNode{}
	tail := dummy
	for first != nil && second != nil {
		if first.Val <= second.Val {
			tail.Next = first
			first = first.Next
		} else {
			tail.Next = second
			second = second.Next
		}
		tail = tail.Next
	}
	if first != nil {
		tail.Next = first
	} else {
		tail.Next = second
	}
	return dummy.Next
}
