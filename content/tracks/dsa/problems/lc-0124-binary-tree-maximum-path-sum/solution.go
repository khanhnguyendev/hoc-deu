package main

/**
 * Definition for a binary tree node (LeetCode provides it; the verifier injects it).
 * type TreeNode struct {
 *     Val int
 *     Left *TreeNode
 *     Right *TreeNode
 * }
 */
func maxPathSum(root *TreeNode) int {
	// gain(node) = the best sum of a path going down from node (a negative branch counts as 0);
	// the best path that bends at node is node.Val + gain(left) + gain(right).
	best := root.Val
	var gain func(node *TreeNode) int
	gain = func(node *TreeNode) int {
		if node == nil {
			return 0
		}
		left := max(gain(node.Left), 0)
		right := max(gain(node.Right), 0)
		best = max(best, node.Val+left+right)
		return node.Val + max(left, right)
	}
	gain(root)
	return best
}
