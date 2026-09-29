from typing import Optional


class Solution:
    def isPalindrome(self, head: Optional[ListNode]) -> bool:
        slow = fast = head
        while fast is not None and fast.next is not None:
            slow, fast = slow.next, fast.next.next
        previous = None
        while slow is not None:  # reverse the second half in place (never restored)
            slow.next, previous, slow = previous, slow, slow.next
        while previous is not None:
            if previous.val != head.val:
                return False
            previous, head = previous.next, head.next
        return True
