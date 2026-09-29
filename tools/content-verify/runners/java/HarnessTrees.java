// content-verify: LeetCode's tree encoding (platform design §3.7, M3b) — the level-order array with
// null gaps and no trailing nulls, [] = the empty tree.

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collections;
import java.util.IdentityHashMap;
import java.util.List;
import java.util.Queue;
import java.util.Set;

final class HarnessTrees {
    private HarnessTrees() {
    }

    static TreeNode decode(Integer[] values) {
        if (values.length == 0) {
            return null;
        }
        TreeNode root = new TreeNode(values[0]);
        Queue<TreeNode> queue = new ArrayDeque<>();
        queue.add(root);
        int index = 1;
        while (!queue.isEmpty() && index < values.length) {
            TreeNode node = queue.poll();
            if (values[index] != null) {
                node.left = new TreeNode(values[index]);
                queue.add(node.left);
            }
            index++;
            if (index < values.length && values[index] != null) {
                node.right = new TreeNode(values[index]);
                queue.add(node.right);
            }
            index++;
        }
        return root;
    }

    static List<Integer> encode(TreeNode root) {
        List<Integer> values = new ArrayList<>();
        Set<TreeNode> seen = Collections.newSetFromMap(new IdentityHashMap<>());
        List<TreeNode> queue = new ArrayList<>();
        queue.add(root);
        for (int index = 0; index < queue.size(); index++) {
            TreeNode node = queue.get(index);
            if (node == null) {
                values.add(null);
                continue;
            }
            if (!seen.add(node)) {
                throw new IllegalStateException("content-verify: the returned tree has a cycle or a shared node");
            }
            values.add(node.val);
            queue.add(node.left);
            queue.add(node.right);
        }
        while (!values.isEmpty() && values.get(values.size() - 1) == null) {
            values.remove(values.size() - 1);
        }
        return values;
    }
}
