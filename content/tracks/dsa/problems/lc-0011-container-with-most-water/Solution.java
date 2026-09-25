import java.util.*;

class Solution {
    public int maxArea(int[] height) {
        // Start with the widest container; only moving the shorter wall inward can find a taller
        // limit, so move that one each step.
        int left = 0;
        int right = height.length - 1;
        int best = 0;
        while (left < right) {
            best = Math.max(best, Math.min(height[left], height[right]) * (right - left));
            if (height[left] < height[right]) {
                left++;
            } else {
                right--;
            }
        }
        return best;
    }
}
