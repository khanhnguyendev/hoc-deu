from typing import List


class Solution:
    def evalRPN(self, tokens: List[str]) -> int:
        stack: List[int] = []
        for token in tokens:
            if token not in ("+", "-", "*", "/"):
                stack.append(int(token))
                continue
            # The first value popped is the right operand.
            right = stack.pop()
            left = stack.pop()
            if token == "+":
                stack.append(left + right)
            elif token == "-":
                stack.append(left - right)
            elif token == "*":
                stack.append(left * right)
            else:
                # Truncate toward zero; Python's // would round toward negative infinity.
                quotient = abs(left) // abs(right)
                stack.append(quotient if (left < 0) == (right < 0) else -quotient)
        return stack[-1]
