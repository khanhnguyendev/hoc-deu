import java.util.*;

class Solution {
    public List<List<String>> groupByLength(String[] words) {
        Map<Integer, List<String>> groups = new LinkedHashMap<>();
        for (String word : words) {
            groups.computeIfAbsent(word.length(), length -> new ArrayList<>()).add(word);
        }
        return new ArrayList<>(groups.values());
    }
}
