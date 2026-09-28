// content-verify: LeetCode's TreeNode and its encoding (platform design §3.7, M3b) — the
// level-order array with nil gaps and no trailing nils, [] = the empty tree. Copied next to the
// solution for the tree kind; the names carry a "harness" prefix.

package main

type TreeNode struct {
	Val   int
	Left  *TreeNode
	Right *TreeNode
}

func harnessDecodeTree(values []any) *TreeNode {
	if len(values) == 0 {
		return nil
	}
	root := &TreeNode{Val: values[0].(int)}
	queue := []*TreeNode{root}
	index := 1
	for len(queue) > 0 && index < len(values) {
		node := queue[0]
		queue = queue[1:]
		if values[index] != nil {
			node.Left = &TreeNode{Val: values[index].(int)}
			queue = append(queue, node.Left)
		}
		index++
		if index < len(values) && values[index] != nil {
			node.Right = &TreeNode{Val: values[index].(int)}
			queue = append(queue, node.Right)
		}
		index++
	}
	return root
}

func harnessEncodeTree(root *TreeNode) []any {
	values := []any{}
	seen := map[*TreeNode]bool{}
	queue := []*TreeNode{root}
	for i := 0; i < len(queue); i++ {
		node := queue[i]
		if node == nil {
			values = append(values, nil)
			continue
		}
		if seen[node] {
			panic("content-verify: the returned tree has a cycle or a shared node")
		}
		seen[node] = true
		values = append(values, node.Val)
		queue = append(queue, node.Left, node.Right)
	}
	for len(values) > 0 && values[len(values)-1] == nil {
		values = values[:len(values)-1]
	}
	return values
}
