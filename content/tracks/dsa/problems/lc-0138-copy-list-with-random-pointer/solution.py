from typing import Dict, Optional

# Definition for a Node.
# class Node:
#     def __init__(self, x: int, next: 'Node' = None, random: 'Node' = None):
#         self.val = int(x)
#         self.next = next
#         self.random = random


class Solution:
    def copyRandomList(self, head: "Optional[Node]") -> "Optional[Node]":
        # Pass 1: one copy per original node. None maps to None so pass 2 needs no checks.
        copies: Dict[Optional[Node], Optional[Node]] = {None: None}
        node = head
        while node is not None:
            copies[node] = Node(node.val)
            node = node.next
        # Pass 2: every copy exists now, so next and random can point at copies.
        node = head
        while node is not None:
            copies[node].next = copies[node.next]
            copies[node].random = copies[node.random]
            node = node.next
        return copies[head]
