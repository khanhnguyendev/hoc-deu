// content-verify: LeetCode's random-pointer Node and its encoding (138; platform design §3.7, M3b)
// — [[val, randomIndex | nil], ...], [] = nil. The result must be a deep copy:
// harnessEncodeRandomListCopy fails a result that reuses an input node. Copied next to the solution
// for the random-list kind; the names carry a "harness" prefix.

package main

type Node struct {
	Val    int
	Next   *Node
	Random *Node
}

func harnessDecodeRandomList(entries [][]any) *Node {
	nodes := make([]*Node, len(entries))
	for i, entry := range entries {
		nodes[i] = &Node{Val: entry[0].(int)}
		if i > 0 {
			nodes[i-1].Next = nodes[i]
		}
	}
	for i, entry := range entries {
		if entry[1] != nil {
			nodes[i].Random = nodes[entry[1].(int)]
		}
	}
	if len(nodes) == 0 {
		return nil
	}
	return nodes[0]
}

// harnessRandomListIndex maps each node along Next to its index; a cycle fails.
func harnessRandomListIndex(head *Node) ([]*Node, map[*Node]int) {
	nodes := []*Node{}
	index := map[*Node]int{}
	for node := head; node != nil; node = node.Next {
		if _, ok := index[node]; ok {
			panic("content-verify: the returned list has a cycle")
		}
		index[node] = len(nodes)
		nodes = append(nodes, node)
	}
	return nodes, index
}

func harnessRandomListNodes(head *Node) map[*Node]bool {
	set := map[*Node]bool{}
	nodes, _ := harnessRandomListIndex(head)
	for _, node := range nodes {
		set[node] = true
	}
	return set
}

func harnessEncodeRandomList(head *Node) [][]any {
	nodes, index := harnessRandomListIndex(head)
	entries := [][]any{}
	for _, node := range nodes {
		var random any
		if node.Random != nil {
			position, ok := index[node.Random]
			if !ok {
				panic("content-verify: a random pointer leaves the returned list")
			}
			random = position
		}
		entries = append(entries, []any{node.Val, random})
	}
	return entries
}

func harnessEncodeRandomListCopy(result *Node, inputs map[*Node]bool) [][]any {
	nodes, _ := harnessRandomListIndex(result)
	for _, node := range nodes {
		if inputs[node] {
			panic("content-verify: the result reuses an input node (expected a deep copy)")
		}
	}
	return harnessEncodeRandomList(result)
}
