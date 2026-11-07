// Package processor bridges mvdan.cc/sh's syntax tree to and from JSON.
package processor

// The encoder and decoder in this file are derived from
// mvdan.cc/sh/v3/syntax/typedjson, which is licensed under the BSD 3-Clause
// license:
//
// Copyright (c) 2017, Daniel Martí <mvdan@mvdan.cc>
// See https://github.com/mvdan/sh/blob/master/LICENSE for details.
//
// Unlike typedjson, the encoder emits every field, including empty slices and
// invalid positions, and adds a "__type" key to every syntax node. JavaScript
// consumers get a tree that mirrors the Go structs, including the zero values
// that the GopherJS build of mvdan-sh exposes.

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"reflect"
	"strconv"
	"strings"

	"mvdan.cc/sh/v3/syntax"
)

var (
	posType = reflect.TypeFor[syntax.Pos]()
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

func writeUint(buf *bytes.Buffer, value uint64) {
	var scratch [24]byte
	buf.Write(strconv.AppendUint(scratch[:0], value, 10))
}

func writePos(buf *bytes.Buffer, pos syntax.Pos) {
	if !pos.IsValid() {
		buf.WriteString(`{"offset":0,"line":0,"column":0}`)
		return
	}
	buf.WriteString(`{"offset":`)
	writeUint(buf, uint64(pos.Offset()))
	buf.WriteString(`,"line":`)
	writeUint(buf, uint64(pos.Line()))
	buf.WriteString(`,"column":`)
	writeUint(buf, uint64(pos.Col()-1))
	buf.WriteByte('}')
}

// DecodeNode reads JSON encoded by [EncodeNode] and returns the syntax node.
func DecodeNode(r io.Reader) (syntax.Node, error) {
	data, err := io.ReadAll(r)
	if err != nil {
		return nil, err
	}
	var encoded any
	if err := json.Unmarshal(data, &encoded); err != nil {
		return nil, err
	}

	node := new(syntax.Node)
	if err := decodeValue(reflect.ValueOf(node).Elem(), encoded); err != nil {
		return nil, err
	}
	return *node, nil
}

var nodeByName = map[string]reflect.Type{
	"File": reflect.TypeFor[syntax.File](),
	"Stmt": reflect.TypeFor[syntax.Stmt](),
	"Word": reflect.TypeFor[syntax.Word](),

	"Comment":   reflect.TypeFor[syntax.Comment](),
	"Assign":    reflect.TypeFor[syntax.Assign](),
	"Redirect":  reflect.TypeFor[syntax.Redirect](),
	"Lit":       reflect.TypeFor[syntax.Lit](),
	"SglQuoted": reflect.TypeFor[syntax.SglQuoted](),
	"DblQuoted": reflect.TypeFor[syntax.DblQuoted](),
	"ParamExp":  reflect.TypeFor[syntax.ParamExp](),
	"CmdSubst":  reflect.TypeFor[syntax.CmdSubst](),
	"CallExpr":  reflect.TypeFor[syntax.CallExpr](),
	"ArithmExp": reflect.TypeFor[syntax.ArithmExp](),
	"ProcSubst": reflect.TypeFor[syntax.ProcSubst](),
	"ExtGlob":   reflect.TypeFor[syntax.ExtGlob](),
	"BraceExp":  reflect.TypeFor[syntax.BraceExp](),
	"ArrayExpr": reflect.TypeFor[syntax.ArrayExpr](),
	"ArrayElem": reflect.TypeFor[syntax.ArrayElem](),

	"ArithmCmd":    reflect.TypeFor[syntax.ArithmCmd](),
	"BinaryCmd":    reflect.TypeFor[syntax.BinaryCmd](),
	"IfClause":     reflect.TypeFor[syntax.IfClause](),
	"ForClause":    reflect.TypeFor[syntax.ForClause](),
	"WhileClause":  reflect.TypeFor[syntax.WhileClause](),
	"CaseClause":   reflect.TypeFor[syntax.CaseClause](),
	"CaseItem":     reflect.TypeFor[syntax.CaseItem](),
	"Block":        reflect.TypeFor[syntax.Block](),
	"Subshell":     reflect.TypeFor[syntax.Subshell](),
	"FuncDecl":     reflect.TypeFor[syntax.FuncDecl](),
	"TestClause":   reflect.TypeFor[syntax.TestClause](),
	"DeclClause":   reflect.TypeFor[syntax.DeclClause](),
	"LetClause":    reflect.TypeFor[syntax.LetClause](),
	"TimeClause":   reflect.TypeFor[syntax.TimeClause](),
	"CoprocClause": reflect.TypeFor[syntax.CoprocClause](),
	"TestDecl":     reflect.TypeFor[syntax.TestDecl](),

	"UnaryArithm":  reflect.TypeFor[syntax.UnaryArithm](),
	"BinaryArithm": reflect.TypeFor[syntax.BinaryArithm](),
	"ParenArithm":  reflect.TypeFor[syntax.ParenArithm](),
	"FlagsArithm":  reflect.TypeFor[syntax.FlagsArithm](),

	"UnaryTest":  reflect.TypeFor[syntax.UnaryTest](),
	"BinaryTest": reflect.TypeFor[syntax.BinaryTest](),
	"ParenTest":  reflect.TypeFor[syntax.ParenTest](),

	"WordIter":   reflect.TypeFor[syntax.WordIter](),
	"CStyleLoop": reflect.TypeFor[syntax.CStyleLoop](),
}

func decodeValue(val reflect.Value, encoded any) error {
	switch encoded := encoded.(type) {
	case map[string]any:
		if val.Kind() == reflect.Pointer && val.IsNil() {
			val.Set(reflect.New(val.Type().Elem()))
		}
		if typeName, _ := encoded["type"].(string); typeName != "" &&
			(val.Kind() == reflect.Pointer || val.Kind() == reflect.Interface) {
			typ := nodeByName[typeName]
			if typ == nil {
				return fmt.Errorf("unknown type: %q", typeName)
			}
			val.Set(reflect.New(typ))
		}
		for val.Kind() == reflect.Pointer || val.Kind() == reflect.Interface {
			val = val.Elem()
		}
		for name, fieldValue := range encoded {
			switch name {
			case "type", "start", "end":
				continue
			}
			field := val.FieldByName(goFieldName(name))
			if !field.IsValid() {
				return fmt.Errorf("unknown field for %s: %q", val.Type(), name)
			}
			if field.Type() == posType {
				pos, ok := fieldValue.(map[string]any)
				if !ok {
					return fmt.Errorf("invalid position for %s", name)
				}
				decodePos(field, pos)
				continue
			}
			if err := decodeValue(field, fieldValue); err != nil {
				return err
			}
		}
	case []any:
		length := len(encoded)
		slice := reflect.MakeSlice(val.Type(), length, length)
		for i, item := range encoded {
			if err := decodeValue(slice.Index(i), item); err != nil {
				return err
			}
		}
		val.Set(slice)
	case float64:
		// Tokens and thus operators are uint32, but encoding/json defaults to float64.
		val.SetUint(uint64(encoded))
	default:
		if encoded != nil {
			val.Set(reflect.ValueOf(encoded))
		}
	}
	return nil
}

func decodePos(val reflect.Value, encoded map[string]any) {
	offset, _ := encoded["offset"].(float64)
	line, _ := encoded["line"].(float64)
	column, _ := encoded["column"].(float64)
	val.Set(reflect.ValueOf(syntax.NewPos(uint(offset), uint(line), uint(column)+1)))
}

func goFieldName(name string) string {
	switch name {
	case "lastComments":
		return "Last"
	case "condComments":
		return "CondLast"
	case "thenComments":
		return "ThenLast"
	case "doComments":
		return "DoLast"
	default:
		return strings.ToUpper(name[:1]) + name[1:]
	}
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
	return &ParseError{
		Filename:   parseError.Filename,
		Incomplete: parseError.Incomplete,
		Text:       parseError.Text,
		Pos: &ErrorPos{
			Offset: pos.Offset(),
			Line:   pos.Line(),
			Column: pos.Col() - 1,
		},
	}
}

// Result is the JSON envelope returned by the process export.
type Result struct {
	File       json.RawMessage `json:"file"`
	Text       string          `json:"text"`
	ParseError *ParseError     `json:"parseError"`
	Message    string          `json:"message"`
}
