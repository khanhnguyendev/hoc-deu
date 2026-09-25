from typing import List


class Codec:
    def encode(self, strs: List[str]) -> str:
        # Each string becomes "<length>#<string>": the length says where it ends, so the string
        # itself may contain '#' or digits.
        return "".join(f"{len(s)}#{s}" for s in strs)

    def decode(self, s: str) -> List[str]:
        result: List[str] = []
        i = 0
        while i < len(s):
            j = s.index("#", i)  # the first '#' from i closes the length prefix
            length = int(s[i:j])
            result.append(s[j + 1 : j + 1 + length])
            i = j + 1 + length
        return result
