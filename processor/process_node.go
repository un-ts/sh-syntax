package processor

// ProcessNode prints an encoded syntax tree and returns the same envelope shape
// as Process, with a null file because no parse is performed.
func ProcessNode(encoded []byte, printerOptions PrinterOptions) []byte {
	textOut, err := PrintNode(encoded, printerOptions)
	message := ""
	if err != nil {
		message = err.Error()
	}

	return encodeResult(nil, textOut, nil, message)
}
