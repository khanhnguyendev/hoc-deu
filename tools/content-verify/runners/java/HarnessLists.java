// content-verify: LeetCode's linked-list encoding (platform design §3.7, M3b) — an array of values,
// [] = null; as an input, a cycle joins the tail to the node at index pos (141).

import java.util.ArrayList;
import java.util.Collections;
import java.util.IdentityHashMap;
import java.util.List;
import java.util.Set;

final class HarnessLists {
    private HarnessLists() {
    }

    static ListNode decode(int[] values) {
        return decode(values, -1);
    }

    static ListNode decode(int[] values, int pos) {
        ListNode[] nodes = new ListNode[values.length];
        for (int index = values.length - 1; index >= 0; index--) {
            nodes[index] = new ListNode(values[index], index + 1 < values.length ? nodes[index + 1] : null);
        }
        if (values.length > 0 && pos >= 0) {
            nodes[values.length - 1].next = nodes[pos];
        }
        return values.length == 0 ? null : nodes[0];
    }

    static ListNode[] decodeAll(int[][] lists) {
        ListNode[] heads = new ListNode[lists.length];
        for (int index = 0; index < lists.length; index++) {
            heads[index] = decode(lists[index]);
        }
        return heads;
    }

    static List<Integer> encode(ListNode head) {
        List<Integer> values = new ArrayList<>();
        Set<ListNode> seen = Collections.newSetFromMap(new IdentityHashMap<>());
        for (ListNode node = head; node != null; node = node.next) {
            if (!seen.add(node)) {
                throw new IllegalStateException("content-verify: the returned list has a cycle");
            }
            values.add(node.val);
        }
        return values;
    }

    static List<List<Integer>> encodeAll(ListNode[] heads) {
        List<List<Integer>> lists = new ArrayList<>();
        for (ListNode head : heads) {
            lists.add(encode(head));
        }
        return lists;
    }
}
