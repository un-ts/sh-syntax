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
type resultMeta struct {
	changed     *bool
	errorKind   string
	interactive *InteractiveMeta
}

func encodeResult(ast []byte, text string, parseError *ParseError, message string, meta resultMeta) []byte {
	var metaBuf bytes.Buffer
	metaBuf.WriteString(`{"text":`)
	writeString(&metaBuf, text)
	metaBuf.WriteString(`,"parseError":`)
	writeParseError(&metaBuf, parseError)
	metaBuf.WriteString(`,"message":`)
	writeString(&metaBuf, message)
	if meta.changed != nil {
		metaBuf.WriteString(`,"changed":`)
		writeBool(&metaBuf, *meta.changed)
	}
	if meta.errorKind != "" {
		metaBuf.WriteString(`,"errorKind":`)
		writeString(&metaBuf, meta.errorKind)
	}
	if meta.interactive != nil {
		metaBuf.WriteString(`,"interactive":{"remaining":`)
		writeString(&metaBuf, meta.interactive.Remaining)
		metaBuf.WriteString(`,"incomplete":`)
		writeBool(&metaBuf, meta.interactive.Incomplete)
		metaBuf.WriteByte('}')
	}
	metaBuf.WriteByte('}')

	out := make([]byte, 4+metaBuf.Len()+len(ast))
	binary.LittleEndian.PutUint32(out, uint32(metaBuf.Len()))
	copy(out[4:], metaBuf.Bytes())
	copy(out[4+metaBuf.Len():], ast)
	return out
}
