package main

func cloneGraph(node *Node) *Node {
	if node == nil {
		return nil
	}
	copies := map[*Node]*Node{node: {Val: node.Val}}
	stack := []*Node{node}
	for len(stack) > 0 {
		current := stack[len(stack)-1]
		stack = stack[:len(stack)-1]
		for _, neighbor := range current.Neighbors {
			if _, ok := copies[neighbor]; !ok {
				copies[neighbor] = &Node{Val: neighbor.Val}
				stack = append(stack, neighbor)
			}
			copies[current].Neighbors = append(copies[current].Neighbors, copies[neighbor])
		}
	}
	return copies[node]
}
