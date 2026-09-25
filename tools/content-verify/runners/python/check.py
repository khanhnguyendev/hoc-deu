"""content-verify Python syntax and signature check (platform design §3.7).

    python3 -I -B check.py <file> '{"className": "Solution", "methods": ["twoSum"]}'

Compiles the file with compile(src, path, "exec") (no __pycache__ is written) and checks with ast
that the top-level class exists and defines every method. Prints {"ok": ..., "reason": ...} on
stdout; on failure also prints the reason on stderr and exits 1.
"""

import ast
import json
import sys


def check(path, target):
    with open(path, encoding="utf-8") as handle:
        source = handle.read()
    try:
        compile(source, path, "exec")
        tree = ast.parse(source, path)
    except SyntaxError as error:
        return f"{path}:{error.lineno}: SyntaxError: {error.msg}"

    class_name = target["className"]
    classes = [
        node for node in tree.body if isinstance(node, ast.ClassDef) and node.name == class_name
    ]
    if not classes:
        return f"{path}: no top-level class {class_name}"
    defined = {
        node.name
        for node in classes[-1].body
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
    }
    for method in target["methods"]:
        if method not in defined:
            return f"{path}: class {class_name} has no method {method}"
    return None


def main():
    reason = check(sys.argv[1], json.loads(sys.argv[2]))
    print(json.dumps({"ok": reason is None, "reason": reason}))
    if reason is not None:
        sys.stderr.write(reason + "\n")
        sys.exit(1)


if __name__ == "__main__":
    main()
