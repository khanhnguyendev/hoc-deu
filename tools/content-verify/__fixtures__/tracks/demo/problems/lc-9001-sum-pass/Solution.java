import java.util.*;

class Solution {
    public int sumList(int[] nums) {
        int total = 0;
        for (int value : nums) {
            total += value;
        }
        return total;
    }
}
