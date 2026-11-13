package processor

import (
	"bytes"
	"testing"

	"mvdan.cc/sh/v3/syntax"
)

func TestSplitBraces(t *testing.T) {
	file, err := Parse("echo {a,b}\n", "", ParserOptions{})
	if err != nil {
		t.Fatal(err)
	}
	call := file.Stmts[0].Cmd.(*syntax.CallExpr)
	word := call.Args[1]
	encoded := new(bytes.Buffer)
	if err := EncodeNodeBinary(encoded, word); err != nil {
		t.Fatal(err)
	}
	result, err := SplitBraces(encoded.Bytes())
	if err != nil {
		t.Fatal(err)
	}
	node, err := DecodeNodeBinary(result)
	if err != nil {
		t.Fatal(err)
	}
	split := node.(*syntax.Word)
	found := false
	for _, part := range split.Parts {
		if _, ok := part.(*syntax.BraceExp); ok {
			found = true
		}
	}
	if !found {
		t.Fatal("expected a BraceExp")
	}
}
