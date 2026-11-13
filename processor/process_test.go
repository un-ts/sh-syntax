package processor

import (
	"encoding/binary"
	"strings"
	"testing"
)

func TestProcessParseErrorDoesNotEncodePartialTree(t *testing.T) {
	out := Process(nil, []byte("if true; then\n"), false, ParserOptions{KeepComments: true}, PrinterOptions{})
	if len(out) < 4 {
		t.Fatal("expected a framed result")
	}
	metadataLength := binary.LittleEndian.Uint32(out)
	if int(metadataLength) > len(out)-4 {
		t.Fatal("metadata exceeds result")
	}
	metadata := string(out[4 : 4+metadataLength])
	if !strings.Contains(metadata, `"parseError":{`) {
		t.Fatalf("expected a parse error, got %s", metadata)
	}
}
