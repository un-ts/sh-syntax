package processor

import (
	"bytes"
	"testing"
)

func TestPrintNodeRoundTrip(t *testing.T) {
	source := "echo 'hello' | grep hello\n"
	file, err := Parse(source, "", ParserOptions{KeepComments: true})
	if err != nil {
		t.Fatal(err)
	}
	var encoded bytes.Buffer
	if err := EncodeNode(&encoded, file); err != nil {
		t.Fatal(err)
	}
	got, err := PrintNode(encoded.Bytes(), "", SyntaxOptions{})
	if err != nil {
		t.Fatal(err)
	}
	if got != source {
		t.Fatalf("got %q, want %q", got, source)
	}
}

func TestPrintNodeComplexRoundTrip(t *testing.T) {
	source := `#!/bin/bash
foo() { echo "$@"; }
if true; then
  for x in a b; do echo "$x"; done
elif false; then
  case "$x" in
    a) echo a ;;
    *) echo other ;;
  esac
else
  echo "$(printf '%s' "$x")" >&2
fi
`
	file, err := Parse(source, "", ParserOptions{KeepComments: true})
	if err != nil {
		t.Fatal(err)
	}
	var encoded bytes.Buffer
	if err := EncodeNode(&encoded, file); err != nil {
		t.Fatal(err)
	}
	got, err := PrintNode(encoded.Bytes(), "", SyntaxOptions{})
	if err != nil {
		t.Fatal(err)
	}
	if got == "" {
		t.Fatal("empty output")
	}
}
