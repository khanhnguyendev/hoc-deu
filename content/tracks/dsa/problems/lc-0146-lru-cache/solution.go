package main

// A hash map finds a key's node in O(1); a doubly linked list keeps the nodes in use order:
// the least recently used right after head, the most recent right before tail.
type cacheNode struct {
	key, value int
	prev, next *cacheNode
}

type LRUCache struct {
	capacity   int
	nodes      map[int]*cacheNode
	head, tail *cacheNode // sentinels: no nil checks when linking
}

func Constructor(capacity int) LRUCache {
	head, tail := &cacheNode{}, &cacheNode{}
	head.next = tail
	tail.prev = head
	return LRUCache{capacity: capacity, nodes: map[int]*cacheNode{}, head: head, tail: tail}
}

func (this *LRUCache) unlink(node *cacheNode) {
	node.prev.next = node.next
	node.next.prev = node.prev
}

func (this *LRUCache) append(node *cacheNode) {
	node.prev = this.tail.prev
	node.next = this.tail
	this.tail.prev.next = node
	this.tail.prev = node
}

func (this *LRUCache) Get(key int) int {
	node, ok := this.nodes[key]
	if !ok {
		return -1
	}
	this.unlink(node) // a read makes the key the most recent
	this.append(node)
	return node.value
}

func (this *LRUCache) Put(key int, value int) {
	if node, ok := this.nodes[key]; ok {
		node.value = value
		this.unlink(node)
		this.append(node)
		return
	}
	if len(this.nodes) == this.capacity {
		oldest := this.head.next // evict the least recently used
		this.unlink(oldest)
		delete(this.nodes, oldest.key)
	}
	node := &cacheNode{key: key, value: value}
	this.nodes[key] = node
	this.append(node)
}
