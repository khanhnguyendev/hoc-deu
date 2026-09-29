from typing import Optional

# Definition for singly-linked list.
# class ListNode:
#     def __init__(self, val=0, next=None):
#         self.val = val
#         self.next = next


class Solution:
    def removeNthFromEnd(self, head: Optional[ListNode], n: int) -> Optional[ListNode]:
        dummy = ListNode(0, head)  # lets us remove the head like any other node
        fast = head
        for _ in range(n):  # open a gap of n nodes
            fast = fast.next
        slow = dummy
        while fast is not None:  # move both until fast falls off the end
            fast = fast.next
            slow = slow.next
        slow.next = slow.next.next  # slow is just before the node to remove
        return dummy.next
