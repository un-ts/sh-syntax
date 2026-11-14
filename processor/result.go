package processor

import (
	"bytes"
	"encoding/binary"
)

// encodeResult frames metadata JSON and an optional binary AST payload:
// uint32 metadata length, metadata JSON, AST bytes.
func encodeResult(ast []byte, text string, parseError *ParseError, message string) []byte {
	return encodeResultChanged(ast, text, parseError, message, false)
}

func encodeResultChanged(ast []byte, text string, parseError *ParseError, message string, changed bool) []byte {
	var meta bytes.Buffer
	meta.WriteString(`{"text":`)
	writeString(&meta, text)
	meta.WriteString(`,"parseError":`)
	writeParseError(&meta, parseError)
	meta.WriteString(`,"message":`)
	writeString(&meta, message)
	meta.WriteString(`,"changed":`)
	writeBool(&meta, changed)
	meta.WriteByte('}')

	out := make([]byte, 4+meta.Len()+len(ast))
	binary.LittleEndian.PutUint32(out, uint32(meta.Len()))
	copy(out[4:], meta.Bytes())
	copy(out[4+meta.Len():], ast)
	return out
}
