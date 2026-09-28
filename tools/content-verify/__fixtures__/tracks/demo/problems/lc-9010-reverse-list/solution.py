from typing import Optional


class Solution:
    def reverseList(self, head: Optional[ListNode]) -> Optional[ListNode]:
        previous = None
        while head is not None:
            head.next, previous, head = previous, head, head.next
        return previous
