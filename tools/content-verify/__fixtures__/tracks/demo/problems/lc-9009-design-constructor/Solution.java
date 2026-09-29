import java.util.*;

class Counter {
    private int total;
    private final Set<Integer> added = new HashSet<>();

    public Counter(int start) {
        total = start;
    }

    public int add(int n) {
        added.add(n);
        total += n;
        return total;
    }

    public boolean seen(int n) {
        return added.contains(n);
    }
}
