package processor

// ProcessSplitBraces splits brace expansions and returns a framed binary result.
func ProcessSplitBraces(encoded []byte) []byte {
	ast, err := SplitBraces(encoded)
	message := ""
	if err != nil {
		message = err.Error()
	}
	return encodeResult(ast, "", nil, message)
}
