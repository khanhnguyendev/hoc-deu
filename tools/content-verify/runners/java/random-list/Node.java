// content-verify: LeetCode's random-pointer list node (138; platform design §3.7, M3b). Copied next
// to the solution as Node.java for the random-list kind, in the default package.

class Node {
    int val;
    Node next;
    Node random;

    public Node(int val) {
        this.val = val;
        this.next = null;
        this.random = null;
    }
}
