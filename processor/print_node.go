package processor

import (
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

	if node == nil {
		return "", fmt.Errorf("print(node) requires a syntax node")
	}

	return printSyntaxNode(node, options)
}
