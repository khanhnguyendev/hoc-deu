import java.util.*;

class MinStack {
    private final Deque<Integer> items = new ArrayDeque<>();
    private final Deque<Integer> minimums = new ArrayDeque<>();

    public MinStack() {
    }

    public void push(int val) {
        items.push(val);
        minimums.push(minimums.isEmpty() ? val : Math.min(val, minimums.peek()));
    }

    public void pop() {
        items.pop();
        minimums.pop();
    }

    public int top() {
        return items.peek();
    }

    public int getMin() {
        return minimums.peek();
    }
}
