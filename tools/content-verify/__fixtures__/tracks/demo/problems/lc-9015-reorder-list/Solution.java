import java.util.*;

class Solution {
    public void reorderList(ListNode head) {
        List<ListNode> nodes = new ArrayList<>();
        for (ListNode node = head; node != null; node = node.next) {
            nodes.add(node);
        }
        List<ListNode> order = new ArrayList<>();
        for (int left = 0, right = nodes.size() - 1; left <= right; left++, right--) {
            order.add(nodes.get(left));
            if (left != right) {
                order.add(nodes.get(right));
            }
        }
        for (int index = 0; index < order.size(); index++) {
            order.get(index).next = index + 1 < order.size() ? order.get(index + 1) : null;
        }
    }
}
