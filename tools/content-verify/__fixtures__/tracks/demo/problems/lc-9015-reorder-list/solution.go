package main

func reorderList(head *ListNode) {
	nodes := []*ListNode{}
	for node := head; node != nil; node = node.Next {
		nodes = append(nodes, node)
	}
	order := []*ListNode{}
	for left, right := 0, len(nodes)-1; left <= right; left, right = left+1, right-1 {
		order = append(order, nodes[left])
		if left != right {
			order = append(order, nodes[right])
		}
	}
	for index, node := range order {
		node.Next = nil
		if index+1 < len(order) {
			node.Next = order[index+1]
		}
	}
}
