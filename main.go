//go:build js || wasm
// +build js wasm

package main

import (
	"container/list"

	"github.com/un-ts/sh-syntax/processor"
	"mvdan.cc/sh/v3/syntax"
)

var memory = list.New()

type Block struct {
	ptr   *[]byte
	value []byte
}

//export wasmAlloc
func wasmAlloc(size int) *[]byte {
	slice := make([]byte, size)
	block := Block{
		ptr:   &slice,
		value: slice,
	}
	memory.PushBack(block)
	return block.ptr
}

//export wasmFree
func wasmFree(ptr *[]byte) {
	for e := memory.Front(); e != nil; e = e.Next() {
		block := e.Value.(Block)
		if block.ptr == ptr {
			memory.Remove(e)
			break
		}
	}
}

// process processes the input file path and text by performing either
// formatting (printing) or parsing based on the print flag.

// The result is a JSON envelope with a null terminator appended, and a pointer
// to its first byte is returned.
//
//export process
func process(
	filepathBytes []byte,
	textBytes []byte,

	print bool,

	// parser
	keepComments bool,
	variant int,
	stopAt []byte,
	recoverErrors int,

	// printer
	simplify bool,
	indent int,
	binaryNextLine,
	switchCaseIndent,
	spaceRedirects,
	keepPadding,
	minify,
	singleLine bool,
	functionNextLine bool,
) *byte {
	parserOptions := processor.ParserOptions{
		KeepComments:  keepComments,
		Variant:       syntax.LangVariant(variant),
		StopAt:        string(stopAt),
		RecoverErrors: recoverErrors,
	}

	printerOptions := processor.PrinterOptions{
		Simplify:         simplify,
		Indent:           uint(indent),
		BinaryNextLine:   binaryNextLine,
		SwitchCaseIndent: switchCaseIndent,
		SpaceRedirects:   spaceRedirects,
		KeepPadding:      keepPadding,
		Minify:           minify,
		SingleLine:       singleLine,
		FunctionNextLine: functionNextLine,
	}

	bytes := processor.Process(
		filepathBytes,
		textBytes,
		print,
		parserOptions,
		printerOptions,
	)

	bytes = append(bytes, 0)

	return &bytes[0]
}

func main() {
}
