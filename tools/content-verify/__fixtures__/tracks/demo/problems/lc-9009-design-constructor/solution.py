class Counter:
    def __init__(self, start: int) -> None:
        self.total = start
        self.added = set()

    def add(self, n: int) -> int:
        self.added.add(n)
        self.total += n
        return self.total

    def seen(self, n: int) -> bool:
        return n in self.added
