import java.util.*;

class Solution {
    public int largestRectangleArea(int[] heights) {
        int best = 0;
        // Indices of bars whose heights never decrease from bottom to top.
        Deque<Integer> rising = new ArrayDeque<>();
        // A final bar of height 0 flushes every bar still on the stack.
        for (int i = 0; i <= heights.length; i++) {
            int current = i < heights.length ? heights[i] : 0;
            while (!rising.isEmpty() && heights[rising.peek()] >= current) {
                int height = heights[rising.pop()];
                // The popped bar extends right to i - 1 and left to just after the new top.
                int left = rising.isEmpty() ? 0 : rising.peek() + 1;
                best = Math.max(best, height * (i - left));
            }
            rising.push(i);
        }
        return best;
    }
}
