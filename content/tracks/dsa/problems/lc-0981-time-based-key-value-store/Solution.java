import java.util.*;

class TimeMap {
    private record Entry(int timestamp, String value) {
    }

    // key -> entries; set is called with increasing timestamps, so each list stays sorted by
    // timestamp.
    private final Map<String, List<Entry>> history = new HashMap<>();

    public TimeMap() {
    }

    public void set(String key, String value, int timestamp) {
        history.computeIfAbsent(key, unused -> new ArrayList<>()).add(new Entry(timestamp, value));
    }

    public String get(String key, int timestamp) {
        List<Entry> entries = history.getOrDefault(key, List.of());
        // Binary search for the last entry whose timestamp is <= the query.
        String answer = "";
        int lo = 0;
        int hi = entries.size() - 1;
        while (lo <= hi) {
            int mid = lo + (hi - lo) / 2;
            if (entries.get(mid).timestamp() <= timestamp) {
                answer = entries.get(mid).value();
                lo = mid + 1;
            } else {
                hi = mid - 1;
            }
        }
        return answer;
    }
}
