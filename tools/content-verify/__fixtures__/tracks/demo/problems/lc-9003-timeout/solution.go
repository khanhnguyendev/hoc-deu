package main

func firstMark(grid [][]byte) byte {
	for _, row := range grid {
		for _, cell := range row {
			if cell != '.' {
				return cell
			}
		}
	}
	return '.'
}
