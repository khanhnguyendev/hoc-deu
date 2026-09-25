import java.util.*;

class Solution {
    private static final Set<String> OPERATORS = Set.of("+", "-", "*", "/");

    public int evalRPN(String[] tokens) {
        Deque<Integer> stack = new ArrayDeque<>();
        for (String token : tokens) {
            if (!OPERATORS.contains(token)) {
                stack.push(Integer.parseInt(token));
                continue;
            }
            // The first value popped is the right operand.
            int right = stack.pop();
            int left = stack.pop();
            // Java's integer division already truncates toward zero.
            stack.push(switch (token) {
                case "+" -> left + right;
                case "-" -> left - right;
                case "*" -> left * right;
                default -> left / right;
            });
        }
        return stack.peek();
    }
}
