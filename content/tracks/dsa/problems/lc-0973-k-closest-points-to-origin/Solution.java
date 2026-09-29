import java.util.*;

class Solution {
    public int[][] kClosest(int[][] points, int k) {
        // A max-heap by squared distance, capped at size k, keeps the k closest points seen so far.
        PriorityQueue<int[]> heap =
                new PriorityQueue<>((a, b) -> Integer.compare(squared(b), squared(a)));
        for (int[] point : points) {
            heap.offer(point);
            if (heap.size() > k) {
                heap.poll();
            }
        }
        int[][] result = new int[k][];
        for (int i = 0; i < k; i++) {
            result[i] = heap.poll();
        }
        return result;
    }

    private static int squared(int[] point) {
        return point[0] * point[0] + point[1] * point[1];
    }
}
