import java.util.*;

class Solution {
    public List<List<Integer>> subsets(int[] nums) {
        // Backtracking: at each index, either take nums[i] or skip it; every leaf is a subset.
        List<List<Integer>> result = new ArrayList<>();
        backtrack(nums, 0, new ArrayList<>(), result);
        return result;
    }

    private void backtrack(int[] nums, int i, List<Integer> current, List<List<Integer>> result) {
        if (i == nums.length) {
            result.add(new ArrayList<>(current));
            return;
        }
        current.add(nums[i]);
        backtrack(nums, i + 1, current, result);
        current.remove(current.size() - 1);
        backtrack(nums, i + 1, current, result);
    }
}
