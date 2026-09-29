from collections import deque
from typing import List, Optional

# Definition for a binary tree node (LeetCode provides it; the verifier injects it).
# class TreeNode:
#     def __init__(self, val=0, left=None, right=None):
#         self.val = val
#         self.left = left
#         self.right = right


class Solution:
    def rightSideView(self, root: Optional[TreeNode]) -> List[int]:
        # BFS level by level; the last node of each level is the one seen from the right.
        result: List[int] = []
        queue = deque([root] if root else [])
        while queue:
            size = len(queue)
            for i in range(size):
                node = queue.popleft()
                if i == size - 1:
                    result.append(node.val)
                if node.left:
                    queue.append(node.left)
                if node.right:
                    queue.append(node.right)
        return result
