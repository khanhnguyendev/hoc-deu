class Solution {
    public boolean isPalindrome(ListNode head) {
        ListNode slow = head;
        ListNode fast = head;
        while (fast != null && fast.next != null) {
            slow = slow.next;
            fast = fast.next.next;
        }
        ListNode previous = null;
        while (slow != null) { // reverse the second half in place (never restored)
            ListNode next = slow.next;
            slow.next = previous;
            previous = slow;
            slow = next;
        }
        while (previous != null) {
            if (previous.val != head.val) {
                return false;
            }
            previous = previous.next;
            head = head.next;
        }
        return true;
    }
}
