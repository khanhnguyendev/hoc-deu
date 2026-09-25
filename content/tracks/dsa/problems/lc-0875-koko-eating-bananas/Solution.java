import java.util.*;

class Solution {
    public int minEatingSpeed(int[] piles, int h) {
        // The answer lies in [1, max(piles)]: eating faster than the largest pile saves nothing.
        int lo = 1;
        int hi = Arrays.stream(piles).max().getAsInt();
        while (lo < hi) {
            int mid = lo + (hi - lo) / 2;
            if (hoursAt(piles, mid) <= h) {
                hi = mid; // mid is fast enough; a slower speed might be too
            } else {
                lo = mid + 1;
            }
        }
        return lo;
    }

    private long hoursAt(int[] piles, int speed) {
        // Each pile takes ceil(pile / speed) hours; the total can exceed an int.
        long hours = 0;
        for (int pile : piles) {
            hours += (pile + (long) speed - 1) / speed;
        }
        return hours;
    }
}
