package processor

import (
	"bytes"
	"fmt"

	"mvdan.cc/sh/v3/syntax"
)

// SplitBraces replaces brace expansions in a Word with BraceExp parts.
func SplitBraces(encoded []byte) ([]byte, bool, error) {
	node, err := DecodeNodeBinary(encoded)
	if err != nil {
		return nil, false, err
	}
	word, ok := node.(*syntax.Word)
	if !ok {
		return nil, false, &SplitBracesError{Type: string(bytes.ReplaceAll([]byte(fmt.Sprintf("%T", node)), []byte("*syntax."), nil))}
	}
	changed := syntax.SplitBraces(word)
	if !changed {
		return encoded, false, nil
	}
	clearSplitLitPositions(word)
	var out bytes.Buffer
	if err := EncodeNodeBinary(&out, word); err != nil {
		return nil, false, err
	}
	return out.Bytes(), changed, nil
}

type SplitBracesError struct {
	Type string
}

func (e *SplitBracesError) Error() string {
	return "splitBraces requires a Word node, got " + e.Type
}
