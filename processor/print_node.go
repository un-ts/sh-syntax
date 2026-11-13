package processor

import (
	"fmt"

	"mvdan.cc/sh/v3/syntax"
)

// PrintNode formats an encoded syntax tree. Unlike Print, the tree is used as
// given, including edits made by the caller, rather than reparsing source text.
func PrintNode(encoded []byte, options PrinterOptions) (text string, err error) {
	defer func() {
		if recovered := recover(); recovered != nil {
			text = ""
			err = fmt.Errorf("print(ast): %v", recovered)
		}
	}()

	node, err := decodeNode(encoded)
	if err != nil {
		return "", err
	}

	file, ok := node.(*syntax.File)
	if !ok {
		return "", fmt.Errorf("print(ast) requires a File node, got %T", node)
	}

	return printFile(file, options)
}
