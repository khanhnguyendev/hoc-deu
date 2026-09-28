// content-verify: LeetCode's graph encoding (133; platform design §3.7, M3b) — the adjacency list,
// node i + 1 at index i, [] = null. The result must be a deep copy: encodeCopy fails a result that
// reuses an input node.

import java.util.ArrayList;
import java.util.Collections;
import java.util.IdentityHashMap;
import java.util.List;
import java.util.Set;

final class HarnessGraphs {
    private HarnessGraphs() {
    }

    static Node decode(int[][] adjacency) {
        Node[] nodes = new Node[adjacency.length];
        for (int index = 0; index < nodes.length; index++) {
            nodes[index] = new Node(index + 1);
        }
        for (int index = 0; index < nodes.length; index++) {
            for (int neighbour : adjacency[index]) {
                nodes[index].neighbors.add(nodes[neighbour - 1]);
            }
        }
        return nodes.length == 0 ? null : nodes[0];
    }

    /** Every node reachable from start, in breadth-first order. */
    private static List<Node> reachable(Node start) {
        List<Node> nodes = new ArrayList<>();
        if (start == null) {
            return nodes;
        }
        Set<Node> seen = Collections.newSetFromMap(new IdentityHashMap<>());
        seen.add(start);
        nodes.add(start);
        for (int index = 0; index < nodes.size(); index++) {
            for (Node neighbour : nodes.get(index).neighbors) {
                if (seen.add(neighbour)) {
                    nodes.add(neighbour);
                }
            }
        }
        return nodes;
    }

    static Set<Node> nodes(Node start) {
        Set<Node> set = Collections.newSetFromMap(new IdentityHashMap<>());
        set.addAll(reachable(start));
        return set;
    }

    static List<List<Integer>> encode(Node start) {
        List<Node> nodes = reachable(start);
        List<List<Integer>> adjacency = new ArrayList<>(Collections.nCopies(nodes.size(), null));
        for (Node node : nodes) {
            if (node.val < 1 || node.val > nodes.size() || adjacency.get(node.val - 1) != null) {
                throw new IllegalStateException("content-verify: the returned graph's values are not 1..n, each once");
            }
            List<Integer> neighbours = new ArrayList<>();
            for (Node neighbour : node.neighbors) {
                neighbours.add(neighbour.val);
            }
            adjacency.set(node.val - 1, neighbours);
        }
        return adjacency;
    }

    static List<List<Integer>> encodeCopy(Node result, Set<Node> inputs) {
        for (Node node : reachable(result)) {
            if (inputs.contains(node)) {
                throw new IllegalStateException("content-verify: the result reuses an input node (expected a deep copy)");
            }
        }
        return encode(result);
    }
}
