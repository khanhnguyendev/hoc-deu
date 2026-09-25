from typing import List, Tuple


class MinStack:
    def __init__(self) -> None:
        # Each entry keeps its value and the minimum of the stack up to and including it.
        self.entries: List[Tuple[int, int]] = []

    def push(self, val: int) -> None:
        minimum = val if not self.entries else min(val, self.entries[-1][1])
        self.entries.append((val, minimum))

    def pop(self) -> None:
        self.entries.pop()

    def top(self) -> int:
        return self.entries[-1][0]

    def getMin(self) -> int:
        return self.entries[-1][1]
