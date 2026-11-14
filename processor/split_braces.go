package processor

import (
	"bytes"
	"fmt"

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
		return nil, &SplitBracesError{Type: string(bytes.ReplaceAll([]byte(fmt.Sprintf("%T", node)), []byte("*syntax."), nil))}
	}
	syntax.SplitBraces(word)
	clearSplitLitPositions(word)
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
