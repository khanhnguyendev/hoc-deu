package main

/**
 * Definition for a binary tree node (LeetCode provides it; the verifier injects it).
 * type TreeNode struct {
 *     Val int
 *     Left *TreeNode
 *     Right *TreeNode
 * }
 */
func rightSideView(root *TreeNode) []int {
	// BFS level by level; the last node of each level is the one seen from the right.
	result := []int{}
	if root == nil {
		return result
	}
	queue := []*TreeNode{root}
	for len(queue) > 0 {
		result = append(result, queue[len(queue)-1].Val)
		next := []*TreeNode{}
		for _, node := range queue {
			if node.Left != nil {
				next = append(next, node.Left)
			}
			if node.Right != nil {
				next = append(next, node.Right)
			}
		}
		queue = next
	}
	return result
}
