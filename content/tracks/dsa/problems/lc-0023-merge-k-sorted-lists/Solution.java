/**
 * Definition for singly-linked list.
 * public class ListNode {
 *     int val;
 *     ListNode next;
 *     ListNode() {}
 *     ListNode(int val) { this.val = val; }
 *     ListNode(int val, ListNode next) { this.val = val; this.next = next; }
 * }
 */
class Solution {
    public ListNode mergeKLists(ListNode[] lists) {
        if (lists.length == 0) {
            return null;
        }
        // Merge the lists in pairs, round after round: log k rounds of n nodes each.
        int count = lists.length;
        while (count > 1) {
            int next = 0;
            for (int index = 0; index < count; index += 2) {
                ListNode second = index + 1 < count ? lists[index + 1] : null;
                lists[next++] = mergeTwo(lists[index], second);
            }
            count = next;
        }
        return lists[0];
    }

    private ListNode mergeTwo(ListNode first, ListNode second) {
        ListNode dummy = new ListNode();
        ListNode tail = dummy;
        while (first != null && second != null) {
            if (first.val <= second.val) {
                tail.next = first;
                first = first.next;
            } else {
                tail.next = second;
                second = second.next;
            }
            tail = tail.next;
        }
        tail.next = first != null ? first : second;
        return dummy.next;
    }
}
