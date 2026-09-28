package main

import (
	"strconv"
	"strings"
)

type Codec struct{}

func Constructor() Codec {
	return Codec{}
}

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
	var result []string // nil for no strings: printed as []
	for i := 0; i < len(s); {
		j := i + strings.IndexByte(s[i:], '#')
		length, _ := strconv.Atoi(s[i:j])
		result = append(result, s[j+1:j+1+length])
		i = j + 1 + length
	}
	return result
}
