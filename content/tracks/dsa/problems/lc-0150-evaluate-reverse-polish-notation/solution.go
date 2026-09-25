package main

import "strconv"

func evalRPN(tokens []string) int {
	stack := []int{}
	for _, token := range tokens {
		if token != "+" && token != "-" && token != "*" && token != "/" {
			value, _ := strconv.Atoi(token) // tokens are valid integers
			stack = append(stack, value)
			continue
		}
		// The first value popped is the right operand.
		right := stack[len(stack)-1]
		left := stack[len(stack)-2]
		stack = stack[:len(stack)-2]
		// Go's integer division already truncates toward zero.
		switch token {
		case "+":
			stack = append(stack, left+right)
		case "-":
			stack = append(stack, left-right)
		case "*":
			stack = append(stack, left*right)
		default:
			stack = append(stack, left/right)
		}
	}
	return stack[len(stack)-1]
}
