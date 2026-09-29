package main

/**
 * Definition for a binary tree node (LeetCode provides it; the verifier injects it).
 * type TreeNode struct {
 *     Val int
 *     Left *TreeNode
 *     Right *TreeNode
 * }
 */
func levelOrder(root *TreeNode) [][]int {
	// BFS: the queue holds exactly one level at the start of each round.
	result := [][]int{}
	if root == nil {
		return result
	}
	queue := []*TreeNode{root}
	for len(queue) > 0 {
		level := make([]int, 0, len(queue))
		next := []*TreeNode{}
		for _, node := range queue {
			level = append(level, node.Val)
			if node.Left != nil {
				next = append(next, node.Left)
			}
			if node.Right != nil {
				next = append(next, node.Right)
			}
		}
		result = append(result, level)
		queue = next
	}
	return result
}
