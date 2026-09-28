package main

func copyRandomList(head *Node) *Node {
	copies := map[*Node]*Node{nil: nil}
	for node := head; node != nil; node = node.Next {
		copies[node] = &Node{Val: node.Val}
	}
	for node := head; node != nil; node = node.Next {
		copies[node].Next = copies[node.Next]
		copies[node].Random = copies[node.Random]
	}
	return copies[head]
}
