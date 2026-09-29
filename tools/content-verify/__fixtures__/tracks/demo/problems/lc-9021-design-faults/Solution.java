import java.util.*;

class Faulty {
    private int total;
    private final List<Integer> values = new ArrayList<>();

    public Faulty(int start) {
        total = start;
    }

    public int add(int n) {
        values.add(n);
        total += n;
        return total;
    }

    public List<Integer> items() {
        return values; // the object's own list: add() changes it later
    }

    public int boom() {
        return total / (total - total);
    }

    public void spin() {
        while (true) {
            total += 0;
        }
    }
}
