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
    public ListNode removeNthFromEnd(ListNode head, int n) {
        ListNode dummy = new ListNode(0, head); // lets us remove the head like any other node
        ListNode fast = head;
        for (int step = 0; step < n; step++) { // open a gap of n nodes
            fast = fast.next;
        }
        ListNode slow = dummy;
        while (fast != null) { // move both until fast falls off the end
            fast = fast.next;
            slow = slow.next;
        }
        slow.next = slow.next.next; // slow is just before the node to remove
        return dummy.next;
    }
}
