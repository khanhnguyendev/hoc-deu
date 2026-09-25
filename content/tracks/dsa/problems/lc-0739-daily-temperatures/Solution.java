import java.util.*;

class Solution {
    public int[] dailyTemperatures(int[] temperatures) {
        int[] answer = new int[temperatures.length];
        // Indices of days still waiting for a warmer day; their temperatures never increase
        // from bottom to top.
        Deque<Integer> waiting = new ArrayDeque<>();
        for (int day = 0; day < temperatures.length; day++) {
            while (!waiting.isEmpty() && temperatures[waiting.peek()] < temperatures[day]) {
                int earlier = waiting.pop();
                answer[earlier] = day - earlier;
            }
            waiting.push(day);
        }
        return answer;
    }
}
