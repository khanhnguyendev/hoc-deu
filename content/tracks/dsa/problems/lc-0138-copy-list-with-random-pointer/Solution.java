import java.util.*;

/*
// Definition for a Node.
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
*/
class Solution {
    public Node copyRandomList(Node head) {
        // Pass 1: one copy per original node.
        Map<Node, Node> copies = new HashMap<>();
        for (Node node = head; node != null; node = node.next) {
            copies.put(node, new Node(node.val));
        }
        // Pass 2: every copy exists now, so next and random can point at copies
        // (get(null) returns null).
        for (Node node = head; node != null; node = node.next) {
            copies.get(node).next = copies.get(node.next);
            copies.get(node).random = copies.get(node.random);
        }
        return copies.get(head);
    }
}
