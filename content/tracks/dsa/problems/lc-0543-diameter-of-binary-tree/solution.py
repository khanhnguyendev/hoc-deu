from typing import Optional

# Definition for a binary tree node (LeetCode provides it; the verifier injects it).
# class TreeNode:
#     def __init__(self, val=0, left=None, right=None):
#         self.val = val
#         self.left = left
#         self.right = right


class Solution:
    def diameterOfBinaryTree(self, root: Optional[TreeNode]) -> int:
        # height(node) returns the node count of the longest downward path; at every node the
        # longest path bending there has height(left) + height(right) edges.
        best = 0

        def height(node: Optional[TreeNode]) -> int:
            nonlocal best
            if node is None:
                return 0
            left, right = height(node.left), height(node.right)
            best = max(best, left + right)
            return 1 + max(left, right)

        height(root)
        return best
