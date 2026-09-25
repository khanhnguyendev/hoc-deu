import java.util.*;

class Solution {
    public int maxProfit(int[] prices) {
        // One pass: remember the cheapest day so far and try selling on each day.
        int cheapest = prices[0];
        int best = 0;
        for (int price : prices) {
            cheapest = Math.min(cheapest, price);
            best = Math.max(best, price - cheapest);
        }
        return best;
    }
}
