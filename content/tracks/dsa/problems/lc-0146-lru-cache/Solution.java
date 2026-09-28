import java.util.*;

class LRUCache {
    // A hash map finds a key's node in O(1); a doubly linked list keeps the nodes in use order:
    // the least recently used right after head, the most recent right before tail.
    private static final class CacheNode {
        int key;
        int value;
        CacheNode prev;
        CacheNode next;

        CacheNode(int key, int value) {
            this.key = key;
            this.value = value;
        }
    }

    private final int capacity;
    private final Map<Integer, CacheNode> nodes = new HashMap<>();
    private final CacheNode head = new CacheNode(0, 0); // sentinels: no null checks when linking
    private final CacheNode tail = new CacheNode(0, 0);

    public LRUCache(int capacity) {
        this.capacity = capacity;
        head.next = tail;
        tail.prev = head;
    }

    private void unlink(CacheNode node) {
        node.prev.next = node.next;
        node.next.prev = node.prev;
    }

    private void append(CacheNode node) {
        node.prev = tail.prev;
        node.next = tail;
        tail.prev.next = node;
        tail.prev = node;
    }

    public int get(int key) {
        CacheNode node = nodes.get(key);
        if (node == null) {
            return -1;
        }
        unlink(node); // a read makes the key the most recent
        append(node);
        return node.value;
    }

    public void put(int key, int value) {
        CacheNode node = nodes.get(key);
        if (node != null) {
            node.value = value;
            unlink(node);
            append(node);
            return;
        }
        if (nodes.size() == capacity) {
            CacheNode oldest = head.next; // evict the least recently used
            unlink(oldest);
            nodes.remove(oldest.key);
        }
        node = new CacheNode(key, value);
        nodes.put(key, node);
        append(node);
    }
}
