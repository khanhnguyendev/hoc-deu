import java.util.*;

class Solution {
    public int[] topKFrequent(int[] nums, int k) {
        Map<Integer, Integer> counts = new HashMap<>();
        for (int num : nums) {
            counts.put(num, counts.getOrDefault(num, 0) + 1);
        }
        // buckets.get(f): the values that appear exactly f times (f is at most nums.length)
        List<List<Integer>> buckets = new ArrayList<>();
        for (int count = 0; count <= nums.length; count++) {
            buckets.add(new ArrayList<>());
        }
        for (Map.Entry<Integer, Integer> entry : counts.entrySet()) {
            buckets.get(entry.getValue()).add(entry.getKey());
        }
        int[] result = new int[k];
        int filled = 0;
        for (int count = nums.length; count > 0; count--) { // most frequent first
            for (int num : buckets.get(count)) {
                result[filled++] = num;
                if (filled == k) {
                    return result;
                }
            }
        }
        return result;
    }
}
