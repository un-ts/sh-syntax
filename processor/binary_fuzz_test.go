package processor

import (
	"bytes"
	"testing"
)

func FuzzDecodeNodeBinary(f *testing.F) {
	for _, source := range []string{"echo hi\n", "a=(1 2)\n", "case x in a) echo a ;; esac\n"} {
		file, err := Parse(source, "", ParserOptions{KeepComments: true})
		if err != nil {
			f.Fatal(err)
		}
		var encoded bytes.Buffer
		if err := EncodeNodeBinary(&encoded, file); err != nil {
			f.Fatal(err)
		}
		f.Add(encoded.Bytes())
	}
	f.Fuzz(func(t *testing.T, data []byte) {
		// Keep decoder panics visible; PrintNode then exercises the guarded
		// WASM boundary for structurally incomplete trees.
		if _, err := DecodeNodeBinary(data); err != nil {
			return
		}
		_, _ = PrintNode(data, PrinterOptions{})
	})
}
