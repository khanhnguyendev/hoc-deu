from typing import Optional


class Solution:
    def reorderList(self, head: Optional[ListNode]) -> None:
        nodes = []
        while head is not None:
            nodes.append(head)
            head = head.next
        left, right = 0, len(nodes) - 1
        order = []
        while left <= right:
            order.append(nodes[left])
            if left != right:
                order.append(nodes[right])
            left, right = left + 1, right - 1
        for current, following in zip(order, order[1:] + [None]):
            current.next = following
