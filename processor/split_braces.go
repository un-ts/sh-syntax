package processor

import (
	"bytes"

	"mvdan.cc/sh/v3/syntax"
)

// SplitBraces replaces brace expansions in a Word with BraceExp parts.
func SplitBraces(encoded []byte) ([]byte, error) {
	node, err := DecodeNodeBinary(encoded)
	if err != nil {
		return nil, err
	}
	word, ok := node.(*syntax.Word)
	if !ok {
		return nil, &SplitBracesError{Type: nodeTypeName(node)}
	}
	syntax.SplitBraces(word)
	var out bytes.Buffer
	if err := EncodeNodeBinary(&out, word); err != nil {
		return nil, err
	}
	return out.Bytes(), nil
}

type SplitBracesError struct {
	Type string
}

func (e *SplitBracesError) Error() string {
	return "splitBraces requires a Word node, got " + e.Type
}

func nodeTypeName(node syntax.Node) string {
	switch node.(type) {
	case *syntax.Word:
		return "Word"
	case *syntax.File:
		return "File"
	case *syntax.Stmt:
		return "Stmt"
	default:
		return "node"
	}
}
