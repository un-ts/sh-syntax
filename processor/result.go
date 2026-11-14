package processor

import (
	"bytes"
	"encoding/binary"
)

// InteractiveMeta describes the unconsumed suffix after an interactive step.
type InteractiveMeta struct {
	Remaining  string
	Incomplete bool
}

const (
	errorKindLanguage    = "language"
	errorKindPrint       = "print"
	errorKindParse       = "parse"
	errorKindSplitBraces = "splitBraces"
)

// encodeResult frames metadata JSON and an optional binary AST payload:
// uint32 metadata length, metadata JSON, AST bytes. A non-nil changed adds the
// splitBraces-only changed field. errorKind is language, print, parse, or
// splitBraces when an operation fails.
func encodeResult(ast []byte, text string, parseError *ParseError, message string, changed *bool, errorKind string, interactive *InteractiveMeta) []byte {
	var meta bytes.Buffer
	meta.WriteString(`{"text":`)
	writeString(&meta, text)
	meta.WriteString(`,"parseError":`)
	writeParseError(&meta, parseError)
	meta.WriteString(`,"message":`)
	writeString(&meta, message)
	if changed != nil {
		meta.WriteString(`,"changed":`)
		writeBool(&meta, *changed)
	}
	if errorKind != "" {
		meta.WriteString(`,"errorKind":`)
		writeString(&meta, errorKind)
	}
	if interactive != nil {
		meta.WriteString(`,"interactive":{"remaining":`)
		writeString(&meta, interactive.Remaining)
		meta.WriteString(`,"incomplete":`)
		writeBool(&meta, interactive.Incomplete)
		meta.WriteByte('}')
	}
	meta.WriteByte('}')

	out := make([]byte, 4+meta.Len()+len(ast))
	binary.LittleEndian.PutUint32(out, uint32(meta.Len()))
	copy(out[4:], meta.Bytes())
	copy(out[4+meta.Len():], ast)
	return out
}
