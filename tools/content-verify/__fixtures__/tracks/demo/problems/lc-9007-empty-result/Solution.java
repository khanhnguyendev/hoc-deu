import java.util.*;

class Solution {
    public int[] evens(int[] nums) {
        return Arrays.stream(nums).filter(value -> value % 2 == 0).toArray();
    }
}
