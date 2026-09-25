package main

import (
	"strconv"
	"strings"
)

type Codec struct{}

func Constructor() Codec {
	return Codec{}
}

// Encode turns each string into "<length>#<string>": the length says where it ends, so the
// string itself may contain '#' or digits.
func (codec *Codec) Encode(strs []string) string {
	var encoded strings.Builder
	for _, str := range strs {
		encoded.WriteString(strconv.Itoa(len(str)))
		encoded.WriteByte('#')
		encoded.WriteString(str)
	}
	return encoded.String()
}

func (codec *Codec) Decode(s string) []string {
	result := []string{}
	for i := 0; i < len(s); {
		j := i + strings.IndexByte(s[i:], '#') // the first '#' from i closes the length prefix
		length, _ := strconv.Atoi(s[i:j])
		result = append(result, s[j+1:j+1+length])
		i = j + 1 + length
	}
	return result
}
