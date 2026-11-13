package processor

import "testing"

func FuzzDecodeString(f *testing.F) {
	for _, seed := range []string{`"hello"`, `"a\n\"b\u00e9\ud83d\ude00"`, `"\u12"`, `"\ud800"`} {
		f.Add([]byte(seed))
	}
	f.Fuzz(func(t *testing.T, data []byte) {
		var value string
		_ = decodeString(wireValue(data), &value)
	})
}

func FuzzDecodeNode(f *testing.F) {
	for _, seed := range []string{
		`{"type":"File","name":"","stmts":[],"lastComments":[]}`,
		`{"type":"File","stmts":[null],"lastComments":[]}`,
		`{"type":"CallExpr","args":[{"type":"Word","parts":[]}],"assigns":[],"redirs":[]}`,
	} {
		f.Add([]byte(seed))
	}
	f.Fuzz(func(t *testing.T, data []byte) {
		_, _ = decodeNode(wireValue(data))
	})
}
