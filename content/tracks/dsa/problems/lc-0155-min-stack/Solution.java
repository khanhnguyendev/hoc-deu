import java.util.*;

class MinStack {
    // Each entry keeps its value and the minimum of the stack up to and including it.
    private final Deque<int[]> entries = new ArrayDeque<>();

    public MinStack() {
    }

    public void push(int val) {
        int minimum = entries.isEmpty() ? val : Math.min(val, entries.peek()[1]);
        entries.push(new int[] {val, minimum});
    }

    public void pop() {
        entries.pop();
    }

    public int top() {
        return entries.peek()[0];
    }

    public int getMin() {
        return entries.peek()[1];
    }
}
