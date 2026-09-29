import java.util.*;

class Solution {
    public int findKthLargest(int[] nums, int k) {
        // A min-heap of the k largest values seen so far: its top is the k-th largest.
        PriorityQueue<Integer> heap = new PriorityQueue<>();
        for (int num : nums) {
            heap.offer(num);
            if (heap.size() > k) {
                heap.poll();
            }
        }
        return heap.peek();
    }
}
