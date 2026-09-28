from typing import Dict, Optional


class CacheNode:
    def __init__(self, key: int = 0, value: int = 0) -> None:
        self.key = key
        self.value = value
        self.prev: Optional["CacheNode"] = None
        self.next: Optional["CacheNode"] = None


class LRUCache:
    # A hash map finds a key's node in O(1); a doubly linked list keeps the nodes in use order:
    # the least recently used right after head, the most recent right before tail.
    def __init__(self, capacity: int) -> None:
        self.capacity = capacity
        self.nodes: Dict[int, CacheNode] = {}
        self.head = CacheNode()  # sentinels: no None checks when linking
        self.tail = CacheNode()
        self.head.next = self.tail
        self.tail.prev = self.head

    def _unlink(self, node: CacheNode) -> None:
        node.prev.next = node.next
        node.next.prev = node.prev

    def _append(self, node: CacheNode) -> None:
        node.prev = self.tail.prev
        node.next = self.tail
        self.tail.prev.next = node
        self.tail.prev = node

    def get(self, key: int) -> int:
        node = self.nodes.get(key)
        if node is None:
            return -1
        self._unlink(node)  # a read makes the key the most recent
        self._append(node)
        return node.value

    def put(self, key: int, value: int) -> None:
        node = self.nodes.get(key)
        if node is not None:
            node.value = value
            self._unlink(node)
            self._append(node)
            return
        if len(self.nodes) == self.capacity:
            oldest = self.head.next  # evict the least recently used
            self._unlink(oldest)
            del self.nodes[oldest.key]
        node = CacheNode(key, value)
        self.nodes[key] = node
        self._append(node)
