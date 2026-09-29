package main

import "math"

/**
 * Definition for a binary tree node (LeetCode provides it; the verifier injects it).
 * type TreeNode struct {
 *     Val int
 *     Left *TreeNode
 *     Right *TreeNode
 * }
 */
func isValidBST(root *TreeNode) bool {
	// Every node must lie strictly inside the (low, high) window its ancestors allow;
	// Go's 64-bit int leaves room around the 32-bit node values.
	var valid func(node *TreeNode, low, high int) bool
	valid = func(node *TreeNode, low, high int) bool {
		if node == nil {
			return true
		}
		if node.Val <= low || node.Val >= high {
			return false
		}
		return valid(node.Left, low, node.Val) && valid(node.Right, node.Val, high)
	}
	return valid(root, math.MinInt64, math.MaxInt64)
}
