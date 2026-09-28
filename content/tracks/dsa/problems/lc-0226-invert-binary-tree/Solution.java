/**
 * Definition for a binary tree node (LeetCode provides it; the verifier injects it).
 * public class TreeNode {
 *     int val;
 *     TreeNode left;
 *     TreeNode right;
 *     TreeNode() {}
 *     TreeNode(int val) { this.val = val; }
 *     TreeNode(int val, TreeNode left, TreeNode right) {
 *         this.val = val;
 *         this.left = left;
 *         this.right = right;
 *     }
 * }
 */
class Solution {
    public TreeNode invertTree(TreeNode root) {
        // Swap the two children of every node; the children's subtrees are inverted first.
        if (root == null) {
            return null;
        }
        TreeNode right = invertTree(root.right);
        root.right = invertTree(root.left);
        root.left = right;
        return root;
    }
}
