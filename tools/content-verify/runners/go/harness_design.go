// content-verify Go runner: records a design-class operation's result (M3c). Copied next to the
// generated main_harness.go for a design class; standard library only.

package main

import "encoding/json"

// harnessNull is the recorded result of the constructor and of a void method.
var harnessNull = json.RawMessage("null")

// harnessSnapshot encodes v when its operation returns, so a later operation that changes a slice
// or map the method returned cannot change the recorded result.
func harnessSnapshot(v any) json.RawMessage {
	encoded, err := json.Marshal(harnessNormalize(v))
	if err != nil {
		panic(err)
	}
	return encoded
}
