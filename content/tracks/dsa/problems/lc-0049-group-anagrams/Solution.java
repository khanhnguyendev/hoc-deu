import java.util.*;

class Solution {
    public List<List<String>> groupAnagrams(String[] strs) {
        // Anagrams share the same letter counts, so the 26 counts are the group key.
        Map<String, List<String>> groups = new HashMap<>();
        for (String word : strs) {
            int[] counts = new int[26];
            for (char ch : word.toCharArray()) {
                counts[ch - 'a']++;
            }
            String key = Arrays.toString(counts);
            groups.computeIfAbsent(key, unused -> new ArrayList<>()).add(word);
        }
        return new ArrayList<>(groups.values());
    }
}
