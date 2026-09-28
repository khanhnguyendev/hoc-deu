import java.util.*;

class Solution {
    public Node cloneGraph(Node node) {
        if (node == null) {
            return null;
        }
        Map<Node, Node> copies = new HashMap<>();
        copies.put(node, new Node(node.val));
        Deque<Node> stack = new ArrayDeque<>(List.of(node));
        while (!stack.isEmpty()) {
            Node current = stack.pop();
            for (Node neighbor : current.neighbors) {
                if (!copies.containsKey(neighbor)) {
                    copies.put(neighbor, new Node(neighbor.val));
                    stack.push(neighbor);
                }
                copies.get(current).neighbors.add(copies.get(neighbor));
            }
        }
        return copies.get(node);
    }
}
