package main

/**
 * Definition for a binary tree node (LeetCode provides it; the verifier injects it).
 * type TreeNode struct {
 *     Val int
 *     Left *TreeNode
 *     Right *TreeNode
 * }
 */
func diameterOfBinaryTree(root *TreeNode) int {
	// height(node) returns the node count of the longest downward path; at every node the
	// longest path bending there has height(left) + height(right) edges.
	best := 0
	var height func(node *TreeNode) int
	height = func(node *TreeNode) int {
		if node == nil {
			return 0
		}
		left, right := height(node.Left), height(node.Right)
		best = max(best, left+right)
		return 1 + max(left, right)
	}
	height(root)
	return best
}
