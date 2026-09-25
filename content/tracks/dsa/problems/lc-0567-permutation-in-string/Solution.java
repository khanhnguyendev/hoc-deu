import java.util.*;

class Solution {
    public boolean checkInclusion(String s1, String s2) {
        // Fixed-size sliding window over s2: compare its letter counts with s1's counts, adding the
        // letter that enters and removing the one that leaves at each step.
        if (s1.length() > s2.length()) {
            return false;
        }
        int[] need = new int[26];
        int[] window = new int[26];
        for (int i = 0; i < s1.length(); i++) {
            need[s1.charAt(i) - 'a']++;
        }
        for (int right = 0; right < s2.length(); right++) {
            window[s2.charAt(right) - 'a']++;
            if (right >= s1.length()) {
                window[s2.charAt(right - s1.length()) - 'a']--;
            }
            if (Arrays.equals(window, need)) {
                return true;
            }
        }
        return false;
    }
}
