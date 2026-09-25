import java.util.*;

class Solution {
    public int characterReplacement(String s, int k) {
        // Sliding window: the window is valid while (length - count of its most frequent letter)
        // <= k. The best count seen so far never needs to shrink: only a larger count can give a
        // longer answer.
        int[] counts = new int[26];
        int left = 0;
        int top = 0;
        int best = 0;
        for (int right = 0; right < s.length(); right++) {
            int index = s.charAt(right) - 'A';
            counts[index]++;
            top = Math.max(top, counts[index]);
            while (right - left + 1 - top > k) {
                counts[s.charAt(left) - 'A']--;
                left++;
            }
            best = Math.max(best, right - left + 1);
        }
        return best;
    }
}
