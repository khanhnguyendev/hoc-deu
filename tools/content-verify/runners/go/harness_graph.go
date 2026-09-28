// content-verify: LeetCode's graph Node and its encoding (133; platform design §3.7, M3b) — the
// adjacency list, node i + 1 at index i, [] = nil. The result must be a deep copy:
// harnessEncodeGraphCopy fails a result that reuses an input node. Copied next to the solution for
// the graph-node kind; the names carry a "harness" prefix.

package main

type Node struct {
	Val       int
	Neighbors []*Node
}

func harnessDecodeGraph(adjacency [][]int) *Node {
	nodes := make([]*Node, len(adjacency))
	for i := range nodes {
		nodes[i] = &Node{Val: i + 1}
	}
	for i, neighbours := range adjacency {
		for _, number := range neighbours {
			nodes[i].Neighbors = append(nodes[i].Neighbors, nodes[number-1])
		}
	}
	if len(nodes) == 0 {
		return nil
	}
	return nodes[0]
}

// harnessGraphReachable lists every node reachable from start, breadth first.
func harnessGraphReachable(start *Node) []*Node {
	if start == nil {
		return nil
	}
	nodes := []*Node{start}
	seen := map[*Node]bool{start: true}
	for i := 0; i < len(nodes); i++ {
		for _, neighbour := range nodes[i].Neighbors {
			if !seen[neighbour] {
				seen[neighbour] = true
				nodes = append(nodes, neighbour)
			}
		}
	}
	return nodes
}

func harnessGraphNodes(start *Node) map[*Node]bool {
	set := map[*Node]bool{}
	for _, node := range harnessGraphReachable(start) {
		set[node] = true
	}
	return set
}

func harnessEncodeGraph(start *Node) [][]int {
	nodes := harnessGraphReachable(start)
	adjacency := make([][]int, len(nodes))
	for _, node := range nodes {
		if node.Val < 1 || node.Val > len(nodes) || adjacency[node.Val-1] != nil {
			panic("content-verify: the returned graph's values are not 1..n, each once")
		}
		neighbours := []int{}
		for _, neighbour := range node.Neighbors {
			neighbours = append(neighbours, neighbour.Val)
		}
		adjacency[node.Val-1] = neighbours
	}
	return adjacency
}

func harnessEncodeGraphCopy(result *Node, inputs map[*Node]bool) [][]int {
	for _, node := range harnessGraphReachable(result) {
		if inputs[node] {
			panic("content-verify: the result reuses an input node (expected a deep copy)")
		}
	}
	return harnessEncodeGraph(result)
}
