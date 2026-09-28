import java.util.*;

class Solution {
    public List<List<Integer>> combinationSum(int[] candidates, int target) {
        // Backtracking over sorted candidates: from index `start` on, so each combination is built
        // once (non-decreasing); the same index may repeat because a candidate can be reused.
        int[] sorted = candidates.clone();
        Arrays.sort(sorted);
        List<List<Integer>> result = new ArrayList<>();
        backtrack(sorted, 0, target, new ArrayList<>(), result);
        return result;
    }

    private void backtrack(
            int[] candidates, int start, int remaining, List<Integer> current, List<List<Integer>> result) {
        if (remaining == 0) {
            result.add(new ArrayList<>(current));
            return;
        }
        for (int i = start; i < candidates.length; i++) {
            if (candidates[i] > remaining) {
                break; // sorted: every later candidate is larger too
            }
            current.add(candidates[i]);
            backtrack(candidates, i, remaining - candidates[i], current, result);
            current.remove(current.size() - 1);
        }
    }
}
