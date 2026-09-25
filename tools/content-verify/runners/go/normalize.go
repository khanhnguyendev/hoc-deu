// content-verify Go runner: prepares a solution's result for encoding/json (platform design §3.7).
// Copied next to the generated main_harness.go for every problem; standard library only. The
// names carry a "harness" prefix so they cannot collide with a solution's own helpers.

package main

import (
	"math"
	"reflect"
)

// harnessNormalize returns v with every nil slice, at any depth, as an empty slice (encoding/json
// prints a nil slice as null, fix 8), every byte (a tests.yaml char) as a one-character string
// (encoding/json would base64-encode a []byte), and NaN or an infinity as nil (no JSON form).
func harnessNormalize(v any) any {
	if v == nil {
		return nil
	}
	return harnessNormalizeValue(reflect.ValueOf(v))
}

func harnessNormalizeValue(v reflect.Value) any {
	switch v.Kind() {
	case reflect.Interface, reflect.Pointer:
		if v.IsNil() {
			return nil
		}
		return harnessNormalizeValue(v.Elem())
	case reflect.Slice, reflect.Array:
		items := make([]any, v.Len())
		for i := range items {
			items[i] = harnessNormalizeValue(v.Index(i))
		}
		return items
	case reflect.Uint8:
		return string(rune(v.Uint()))
	case reflect.Float32, reflect.Float64:
		f := v.Float()
		if math.IsNaN(f) || math.IsInf(f, 0) {
			return nil
		}
		return f
	default:
		return v.Interface()
	}
}
