import java.util.*;

class Solution {
    public int lengthOfLongestSubstring(String s) {
        // Sliding window: remember where each character was last seen; a repeat inside the window
        // moves the left edge just past it (never backwards).
        Map<Character, Integer> lastSeen = new HashMap<>();
        int left = 0;
        int best = 0;
        for (int right = 0; right < s.length(); right++) {
            char c = s.charAt(right);
            Integer previous = lastSeen.get(c);
            if (previous != null && previous >= left) {
                left = previous + 1;
            }
            lastSeen.put(c, right);
            best = Math.max(best, right - left + 1);
        }
        return best;
    }
}
