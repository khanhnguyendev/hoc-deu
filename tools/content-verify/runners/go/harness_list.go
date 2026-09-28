// content-verify: LeetCode's ListNode and its encoding (platform design §3.7, M3b) — an array of
// values, [] = nil; as an input, a cycle joins the tail to the node at index pos (141). Copied next
// to the solution for the linked-list kind; the names carry a "harness" prefix.

package main

type ListNode struct {
	Val  int
	Next *ListNode
}

func harnessDecodeList(values []int, pos int) *ListNode {
	nodes := make([]*ListNode, len(values))
	for i := len(values) - 1; i >= 0; i-- {
		nodes[i] = &ListNode{Val: values[i]}
		if i+1 < len(values) {
			nodes[i].Next = nodes[i+1]
		}
	}
	if len(nodes) == 0 {
		return nil
	}
	if pos >= 0 {
		nodes[len(nodes)-1].Next = nodes[pos]
	}
	return nodes[0]
}

func harnessDecodeLists(lists [][]int) []*ListNode {
	heads := make([]*ListNode, len(lists))
	for i, values := range lists {
		heads[i] = harnessDecodeList(values, -1)
	}
	return heads
}

func harnessEncodeList(head *ListNode) []int {
	values := []int{}
	seen := map[*ListNode]bool{}
	for node := head; node != nil; node = node.Next {
		if seen[node] {
			panic("content-verify: the returned list has a cycle")
		}
		seen[node] = true
		values = append(values, node.Val)
	}
	return values
}

func harnessEncodeLists(heads []*ListNode) [][]int {
	lists := [][]int{}
	for _, head := range heads {
		lists = append(lists, harnessEncodeList(head))
	}
	return lists
}
