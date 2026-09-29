from typing import Optional


class Solution:
    def cloneGraph(self, node: Optional["Node"]) -> Optional["Node"]:
        if node is None:
            return None
        copies = {node: Node(node.val)}
        stack = [node]
        while stack:
            current = stack.pop()
            for neighbor in current.neighbors:
                if neighbor not in copies:
                    copies[neighbor] = Node(neighbor.val)
                    stack.append(neighbor)
                copies[current].neighbors.append(copies[neighbor])
        return copies[node]
