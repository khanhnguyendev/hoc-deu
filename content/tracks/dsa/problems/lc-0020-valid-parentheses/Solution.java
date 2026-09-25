import java.util.*;

class Solution {
    public boolean isValid(String s) {
        // Each closing bracket must match the most recent unmatched opening bracket.
        Map<Character, Character> opener = Map.of(')', '(', ']', '[', '}', '{');
        Deque<Character> stack = new ArrayDeque<>();
        for (char ch : s.toCharArray()) {
            Character open = opener.get(ch);
            if (open != null) {
                if (stack.isEmpty() || !stack.peek().equals(open)) {
                    return false;
                }
                stack.pop();
            } else {
                stack.push(ch);
            }
        }
        // Anything left open was never closed.
        return stack.isEmpty();
    }
}
