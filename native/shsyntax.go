package main

/*
#include <stdlib.h>
*/
import "C"

import (
	"bytes"
	"encoding/json"
	"fmt"
	"sync"
	"unsafe"

	"github.com/un-ts/sh-syntax/processor"
	"mvdan.cc/sh/v3/syntax"
)

type nodeKey struct {
	typeName string
	start    uint64
	end      uint64
}

type handleState struct {
	file  *syntax.File
	lits  map[[2]uint64]*syntax.Lit
	nodes map[nodeKey]syntax.Node
}

var (
	handleMu     sync.Mutex
	handleNext   uint64
	handleStates = map[uint64]*handleState{}
)

type litKey = [2]uint64

//export sh_syntax_parse_handle
func sh_syntax_parse_handle(text *C.char, filepath *C.char) *C.char {
	file, err := processor.Parse(
		C.GoString(text),
		C.GoString(filepath),
		processor.ParserOptions{KeepComments: true, Variant: syntax.LangBash},
	)
	if err != nil {
		return C.CString(errorJSON(err))
	}

	var buf bytes.Buffer
	if err := processor.EncodeNode(&buf, file); err != nil {
		return C.CString(errorJSON(err))
	}

	lits := map[litKey]*syntax.Lit{}
	nodes := map[nodeKey]syntax.Node{}
	syntax.Walk(file, func(node syntax.Node) bool {
		if node == nil {
			return true
		}
		key := nodeKey{processor.NodeTypeName(node), uint64(node.Pos().Offset()), uint64(node.End().Offset())}
		nodes[key] = node
		if lit, ok := node.(*syntax.Lit); ok {
			lits[litKey{uint64(lit.Pos().Offset()), uint64(lit.End().Offset())}] = lit
		}
		return true
	})

	handleMu.Lock()
	handleNext++
	handle := handleNext
	handleStates[handle] = &handleState{file: file, lits: lits, nodes: nodes}
	handleMu.Unlock()

	return C.CString(`{"ok":true,"handle":` + jsonNumber(handle) + `,"ast":` + buf.String() + `}`)
}

//export sh_syntax_patch_lit
func sh_syntax_patch_lit(handle C.ulonglong, start C.ulonglong, end C.ulonglong, value *C.char) *C.char {
	handleMu.Lock()
	state := handleStates[uint64(handle)]
	handleMu.Unlock()
	if state == nil {
		return C.CString(`{"ok":false,"error":"unknown handle"}`)
	}

	lit := state.lits[litKey{uint64(start), uint64(end)}]
	if lit == nil {
		return C.CString(`{"ok":false,"error":"unknown literal"}`)
	}
	lit.Value = C.GoString(value)
	return C.CString(`{"ok":true}`)
}

//export sh_syntax_patch_scalar
func sh_syntax_patch_scalar(handle C.ulonglong, typeName *C.char, start C.ulonglong, end C.ulonglong, field *C.char, valueJSON *C.char) *C.char {
	handleMu.Lock()
	state := handleStates[uint64(handle)]
	handleMu.Unlock()
	if state == nil {
		return C.CString(`{"ok":false,"error":"unknown handle"}`)
	}

	node := state.nodes[nodeKey{C.GoString(typeName), uint64(start), uint64(end)}]
	if node == nil {
		return C.CString(`{"ok":false,"error":"unknown node"}`)
	}
	if err := processor.PatchScalar(node, C.GoString(field), json.RawMessage(C.GoString(valueJSON))); err != nil {
		return C.CString(errorJSON(err))
	}
	return C.CString(`{"ok":true}`)
}

//export sh_syntax_print_handle
func sh_syntax_print_handle(handle C.ulonglong) *C.char {
	handleMu.Lock()
	state := handleStates[uint64(handle)]
	handleMu.Unlock()
	if state == nil {
		return C.CString(`{"ok":false,"error":"unknown handle"}`)
	}

	output, err := processor.PrintFile(state.file, processor.PrinterOptions{
		Indent:           2,
		BinaryNextLine:   true,
		SwitchCaseIndent: true,
		SpaceRedirects:   true,
	})
	if err != nil {
		return C.CString(errorJSON(err))
	}
	encoded, _ := json.Marshal(output)
	return C.CString(`{"ok":true,"text":` + string(encoded) + `}`)
}

//export sh_syntax_free_handle
func sh_syntax_free_handle(handle C.ulonglong) {
	handleMu.Lock()
	delete(handleStates, uint64(handle))
	handleMu.Unlock()
}

func jsonNumber(value uint64) string {
	return json.Number(fmt.Sprintf("%d", value)).String()
}

//export sh_syntax_parse
func sh_syntax_parse(text *C.char, filepath *C.char) *C.char {
	file, err := processor.Parse(
		C.GoString(text),
		C.GoString(filepath),
		processor.ParserOptions{
			KeepComments: true,
			Variant:      syntax.LangBash,
		},
	)
	if err != nil {
		return C.CString(errorJSON(err))
	}

	var buf bytes.Buffer
	if err := processor.EncodeNode(&buf, file); err != nil {
		return C.CString(errorJSON(err))
	}

	return C.CString(`{"ok":true,"ast":` + buf.String() + `}`)
}

//export sh_syntax_print
func sh_syntax_print(text *C.char, filepath *C.char) *C.char {
	output, err := processor.Print(
		C.GoString(text),
		C.GoString(filepath),
		processor.SyntaxOptions{
			ParserOptions: processor.ParserOptions{
				KeepComments: true,
				Variant:      syntax.LangBash,
			},
			PrinterOptions: processor.PrinterOptions{
				Indent:           2,
				BinaryNextLine:   true,
				SwitchCaseIndent: true,
				SpaceRedirects:   true,
			},
		},
	)
	if err != nil {
		return C.CString(errorJSON(err))
	}

	encoded, _ := json.Marshal(output)
	return C.CString(`{"ok":true,"text":` + string(encoded) + `}`)
}

//export sh_syntax_print_ast
func sh_syntax_print_ast(jsonText *C.char) *C.char {
	file, err := processor.DecodeFile([]byte(C.GoString(jsonText)))
	if err != nil {
		return C.CString(errorJSON(err))
	}

	output, err := processor.PrintFile(file, processor.PrinterOptions{
		Indent:           2,
		BinaryNextLine:   true,
		SwitchCaseIndent: true,
		SpaceRedirects:   true,
	})
	if err != nil {
		return C.CString(errorJSON(err))
	}

	encoded, _ := json.Marshal(output)
	return C.CString(`{"ok":true,"text":` + string(encoded) + `}`)
}

//export sh_syntax_free
func sh_syntax_free(value *C.char) {
	C.free(unsafe.Pointer(value))
}

func errorJSON(err error) string {
	encoded, _ := json.Marshal(err.Error())
	return `{"ok":false,"error":` + string(encoded) + `}`
}

func main() {}
