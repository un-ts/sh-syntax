package processor

import (
	"encoding/binary"
	"encoding/json"
	"testing"

	"mvdan.cc/sh/v3/syntax"
)

func interactiveResult(t *testing.T, out []byte) (map[string]any, []byte) {
	t.Helper()
	if len(out) < 4 {
		t.Fatal("expected framed result")
	}
	metaLength := binary.LittleEndian.Uint32(out)
	if int(metaLength) > len(out)-4 {
		t.Fatal("metadata exceeds result")
	}
	var metadata map[string]any
	if err := json.Unmarshal(out[4:4+metaLength], &metadata); err != nil {
		t.Fatal(err)
	}
	return metadata, out[4+metaLength:]
}

func TestProcessInteractive(t *testing.T) {
	metadata, ast := interactiveResult(t, ProcessInteractive("echo one\n", "", ParserOptions{}))
	interactive := metadata["interactive"].(map[string]any)
	if interactive["incomplete"] != false || interactive["remaining"] != "\n" {
		t.Fatalf("unexpected interactive metadata: %#v", interactive)
	}
	file, err := DecodeNodeBinary(ast)
	if err != nil {
		t.Fatal(err)
	}
	if len(file.(*syntax.File).Stmts) != 1 {
		t.Fatalf("got %d statements, want 1", len(file.(*syntax.File).Stmts))
	}
}

func TestProcessInteractiveKeepsTrailingText(t *testing.T) {
	metadata, ast := interactiveResult(t, ProcessInteractive("echo one\n# trailing\n", "", ParserOptions{}))
	interactive := metadata["interactive"].(map[string]any)
	if interactive["incomplete"] != false {
		t.Fatalf("expected complete, got %#v", interactive)
	}
	if interactive["remaining"] != "\n# trailing\n" {
		t.Fatalf("remaining = %#v", interactive["remaining"])
	}
	file, err := DecodeNodeBinary(ast)
	if err != nil {
		t.Fatal(err)
	}
	if len(file.(*syntax.File).Stmts) != 1 {
		t.Fatalf("got %d statements, want 1", len(file.(*syntax.File).Stmts))
	}
}

func TestProcessInteractiveIncomplete(t *testing.T) {
	metadata, _ := interactiveResult(t, ProcessInteractive("echo one\nif true; then\n", "", ParserOptions{}))
	interactive := metadata["interactive"].(map[string]any)
	if interactive["incomplete"] != true {
		t.Fatalf("expected incomplete, got %#v", interactive)
	}
	if interactive["remaining"] != "\nif true; then\n" {
		t.Fatalf("remaining = %#v", interactive["remaining"])
	}
}

func TestProcessInteractiveNoNewlineIsIncomplete(t *testing.T) {
	for _, source := range []string{"echo one", "cat <<DOC\nbody\nDOC"} {
		metadata, _ := interactiveResult(t, ProcessInteractive(source, "", ParserOptions{}))
		interactive := metadata["interactive"].(map[string]any)
		if interactive["incomplete"] != true {
			t.Fatalf("%q: expected incomplete, got %#v", source, interactive)
		}
		if interactive["remaining"] != source {
			t.Fatalf("%q: remaining = %#v", source, interactive["remaining"])
		}
	}
}

func TestProcessInteractiveDoesNotDuplicateStatements(t *testing.T) {
	metadata, ast := interactiveResult(t, ProcessInteractive("echo a; if true; then\n", "", ParserOptions{}))
	interactive := metadata["interactive"].(map[string]any)
	if interactive["incomplete"] != true {
		t.Fatalf("expected incomplete, got %#v", interactive)
	}
	file, err := DecodeNodeBinary(ast)
	if err != nil {
		t.Fatal(err)
	}
	if got := len(file.(*syntax.File).Stmts); got != 1 {
		t.Fatalf("got %d statements, want 1", got)
	}
}
