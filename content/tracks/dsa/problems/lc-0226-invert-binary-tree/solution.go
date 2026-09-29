package main

/**
 * Definition for a binary tree node (LeetCode provides it; the verifier injects it).
 * type TreeNode struct {
 *     Val int
 *     Left *TreeNode
 *     Right *TreeNode
 * }
 */
func invertTree(root *TreeNode) *TreeNode {
	// Swap the two children of every node; the children's subtrees are inverted first.
	if root == nil {
		return nil
	}
	root.Left, root.Right = invertTree(root.Right), invertTree(root.Left)
	return root
}
