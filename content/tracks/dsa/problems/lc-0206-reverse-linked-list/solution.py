from typing import Optional

# Definition for singly-linked list.
# class ListNode:
#     def __init__(self, val=0, next=None):
#         self.val = val
#         self.next = next


class Solution:
    def reverseList(self, head: Optional[ListNode]) -> Optional[ListNode]:
        previous = None
        while head is not None:
            following = head.next
            head.next = previous  # turn this node's pointer around
            previous = head
            head = following
        return previous
