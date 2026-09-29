from typing import Optional

# Definition for singly-linked list.
# class ListNode:
#     def __init__(self, val=0, next=None):
#         self.val = val
#         self.next = next


class Solution:
    def reorderList(self, head: Optional[ListNode]) -> None:
        # 1. Find the middle: slow stops at the end of the first half.
        slow, fast = head, head.next
        while fast is not None and fast.next is not None:
            slow = slow.next
            fast = fast.next.next
        # 2. Cut the list in two and reverse the second half.
        second, slow.next = slow.next, None
        previous = None
        while second is not None:
            following = second.next
            second.next = previous
            previous = second
            second = following
        # 3. Weave the halves: one node from the front, one from the reversed back.
        first, second = head, previous
        while second is not None:
            first_next, second_next = first.next, second.next
            first.next = second
            second.next = first_next
            first, second = first_next, second_next
