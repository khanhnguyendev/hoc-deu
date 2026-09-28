// content-verify: LeetCode's binary tree node (platform design §3.7, M3b). Copied next to the
// solution for the tree kind, in the default package the solution compiles in.

class TreeNode {
    int val;
    TreeNode left;
    TreeNode right;

    TreeNode() {
    }

    TreeNode(int val) {
        this.val = val;
    }

    TreeNode(int val, TreeNode left, TreeNode right) {
        this.val = val;
        this.left = left;
        this.right = right;
    }
}
