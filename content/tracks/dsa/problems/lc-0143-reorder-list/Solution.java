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
    public void reorderList(ListNode head) {
        // 1. Find the middle: slow stops at the end of the first half.
        ListNode slow = head;
        ListNode fast = head.next;
        while (fast != null && fast.next != null) {
            slow = slow.next;
            fast = fast.next.next;
        }
        // 2. Cut the list in two and reverse the second half.
        ListNode second = slow.next;
        slow.next = null;
        ListNode previous = null;
        while (second != null) {
            ListNode following = second.next;
            second.next = previous;
            previous = second;
            second = following;
        }
        // 3. Weave the halves: one node from the front, one from the reversed back.
        ListNode first = head;
        second = previous;
        while (second != null) {
            ListNode firstNext = first.next;
            ListNode secondNext = second.next;
            first.next = second;
            second.next = firstNext;
            first = firstNext;
            second = secondNext;
        }
    }
}
