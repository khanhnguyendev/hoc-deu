from typing import Dict, List, Tuple


class TimeMap:
    def __init__(self) -> None:
        # key -> (timestamp, value) pairs; set is called with increasing timestamps, so each
        # list stays sorted by timestamp.
        self.history: Dict[str, List[Tuple[int, str]]] = {}

    def set(self, key: str, value: str, timestamp: int) -> None:
        self.history.setdefault(key, []).append((timestamp, value))

    def get(self, key: str, timestamp: int) -> str:
        entries = self.history.get(key, [])
        # Binary search for the last entry whose timestamp is <= the query.
        answer = ""
        lo, hi = 0, len(entries) - 1
        while lo <= hi:
            mid = lo + (hi - lo) // 2
            if entries[mid][0] <= timestamp:
                answer = entries[mid][1]
                lo = mid + 1
            else:
                hi = mid - 1
        return answer
