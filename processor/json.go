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

	"mvdan.cc/sh/v3/syntax"
)

var (
	posType = reflect.TypeFor[syntax.Pos]()
)

// EncodeNode writes node as JSON. The root node and every node stored in an
// interface field carry a "Type" key so that the result can be decoded later.
// Every syntax node also carries a "__type" key for JavaScript's NodeType.
func EncodeNode(w io.Writer, node syntax.Node) error {
	var buf bytes.Buffer
	if err := encodeValue(&buf, reflect.ValueOf(node), true); err != nil {
		return err
	}
	_, err := w.Write(buf.Bytes())
	return err
}

func writeString(buf *bytes.Buffer, value string) {
	encoded, _ := json.Marshal(value)
	buf.Write(encoded)
}

func writeField(buf *bytes.Buffer, name string, first *bool) {
	if !*first {
		buf.WriteByte(',')
	}
	*first = false
	writeString(buf, name)
	buf.WriteByte(':')
}

func writePos(buf *bytes.Buffer, pos syntax.Pos) {
	buf.WriteString(`{"Offset":`)
	buf.WriteString(strconv.FormatUint(uint64(pos.Offset()), 10))
	buf.WriteString(`,"Line":`)
	buf.WriteString(strconv.FormatUint(uint64(pos.Line()), 10))
	buf.WriteString(`,"Col":`)
	buf.WriteString(strconv.FormatUint(uint64(pos.Col()), 10))
	buf.WriteByte('}')
}

func encodeValue(buf *bytes.Buffer, val reflect.Value, forceType bool) error {
	if !val.IsValid() {
		buf.WriteString("null")
		return nil
	}

	switch val.Kind() {
	case reflect.Pointer:
		if val.IsNil() {
			buf.WriteString("null")
			return nil
		}
		return encodeValue(buf, val.Elem(), forceType)
	case reflect.Interface:
		if val.IsNil() {
			buf.WriteString("null")
			return nil
		}
		return encodeValue(buf, val.Elem(), true)
	case reflect.Struct:
		if val.Type() == posType {
			writePos(buf, val.Interface().(syntax.Pos))
			return nil
		}

		if !val.CanAddr() {
			addressable := reflect.New(val.Type()).Elem()
			addressable.Set(val)
			val = addressable
		}

		typ := val.Type()
		node, isNode := val.Addr().Interface().(syntax.Node)
		first := true
		buf.WriteByte('{')

		if isNode {
			writeField(buf, "__type", &first)
			writeString(buf, typ.Name())
			if forceType {
				writeField(buf, "Type", &first)
				writeString(buf, typ.Name())
			}
			writeField(buf, "Pos", &first)
			writePos(buf, node.Pos())
			writeField(buf, "End", &first)
			writePos(buf, node.End())
		}

		for i := range typ.NumField() {
			field := typ.Field(i)
			// Unexported fields cannot be represented in JSON.
			if field.PkgPath != "" {
				continue
			}
			fieldValue := val.Field(i)
			writeField(buf, field.Name, &first)
			if field.Type == posType {
				writePos(buf, fieldValue.Interface().(syntax.Pos))
				continue
			}
			if err := encodeValue(buf, fieldValue, false); err != nil {
				return fmt.Errorf("encode %s.%s: %w", typ.Name(), field.Name, err)
			}
		}

		buf.WriteByte('}')
		return nil
	case reflect.Slice:
		buf.WriteByte('[')
		for i := range val.Len() {
			if i > 0 {
				buf.WriteByte(',')
			}
			if err := encodeValue(buf, val.Index(i), false); err != nil {
				return err
			}
		}
		buf.WriteByte(']')
		return nil
	case reflect.Bool:
		buf.WriteString(strconv.FormatBool(val.Bool()))
		return nil
	case reflect.String:
		writeString(buf, val.String())
		return nil
	case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
		buf.WriteString(strconv.FormatUint(val.Uint(), 10))
		return nil
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
		buf.WriteString(strconv.FormatInt(val.Int(), 10))
		return nil
	default:
		return fmt.Errorf("unsupported syntax field kind: %s", val.Kind())
	}
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
		if typeName, _ := encoded["Type"].(string); typeName != "" {
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
			field := val.FieldByName(name)
			switch name {
			case "Type", "Pos", "End", "__type":
				// Type was handled above. Pos and End are derived from methods.
				continue
			}
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
	offset, _ := encoded["Offset"].(float64)
	line, _ := encoded["Line"].(float64)
	column, _ := encoded["Col"].(float64)
	val.Set(reflect.ValueOf(syntax.NewPos(uint(offset), uint(line), uint(column))))
}

// ErrorPos is the JSON representation of a syntax position in a parse error.
type ErrorPos struct {
	Offset uint `json:"Offset"`
	Line   uint `json:"Line"`
	Col    uint `json:"Col"`
}

// ParseError is the JSON representation of a shell syntax error.
type ParseError struct {
	Filename   string    `json:"Filename,omitempty"`
	Incomplete bool      `json:"Incomplete"`
	Text       string    `json:"Text"`
	Pos        *ErrorPos `json:"Pos,omitempty"`
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
			Col:    pos.Col(),
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
