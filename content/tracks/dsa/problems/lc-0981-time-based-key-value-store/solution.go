package main

type timedValue struct {
	timestamp int
	value     string
}

type TimeMap struct {
	// key -> entries; Set is called with increasing timestamps, so each slice stays sorted by
	// timestamp.
	history map[string][]timedValue
}

func Constructor() TimeMap {
	return TimeMap{history: map[string][]timedValue{}}
}

func (this *TimeMap) Set(key string, value string, timestamp int) {
	this.history[key] = append(this.history[key], timedValue{timestamp: timestamp, value: value})
}

func (this *TimeMap) Get(key string, timestamp int) string {
	entries := this.history[key]
	// Binary search for the last entry whose timestamp is <= the query.
	answer := ""
	lo, hi := 0, len(entries)-1
	for lo <= hi {
		mid := lo + (hi-lo)/2
		if entries[mid].timestamp <= timestamp {
			answer = entries[mid].value
			lo = mid + 1
		} else {
			hi = mid - 1
		}
	}
	return answer
}
