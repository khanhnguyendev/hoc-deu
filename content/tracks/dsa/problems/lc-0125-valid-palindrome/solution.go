package main

func isPalindrome(s string) bool {
	// Two pointers walk inward, skipping anything that is not a letter or a digit.
	left, right := 0, len(s)-1
	for left < right {
		a, b := s[left], s[right]
		if !isAlphanumeric(a) {
			left++
		} else if !isAlphanumeric(b) {
			right--
		} else if toLower(a) != toLower(b) {
			return false
		} else {
			left++
			right--
		}
	}
	return true
}

// The input is printable ASCII, so byte-level checks are enough.
func isAlphanumeric(c byte) bool {
	return ('a' <= c && c <= 'z') || ('A' <= c && c <= 'Z') || ('0' <= c && c <= '9')
}

func toLower(c byte) byte {
	if 'A' <= c && c <= 'Z' {
		return c + ('a' - 'A')
	}
	return c
}
