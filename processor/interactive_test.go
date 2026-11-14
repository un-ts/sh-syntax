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

func checkInteractive(t *testing.T, source string, incomplete bool, remaining string, statements int) {
	t.Helper()
	metadata, ast := interactiveResult(t, ProcessInteractive(source, "", ParserOptions{}))
	interactive := metadata["interactive"].(map[string]any)
	if interactive["incomplete"] != incomplete {
		t.Fatalf("%q: incomplete = %#v", source, interactive["incomplete"])
	}
	if interactive["remaining"] != remaining {
		t.Fatalf("%q: remaining = %#v", source, interactive["remaining"])
	}
	if statements < 0 {
		return
	}
	file, err := DecodeNodeBinary(ast)
	if err != nil {
		t.Fatal(err)
	}
	if got := len(file.(*syntax.File).Stmts); got != statements {
		t.Fatalf("%q: got %d statements, want %d", source, got, statements)
	}
}

func TestProcessInteractive(t *testing.T) {
	checkInteractive(t, "echo one\n", false, "\n", 1)
}

func TestProcessInteractiveKeepsTrailingText(t *testing.T) {
	checkInteractive(t, "echo one\n# trailing\n", false, "\n# trailing\n", 1)
}

func TestProcessInteractiveIncomplete(t *testing.T) {
	checkInteractive(t, "echo one\nif true; then\n", true, "\nif true; then\n", -1)
}

func TestProcessInteractiveNoNewlineIsIncomplete(t *testing.T) {
	for _, source := range []string{"echo one", "cat <<DOC\nbody\nDOC"} {
		checkInteractive(t, source, true, source, -1)
	}
}

func TestProcessInteractiveDoesNotDuplicateStatements(t *testing.T) {
	checkInteractive(t, "echo a; if true; then\n", true, " if true; then\n", 1)
}

func TestProcessInteractiveHeredocSemicolon(t *testing.T) {
	checkInteractive(t, "cat <<EOF;\nbody\nEOF\n", false, "\n", 1)
}

func TestProcessInteractiveIncompleteHeredoc(t *testing.T) {
	checkInteractive(t, "cat <<EOF;\n", true, "cat <<EOF;\n", -1)
}

func TestProcessInteractivePendingHeredocStatement(t *testing.T) {
	checkInteractive(t, "cat <<EOF; echo x\n", true, "cat <<EOF; echo x\n", 0)
}

func TestProcessInteractiveMixedPendingHeredoc(t *testing.T) {
	checkInteractive(t, "echo a\ncat <<EOF; echo x\n", true, "\ncat <<EOF; echo x\n", 1)
}

func TestProcessInteractiveHeredocSemicolonStatement(t *testing.T) {
	checkInteractive(t, "cat <<EOF; echo x\nbody\nEOF\n", false, "\n", 2)
}

func TestProcessInteractiveNestedPendingHeredoc(t *testing.T) {
	checkInteractive(t, "echo a && cat <<EOF; echo x\n", true, "echo a && cat <<EOF; echo x\n", 0)
}

func TestProcessInteractiveNestedHeredocCompletes(t *testing.T) {
	checkInteractive(t, "echo a && cat <<EOF; echo x\nbody\nEOF\n", false, "\n", 2)
}
