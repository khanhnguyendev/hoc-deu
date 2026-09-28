"""content-verify Python runner (platform design §3.7).

Reads one JSON request from stdin:
    {"file": "solution.py", "method": "twoSum", "args": [...], "output": null | <arg index>,
     "codecs": {"params": [<codec> | null, ...], "returns": <codec> | null, "copyOf": null | <i>}}
loads the solution, calls Solution().<method>(*args) and prints the result as JSON on stdout (for
an in-place signature, args[output] after the call). "codecs" (structured kinds, M3b) names the
LeetCode encoding of each argument and of the result: "list" (an array; {"values", "pos"} adds a
cycle), "lists", "tree" (level order with nulls), "graph" (adjacency list) or "random-list"
([[val, randomIndex | null], ...]); the dataclasses below are injected into the solution module as
ListNode, TreeNode and Node. With "copyOf", a result that reuses a node of args[copyOf] fails. The solution's own print() output goes to
stderr, so it never corrupts the result. A crash exits 1 with "<Type>: <message>" as the first
line of stderr. The Node orchestrator enforces the timeout and compares.
"""

import importlib.util
import json
import math
import sys
import threading
import traceback
from dataclasses import dataclass
from typing import List, Optional

RECURSION_LIMIT = 100_000
STACK_BYTES = 256 * 1024 * 1024


def sanitize(value):
    """NaN and infinities have no JSON form: report them as null (as the Java and Go runners do)."""
    if isinstance(value, float) and (math.isnan(value) or math.isinf(value)):
        return None
    if isinstance(value, (list, tuple)):
        return [sanitize(item) for item in value]
    return value


class ContentVerifyError(Exception):
    """A result the harness cannot encode (a cycle, a reused input node): the case fails."""


# eq=False: nodes compare and hash by identity, as LeetCode's classes do (a structural __eq__
# would recurse forever on a cycle); repr=False for the same reason.
@dataclass(eq=False, repr=False)
class ListNode:
    val: int = 0
    next: Optional["ListNode"] = None


@dataclass(eq=False, repr=False)
class TreeNode:
    val: int = 0
    left: Optional["TreeNode"] = None
    right: Optional["TreeNode"] = None


@dataclass(eq=False, repr=False)
class GraphNode:
    """LeetCode's graph Node(val=0, neighbors=None) (133)."""

    val: int = 0
    neighbors: Optional[List["GraphNode"]] = None

    def __post_init__(self):
        if self.neighbors is None:
            self.neighbors = []


@dataclass(eq=False, repr=False, init=False)
class RandomNode:
    """LeetCode's random-pointer Node(x, next=None, random=None) (138)."""

    val: int
    next: Optional["RandomNode"]
    random: Optional["RandomNode"]

    def __init__(self, x: int, next: "RandomNode" = None, random: "RandomNode" = None):
        self.val = x
        self.next = next
        self.random = random


GraphNode.__name__ = GraphNode.__qualname__ = "Node"
RandomNode.__name__ = RandomNode.__qualname__ = "Node"


def decode_list(value):
    values, pos = (value["values"], value["pos"]) if isinstance(value, dict) else (value, -1)
    nodes = [ListNode(item) for item in values]
    for node, following in zip(nodes, nodes[1:]):
        node.next = following
    if nodes and pos >= 0:
        nodes[-1].next = nodes[pos]
    return nodes[0] if nodes else None


def list_nodes(head):
    nodes, seen = [], set()
    while head is not None:
        if id(head) in seen:
            raise ContentVerifyError("the returned list has a cycle")
        seen.add(id(head))
        nodes.append(head)
        head = head.next
    return nodes


def encode_list(head):
    return [node.val for node in list_nodes(head)]


def decode_tree(values):
    if not values:
        return None
    root = TreeNode(values[0])
    queue, index = [root], 1
    for node in queue:
        if index >= len(values):
            break
        for side in ("left", "right"):
            if index < len(values) and values[index] is not None:
                child = TreeNode(values[index])
                setattr(node, side, child)
                queue.append(child)
            index += 1
    return root


def encode_tree(root):
    out, queue, seen = [], [root], set()
    for node in queue:
        if node is None:
            out.append(None)
            continue
        if id(node) in seen:
            raise ContentVerifyError("the returned tree has a cycle or a shared node")
        seen.add(id(node))
        out.append(node.val)
        queue.extend((node.left, node.right))
    while out and out[-1] is None:
        out.pop()
    return out


def decode_graph(adjacency):
    nodes = [GraphNode(index + 1) for index in range(len(adjacency))]
    for node, neighbours in zip(nodes, adjacency):
        node.neighbors = [nodes[number - 1] for number in neighbours]
    return nodes[0] if nodes else None


