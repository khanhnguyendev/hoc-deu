// content-verify: LeetCode's singly-linked list node (platform design §3.7, M3b). Copied next to
// the solution for the linked-list kind, in the default package the solution compiles in.

class ListNode {
    int val;
    ListNode next;

    ListNode() {
    }

    ListNode(int val) {
        this.val = val;
    }

    ListNode(int val, ListNode next) {
        this.val = val;
        this.next = next;
    }
}
