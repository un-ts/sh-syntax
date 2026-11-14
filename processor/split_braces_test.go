package processor

import (
	"bytes"
	"strings"
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

func TestSplitBracesNoop(t *testing.T) {
	file, err := Parse("echo plain\n", "", ParserOptions{})
	if err != nil {
		t.Fatal(err)
	}
	word := file.Stmts[0].Cmd.(*syntax.CallExpr).Args[1]
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
	if got := node.(*syntax.Word).Lit(); got != "plain" {
		t.Fatalf("got %q, want plain", got)
	}
}

func TestSplitBracesRejectsNonWord(t *testing.T) {
	file, err := Parse("echo hi\n", "", ParserOptions{})
	if err != nil {
		t.Fatal(err)
	}
	var encoded bytes.Buffer
	if err := EncodeNodeBinary(&encoded, file.Stmts[0]); err != nil {
		t.Fatal(err)
	}
	if _, err := SplitBraces(encoded.Bytes()); err == nil || !strings.Contains(err.Error(), "Stmt") {
		t.Fatalf("unexpected error: %v", err)
	}
}