def graph_nodes(start):
    if start is None:
        return []
    nodes, seen = [start], {id(start)}
    for node in nodes:
        for neighbour in node.neighbors:
            if id(neighbour) not in seen:
                seen.add(id(neighbour))
                nodes.append(neighbour)
    return nodes


def encode_graph(start):
    nodes = graph_nodes(start)
    if sorted(node.val for node in nodes) != list(range(1, len(nodes) + 1)):
        raise ContentVerifyError("the returned graph's values are not 1..n, each once")
    out = [None] * len(nodes)
    for node in nodes:
        out[node.val - 1] = [neighbour.val for neighbour in node.neighbors]
    return out


def decode_random_list(entries):
    nodes = [RandomNode(val) for val, _ in entries]
    for node, following in zip(nodes, nodes[1:]):
        node.next = following
    for node, (_, random) in zip(nodes, entries):
        node.random = None if random is None else nodes[random]
    return nodes[0] if nodes else None


def random_list_nodes(head):
    nodes = list_nodes(head)
    index = {id(node): position for position, node in enumerate(nodes)}
    for node in nodes:
        if node.random is not None and id(node.random) not in index:
            raise ContentVerifyError("a random pointer leaves the returned list")
    return nodes, index


def encode_random_list(head):
    nodes, index = random_list_nodes(head)
    return [[node.val, None if node.random is None else index[id(node.random)]] for node in nodes]


def input_random_nodes(head):
    nodes, _ = random_list_nodes(head)
    return nodes


DECODERS = {
    "list": decode_list,
    "lists": lambda value: [decode_list(item) for item in value],
    "tree": decode_tree,
    "graph": decode_graph,
    "random-list": decode_random_list,
}
ENCODERS = {
    "list": encode_list,
    "lists": lambda value: [encode_list(item) for item in value],
    "tree": encode_tree,
    "graph": encode_graph,
    "random-list": encode_random_list,
}
# The nodes a deep copy must not reuse (133, 138).
NODES = {"graph": graph_nodes, "random-list": input_random_nodes}
# What the solution module sees as ListNode / TreeNode / Node for each codec.
CLASSES = {
    "list": {"ListNode": ListNode},
    "lists": {"ListNode": ListNode},
    "tree": {"TreeNode": TreeNode},
    "graph": {"Node": GraphNode},
    "random-list": {"Node": RandomNode},
}


def solve(request):
    codecs = request.get("codecs") or {"params": [], "returns": None, "copyOf": None}
    param_codecs = codecs["params"]
    spec = importlib.util.spec_from_file_location("solution", request["file"])
    module = importlib.util.module_from_spec(spec)
    for codec in [*param_codecs, codecs["returns"]]:
        for name, cls in CLASSES.get(codec, {}).items():
            setattr(module, name, cls)  # before exec: annotations name them at definition time
    spec.loader.exec_module(module)
    args = [
        value if codec is None else DECODERS[codec](value)
        for value, codec in zip(request["args"], param_codecs + [None] * len(request["args"]))
    ]
    copy_of = codecs["copyOf"]
    # Held (not just their ids) so no input node is freed and its id reused by a copy.
    inputs = [] if copy_of is None else NODES[param_codecs[copy_of]](args[copy_of])
    result = getattr(module.Solution(), request["method"])(*args)
    codec = codecs["returns"]
    if request["output"] is not None:
        result = args[request["output"]]
        codec = param_codecs[request["output"]] if param_codecs else None
    if copy_of is not None:
        reused = {id(node) for node in inputs} & {
            id(node) for node in NODES[codec](result)
        }
        if reused:
            raise ContentVerifyError("the result reuses an input node (expected a deep copy)")
    return result if codec is None else ENCODERS[codec](result)


def main():
    request = json.loads(sys.stdin.read())
    real_stdout = sys.stdout
    sys.stdout = sys.stderr
    outcome = {}

    def target():
        try:
            result = sanitize(solve(request))
            outcome["json"] = json.dumps(result, separators=(",", ":"), allow_nan=False)
        except BaseException as error:  # the solution's failure, reported below
            outcome["error"] = error
            outcome["trace"] = traceback.format_exc()

    # Deep recursion (a skewed input) should not crash where LeetCode would not: a large stack in a
    # worker thread, as the Java runner uses -Xss64m.
    sys.setrecursionlimit(RECURSION_LIMIT)
    try:
        threading.stack_size(STACK_BYTES)
    except (ValueError, RuntimeError):  # the platform refuses: keep its default stack
        pass
    worker = threading.Thread(target=target)
    worker.start()
    worker.join()

    if "error" in outcome:
        error = outcome["error"]
        sys.stderr.write(f"{type(error).__name__}: {error}\n{outcome['trace']}")
        sys.stderr.flush()
        sys.exit(1)
    real_stdout.write(outcome["json"])
    real_stdout.flush()


if __name__ == "__main__":
    main()
