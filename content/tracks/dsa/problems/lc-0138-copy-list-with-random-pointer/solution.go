package main

/**
 * Definition for a Node.
 * type Node struct {
 *     Val int
 *     Next *Node
 *     Random *Node
 * }
 */
func copyRandomList(head *Node) *Node {
	// Pass 1: one copy per original node. nil maps to nil so pass 2 needs no checks.
	copies := map[*Node]*Node{nil: nil}
	for node := head; node != nil; node = node.Next {
		copies[node] = &Node{Val: node.Val}
	}
	// Pass 2: every copy exists now, so Next and Random can point at copies.
	for node := head; node != nil; node = node.Next {
		copies[node].Next = copies[node.Next]
		copies[node].Random = copies[node.Random]
	}
	return copies[head]
}
