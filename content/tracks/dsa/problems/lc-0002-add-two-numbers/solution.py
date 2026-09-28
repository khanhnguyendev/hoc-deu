from typing import Optional

# Definition for singly-linked list.
# class ListNode:
#     def __init__(self, val=0, next=None):
#         self.val = val
#         self.next = next


class Solution:
    def addTwoNumbers(
        self, l1: Optional[ListNode], l2: Optional[ListNode]
    ) -> Optional[ListNode]:
        dummy = tail = ListNode()
        carry = 0
        # Keep going while either list has digits or a carry is left over.
        while l1 is not None or l2 is not None or carry:
            total = carry
            if l1 is not None:
                total += l1.val
                l1 = l1.next
            if l2 is not None:
                total += l2.val
                l2 = l2.next
            carry, digit = divmod(total, 10)
            tail.next = ListNode(digit)
            tail = tail.next
        return dummy.next
