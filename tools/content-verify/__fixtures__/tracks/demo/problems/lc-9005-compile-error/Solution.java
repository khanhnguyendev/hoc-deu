import java.util.*;

class Solution {
    public double weightedSum(double[] values, long weight) {
        // Deliberate compile error (content-verify fixture): the next line lacks its semicolon.
        double total = 0
        for (double value : values) {
            total += value;
        }
        return total * weight;
    }
}
