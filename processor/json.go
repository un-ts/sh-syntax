// Package processor writes result metadata and maps parse errors.
package processor

import (
	"bytes"
	"errors"
	"strconv"

	"mvdan.cc/sh/v3/syntax"
)

func writeString(buf *bytes.Buffer, value string) {
	buf.WriteByte('"')
	start := 0
	for i := 0; i < len(value); i++ {
		char := value[i]
		if char >= 0x20 && char != '"' && char != '\\' {
			continue
		}
		if start < i {
			buf.WriteString(value[start:i])
		}
		switch char {
		case '"':
			buf.WriteString("\\\"")
		case '\\':
			buf.WriteString("\\\\")
		case '\n':
			buf.WriteString("\\n")
		case '\r':
			buf.WriteString("\\r")
		case '\t':
			buf.WriteString("\\t")
		case '\b':
			buf.WriteString("\\b")
		case '\f':
			buf.WriteString("\\f")
		default:
			buf.WriteString("\\u00")
			const hex = "0123456789abcdef"
			buf.WriteByte(hex[char>>4])
			buf.WriteByte(hex[char&0x0f])
		}
		start = i + 1
	}
	if start < len(value) {
		buf.WriteString(value[start:])
	}
	buf.WriteByte('"')
}

func writeBool(buf *bytes.Buffer, value bool) {
	if value {
		buf.WriteString("true")
	} else {
		buf.WriteString("false")
	}
}

func writeUint(buf *bytes.Buffer, value uint64) {
	var scratch [24]byte
	buf.Write(strconv.AppendUint(scratch[:0], value, 10))
}

// ErrorPos is the JSON representation of a syntax position in a parse error.
type ErrorPos struct {
	Offset uint `json:"offset"`
	Line   uint `json:"line"`
	Column uint `json:"column"`
}

// ParseError is the JSON representation of a shell syntax error.
type ParseError struct {
	Filename   string    `json:"filename,omitempty"`
	Incomplete bool      `json:"incomplete"`
	Text       string    `json:"text"`
	Pos        *ErrorPos `json:"pos,omitempty"`
}

// MapParseError converts a Go parse error into its JSON representation and a
// human-readable message.
func MapParseError(err error) (*ParseError, string) {
	if err == nil {
		return nil, ""
	}

	var parseError syntax.ParseError
	if errors.As(err, &parseError) {
		return newParseError(parseError), parseError.Error()
	}

	var parseErrorPtr *syntax.ParseError
	if errors.As(err, &parseErrorPtr) {
		return newParseError(*parseErrorPtr), parseErrorPtr.Error()
	}

	return nil, err.Error()
}

func newParseError(parseError syntax.ParseError) *ParseError {
	pos := parseError.Pos
	errorPos := &ErrorPos{}
	if pos.IsValid() {
		errorPos.Offset = pos.Offset()
		errorPos.Line = pos.Line()
		if pos.Col() > 0 {
			errorPos.Column = pos.Col() - 1
		}
	}
	return &ParseError{
		Filename:   parseError.Filename,
		Incomplete: parseError.Incomplete,
		Text:       parseError.Text,
		Pos:        errorPos,
	}
}

func writeParseError(buf *bytes.Buffer, parseError *ParseError) {
	if parseError == nil {
		buf.WriteString("null")
		return
	}

	buf.WriteByte('{')
	first := true
	writeField := func(name string) {
		if !first {
			buf.WriteByte(',')
		}
		first = false
		writeString(buf, name)
		buf.WriteByte(':')
	}

	if parseError.Filename != "" {
		writeField("filename")
		writeString(buf, parseError.Filename)
	}
	writeField("incomplete")
	writeBool(buf, parseError.Incomplete)
	writeField("text")
	writeString(buf, parseError.Text)
	if parseError.Pos != nil {
		writeField("pos")
		buf.WriteString(`{"offset":`)
		writeUint(buf, uint64(parseError.Pos.Offset))
		buf.WriteString(`,"line":`)
		writeUint(buf, uint64(parseError.Pos.Line))
		buf.WriteString(`,"column":`)
		writeUint(buf, uint64(parseError.Pos.Column))
		buf.WriteByte('}')
	}
	buf.WriteByte('}')
}
