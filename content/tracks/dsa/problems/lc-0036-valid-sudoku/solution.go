package main

func isValidSudoku(board [][]byte) bool {
	// rows[r][d] is true once digit d + 1 has appeared in row r; the same for columns and boxes.
	var rows, cols, boxes [9][9]bool
	for r := 0; r < 9; r++ {
		for c := 0; c < 9; c++ {
			cell := board[r][c]
			if cell == '.' {
				continue
			}
			d := cell - '1'
			b := (r/3)*3 + c/3 // boxes are numbered 0..8, row by row
			if rows[r][d] || cols[c][d] || boxes[b][d] {
				return false
			}
			rows[r][d], cols[c][d], boxes[b][d] = true, true, true
		}
	}
	return true
}
