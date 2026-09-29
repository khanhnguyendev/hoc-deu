from typing import List, Optional

# Definition for singly-linked list.
# class ListNode:
#     def __init__(self, val=0, next=None):
#         self.val = val
#         self.next = next


class Solution:
    def mergeKLists(self, lists: List[Optional[ListNode]]) -> Optional[ListNode]:
        if not lists:
            return None
        # Merge the lists in pairs, round after round: log k rounds of n nodes each.
        while len(lists) > 1:
            merged = []
            for index in range(0, len(lists), 2):
                second = lists[index + 1] if index + 1 < len(lists) else None
                merged.append(self.mergeTwo(lists[index], second))
            lists = merged
        return lists[0]

    def mergeTwo(self, first: Optional[ListNode], second: Optional[ListNode]) -> Optional[ListNode]:
        dummy = tail = ListNode()
        while first is not None and second is not None:
            if first.val <= second.val:
                tail.next = first
                first = first.next
            else:
                tail.next = second
                second = second.next
            tail = tail.next
        tail.next = first if first is not None else second
        return dummy.next
