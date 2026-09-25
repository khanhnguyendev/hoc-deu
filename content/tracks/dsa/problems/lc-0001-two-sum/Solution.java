import java.util.*;

class Solution {
    public int[] twoSum(int[] nums, int target) {
        Map<Integer, Integer> indexOf = new HashMap<>(); // value -> index, for the numbers already passed
        for (int i = 0; i < nums.length; i++) {
            int complement = target - nums[i];
            if (indexOf.containsKey(complement)) {
                return new int[] {indexOf.get(complement), i};
            }
            indexOf.put(nums[i], i);
        }
        return new int[0]; // unreachable: the input always has exactly one answer
    }
}
