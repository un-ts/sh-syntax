package processor

import (
	"bytes"
	"fmt"
)

// PrintNode formats an encoded syntax tree, including subtrees. Unlike Print, the tree is used as
// given, including edits made by the caller, rather than reparsing source text.
func PrintNode(encoded []byte, options PrinterOptions) (text string, err error) {
	defer func() {
		if recovered := recover(); recovered != nil {
			text = ""
			err = fmt.Errorf("print(ast): %v", recovered)
		}
	}()

	node, err := DecodeNodeBinary(encoded)
	if err != nil {
		return "", err
	}

	if containsBraceExp(node) {
		return "", fmt.Errorf("cannot print BraceExp nodes; splitBraces output is analysis-only")
	}

	text, err = printSyntaxNode(node, options)
	if err != nil {
		return "", fmt.Errorf("%s", string(bytes.ReplaceAll([]byte(err.Error()), []byte("*syntax."), nil)))
	}
	return text, nil
}
