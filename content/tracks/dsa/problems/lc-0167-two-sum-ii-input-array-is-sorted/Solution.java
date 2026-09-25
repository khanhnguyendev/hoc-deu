import java.util.*;

class Solution {
    public int[] twoSum(int[] numbers, int target) {
        // The array is sorted: a sum that is too small moves the left end up, too large moves the
        // right end down. The answer is 1-indexed.
        int left = 0;
        int right = numbers.length - 1;
        while (left < right) {
            int total = numbers[left] + numbers[right];
            if (total == target) {
                return new int[] {left + 1, right + 1};
            }
            if (total < target) {
                left++;
            } else {
                right--;
            }
        }
        return new int[0];
    }
}
