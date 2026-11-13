package processor

import (
	"bytes"
	"testing"
)

func printAST(t *testing.T, source string) string {
	t.Helper()
	file, err := Parse(source, "", ParserOptions{KeepComments: true})
	if err != nil {
		t.Fatal(err)
	}
	var encoded bytes.Buffer
	if err := EncodeNodeBinary(&encoded, file); err != nil {
		t.Fatal(err)
	}
	got, err := PrintNode(encoded.Bytes(), PrinterOptions{})
	if err != nil {
		t.Fatal(err)
	}
	return got
}

func formatSource(t *testing.T, source string) string {
	t.Helper()
	got, err := Print(source, "", SyntaxOptions{ParserOptions: ParserOptions{KeepComments: true}})
	if err != nil {
		t.Fatal(err)
	}
	return got
}

func requirePrintError(t *testing.T, source string) {
	t.Helper()
	if _, err := PrintNode([]byte(source), PrinterOptions{}); err == nil {
		t.Fatal("expected an error")
	}
}

func TestPrintNodeRoundTrip(t *testing.T) {
	source := "echo 'hello' | grep hello\n"
	if got := printAST(t, source); got != source {
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
	if got, want := printAST(t, source), formatSource(t, source); got != want {
		t.Fatalf("got %q, want %q", got, want)
	}
}

func TestPrintNodeRejectsMalformedPayload(t *testing.T) {
	requirePrintError(t, "")
	requirePrintError(t, "\xff")
}

func TestPrintNodeRejectsTrailingData(t *testing.T) {
	file, err := Parse("echo hi\n", "", ParserOptions{KeepComments: true})
	if err != nil {
		t.Fatal(err)
	}
	var encoded bytes.Buffer
	if err := EncodeNodeBinary(&encoded, file); err != nil {
		t.Fatal(err)
	}
	if _, err := PrintNode(append(encoded.Bytes(), 0), PrinterOptions{}); err == nil {
		t.Fatal("expected an error")
	}
}

func TestPrintNodeUnicodeRoundTrip(t *testing.T) {
	source := "echo 'héllo' \"$(printf '😀')\"\n"
	if got, want := printAST(t, source), formatSource(t, source); got != want {
		t.Fatalf("got %q, want %q", got, want)
	}
}
