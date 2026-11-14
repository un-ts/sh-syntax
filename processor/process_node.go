package processor

// ProcessNode prints a binary syntax tree and returns the same framed result shape as Process.
func ProcessNode(encoded []byte, printerOptions PrinterOptions) []byte {
	textOut, err := PrintNode(encoded, printerOptions)
	message := ""
	if err != nil {
		message = err.Error()
	}

	return encodeResult(nil, textOut, nil, message, nil, errorKindPrint)
}
