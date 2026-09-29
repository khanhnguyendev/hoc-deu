from typing import Optional


class Solution:
    def hasCycle(self, head: Optional[ListNode]) -> bool:
        slow = fast = head
        while fast is not None and fast.next is not None:
            slow, fast = slow.next, fast.next.next
            if slow is fast:
                return True
        return False
