import java.util.*;

class Solution {
    public List<List<Integer>> threeSum(int[] nums) {
        // Sort, fix the smallest number, then find the other two with two pointers. Skipping equal
        // neighbours keeps every triplet unique.
        int[] sorted = nums.clone();
        Arrays.sort(sorted);
        List<List<Integer>> result = new ArrayList<>();
        for (int i = 0; i < sorted.length - 2; i++) {
            if (sorted[i] > 0) {
                break;
            }
            if (i > 0 && sorted[i] == sorted[i - 1]) {
                continue;
            }
            int left = i + 1;
            int right = sorted.length - 1;
            while (left < right) {
                int total = sorted[i] + sorted[left] + sorted[right];
                if (total < 0) {
                    left++;
                } else if (total > 0) {
                    right--;
                } else {
                    result.add(List.of(sorted[i], sorted[left], sorted[right]));
                    left++;
                    right--;
                    while (left < right && sorted[left] == sorted[left - 1]) {
                        left++;
                    }
                }
            }
        }
        return result;
    }
}
