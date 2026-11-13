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
		// PrintNode is the guarded WASM boundary; incomplete decoded trees are
		// expected to surface as errors rather than panic.
		_, _ = PrintNode(data, PrinterOptions{})
	})
}
