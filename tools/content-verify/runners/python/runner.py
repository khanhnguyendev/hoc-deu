"""content-verify Python runner (platform design §3.7).

Reads one JSON request from stdin:
    {"file": "solution.py", "method": "twoSum", "args": [...], "output": null | <arg index>}
loads the solution, calls Solution().<method>(*args) and prints the result as JSON on stdout (for
an in-place signature, args[output] after the call). The solution's own print() output goes to
stderr, so it never corrupts the result. A crash exits 1 with "<Type>: <message>" as the first
line of stderr. The Node orchestrator enforces the timeout and compares.
"""

import importlib.util
import json
import math
import sys
import threading
import traceback

RECURSION_LIMIT = 100_000
STACK_BYTES = 256 * 1024 * 1024


def sanitize(value):
    """NaN and infinities have no JSON form: report them as null (as the Java and Go runners do)."""
    if isinstance(value, float) and (math.isnan(value) or math.isinf(value)):
        return None
    if isinstance(value, (list, tuple)):
        return [sanitize(item) for item in value]
    return value


def solve(request):
    spec = importlib.util.spec_from_file_location("solution", request["file"])
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    args = request["args"]
    result = getattr(module.Solution(), request["method"])(*args)
    if request["output"] is not None:
        result = args[request["output"]]
    return result


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
