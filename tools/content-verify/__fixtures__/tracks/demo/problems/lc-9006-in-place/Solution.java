import java.util.*;

class Solution {
    public void reverse(int[] nums) {
        for (int left = 0, right = nums.length - 1; left < right; left++, right--) {
            int swap = nums[left];
            nums[left] = nums[right];
            nums[right] = swap;
        }
    }
}
