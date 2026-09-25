from typing import List


class Solution:
    def dailyTemperatures(self, temperatures: List[int]) -> List[int]:
        answer = [0] * len(temperatures)
        # Indices of days still waiting for a warmer day; their temperatures never increase
        # from bottom to top.
        waiting: List[int] = []
        for day, temp in enumerate(temperatures):
            while waiting and temperatures[waiting[-1]] < temp:
                earlier = waiting.pop()
                answer[earlier] = day - earlier
            waiting.append(day)
        return answer
