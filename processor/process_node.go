package processor

import "bytes"

// ProcessNode prints an encoded syntax tree and returns the same envelope shape
// as Process, with a null file because no parse is performed.
func ProcessNode(encoded []byte, printerOptions PrinterOptions) []byte {
	textOut, err := PrintNode(encoded, printerOptions)
	message := ""
	if err != nil {
		message = err.Error()
	}

	var out bytes.Buffer
	out.Grow(len(textOut) + len(message) + 64)
	out.WriteString(`{"file":null,"text":`)
	writeString(&out, textOut)
	out.WriteString(`,"parseError":null,"message":`)
	writeString(&out, message)
	out.WriteByte('}')
	return out.Bytes()
}
