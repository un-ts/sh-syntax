package processor

// ProcessSplitBraces splits brace expansions and returns a framed binary result.
func ProcessSplitBraces(encoded []byte) []byte {
	ast, changed, err := SplitBraces(encoded)
	message := ""
	if err != nil {
		message = err.Error()
	}
	return encodeResult(ast, "", nil, message, resultMeta{changed: &changed, errorKind: errorKindSplitBraces})
}
