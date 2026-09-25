package main

func isValid(s string) bool {
	// Each closing bracket must match the most recent unmatched opening bracket.
	opener := map[byte]byte{')': '(', ']': '[', '}': '{'}
	stack := []byte{}
	for i := 0; i < len(s); i++ {
		ch := s[i]
		if open, isCloser := opener[ch]; isCloser {
			if len(stack) == 0 || stack[len(stack)-1] != open {
				return false
			}
			stack = stack[:len(stack)-1]
		} else {
			stack = append(stack, ch)
		}
	}
	// Anything left open was never closed.
	return len(stack) == 0
}
