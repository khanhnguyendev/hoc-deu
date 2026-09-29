from typing import List


class Faulty:
    def __init__(self, start: int) -> None:
        self.total = start
        self.values: List[int] = []

    def add(self, n: int) -> int:
        self.values.append(n)
        self.total += n
        return self.total

    def items(self) -> List[int]:
        return self.values  # the object's own list: add() changes it later

    def boom(self) -> int:
        return self.total // (self.total - self.total)

    def spin(self) -> None:
        while True:
            pass
