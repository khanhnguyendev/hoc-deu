import java.util.*;

class Solution {
    public int findMin(int[] nums) {
        // The minimum always lies in nums[lo..hi]; compare the middle with the right end.
        int lo = 0;
        int hi = nums.length - 1;
        while (lo < hi) {
            int mid = lo + (hi - lo) / 2;
            if (nums[mid] > nums[hi]) {
                lo = mid + 1; // the drop is right of mid
            } else {
                hi = mid; // nums[mid..hi] is sorted, so mid may be the minimum
            }
        }
        return nums[lo];
    }
}
