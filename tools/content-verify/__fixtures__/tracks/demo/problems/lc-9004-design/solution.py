from typing import List


class MinStack:
    def __init__(self) -> None:
        self.items: List[int] = []
        self.minimums: List[int] = []

    def push(self, val: int) -> None:
        self.items.append(val)
        self.minimums.append(val if not self.minimums else min(val, self.minimums[-1]))

    def pop(self) -> None:
        self.items.pop()
        self.minimums.pop()

    def top(self) -> int:
        return self.items[-1]

    def getMin(self) -> int:
        return self.minimums[-1]
