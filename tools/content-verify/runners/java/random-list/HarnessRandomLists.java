// content-verify: LeetCode's random-pointer list encoding (138; platform design §3.7, M3b) —
// [[val, randomIndex | null], ...], [] = null. The result must be a deep copy: encodeCopy fails a
// result that reuses an input node.

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.IdentityHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

final class HarnessRandomLists {
    private HarnessRandomLists() {
    }

    static Node decode(Integer[][] entries) {
        Node[] nodes = new Node[entries.length];
        for (int index = 0; index < entries.length; index++) {
            nodes[index] = new Node(entries[index][0]);
            if (index > 0) {
                nodes[index - 1].next = nodes[index];
            }
        }
        for (int index = 0; index < entries.length; index++) {
            Integer random = entries[index][1];
            nodes[index].random = random == null ? null : nodes[random];
        }
        return entries.length == 0 ? null : nodes[0];
    }

    /** The nodes along next, each with its index; fails on a cycle. */
    private static Map<Node, Integer> indexed(Node head) {
        Map<Node, Integer> index = new IdentityHashMap<>();
        for (Node node = head; node != null; node = node.next) {
            if (index.containsKey(node)) {
                throw new IllegalStateException("content-verify: the returned list has a cycle");
            }
            index.put(node, index.size());
        }
        return index;
    }

    static Set<Node> nodes(Node head) {
        Set<Node> set = Collections.newSetFromMap(new IdentityHashMap<>());
        set.addAll(indexed(head).keySet());
        return set;
    }

    static List<List<Integer>> encode(Node head) {
        Map<Node, Integer> index = indexed(head);
        List<List<Integer>> entries = new ArrayList<>();
        for (Node node = head; node != null; node = node.next) {
            if (node.random != null && !index.containsKey(node.random)) {
                throw new IllegalStateException("content-verify: a random pointer leaves the returned list");
            }
            entries.add(Arrays.asList(node.val, node.random == null ? null : index.get(node.random)));
        }
        return entries;
    }

    static List<List<Integer>> encodeCopy(Node result, Set<Node> inputs) {
        for (Node node : indexed(result).keySet()) {
            if (inputs.contains(node)) {
                throw new IllegalStateException("content-verify: the result reuses an input node (expected a deep copy)");
            }
        }
        return encode(result);
    }
}
