import java.util.*;

class Solution {
    public Node copyRandomList(Node head) {
        Map<Node, Node> copies = new HashMap<>();
        for (Node node = head; node != null; node = node.next) {
            copies.put(node, new Node(node.val));
        }
        for (Node node = head; node != null; node = node.next) {
            copies.get(node).next = copies.get(node.next);
            copies.get(node).random = copies.get(node.random);
        }
        return copies.get(head);
    }
}
