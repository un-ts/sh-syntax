package processor

import (
	"bytes"
	"strings"
	"testing"

	"mvdan.cc/sh/v3/syntax"
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
	file, err := Parse(source, "", ParserOptions{KeepComments: true})
	if err != nil {
		t.Fatal(err)
	}
	got, err := printSyntaxNode(file, PrinterOptions{})
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

func TestPrintNodeRecoversPrinterPanic(t *testing.T) {
	var encoded bytes.Buffer
	writeBinaryUint(&encoded, binaryNodeIDs["File"])
	writeBinaryUint(&encoded, 0)
	writeBinaryUint(&encoded, 0)
	writeBinaryString(&encoded, "")
	writeBinaryUint(&encoded, 1)
	writeBinaryBool(&encoded, true)
	writeBinaryUint(&encoded, 0)
	writeBinaryUint(&encoded, 0)
	writeBinaryUint(&encoded, 0)
	writeBinaryUint(&encoded, binaryNodeIDs["CallExpr"])
	writeBinaryUint(&encoded, 0)
	writeBinaryUint(&encoded, 0)
	writeBinaryUint(&encoded, 0)
	writeBinaryUint(&encoded, 1)
	writeBinaryBool(&encoded, true)
	writeBinaryUint(&encoded, 0)
	writeBinaryUint(&encoded, 0)
	writeBinaryUint(&encoded, 0)
	writeBinaryPos(&encoded, syntax.Pos{})
	writeBinaryPos(&encoded, syntax.Pos{})
	writeBinaryBool(&encoded, false)
	writeBinaryBool(&encoded, false)
	writeBinaryBool(&encoded, false)
	writeBinaryBool(&encoded, false)
	writeBinaryUint(&encoded, 0)
	writeBinaryUint(&encoded, 0)
	if _, err := PrintNode(encoded.Bytes(), PrinterOptions{}); err == nil {
		t.Fatal("expected a printer error")
	}
}

func TestPrintNodeSubtree(t *testing.T) {
	file, err := Parse("echo hi\n", "", ParserOptions{KeepComments: true})
	if err != nil {
		t.Fatal(err)
	}
	stmt := file.Stmts[0]
	if got := printNodeWithPrinter(t, stmt); got != "echo hi" {
		t.Fatalf("got %q, want %q", got, "echo hi")
	}
}

func printNodeWithPrinter(t *testing.T, node syntax.Node) string {
	t.Helper()
	var encoded bytes.Buffer
	if err := EncodeNodeBinary(&encoded, node); err != nil {
		t.Fatal(err)
	}
	got, err := PrintNode(encoded.Bytes(), PrinterOptions{})
	if err != nil {
		t.Fatal(err)
	}
	return got
}

func TestPrintNodeErrorUsesJSTypeName(t *testing.T) {
	file, err := Parse("echo hi >out\n", "", ParserOptions{KeepComments: true})
	if err != nil {
		t.Fatal(err)
	}
	var encoded bytes.Buffer
	if err := EncodeNodeBinary(&encoded, file.Stmts[0].Redirs[0]); err != nil {
		t.Fatal(err)
	}
	_, err = PrintNode(encoded.Bytes(), PrinterOptions{})
	if err == nil || strings.Contains(err.Error(), "*syntax.") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestPrintNodeRejectsBraceExp(t *testing.T) {
	file, err := Parse("echo {a,b}\n", "", ParserOptions{})
	if err != nil {
		t.Fatal(err)
	}
	word := file.Stmts[0].Cmd.(*syntax.CallExpr).Args[1]
	syntax.SplitBraces(word)
	var encoded bytes.Buffer
	if err := EncodeNodeBinary(&encoded, word); err != nil {
		t.Fatal(err)
	}
	if _, err := PrintNode(encoded.Bytes(), PrinterOptions{}); err == nil || !strings.Contains(err.Error(), "BraceExp") {
		t.Fatalf("unexpected error: %v", err)
	}
}
