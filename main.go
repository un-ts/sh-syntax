//go:build js || wasm
// +build js || wasm

package main

import (
	"encoding/json"
	"unsafe"

	"github.com/un-ts/sh-syntax/processor"
	"mvdan.cc/sh/v3/syntax"
)

var (
	buffers    = map[uint32][]byte{}
	lastResult []byte
)

type processOptions struct {
	Print            bool   `json:"print"`
	KeepComments     bool   `json:"keepComments"`
	Variant          uint32 `json:"variant"`
	StopAt           string `json:"stopAt"`
	RecoverErrors    int    `json:"recoverErrors"`
	Simplify         bool   `json:"simplify"`
	Indent           uint   `json:"indent"`
	BinaryNextLine   bool   `json:"binaryNextLine"`
	SwitchCaseIndent bool   `json:"switchCaseIndent"`
	SpaceRedirects   bool   `json:"spaceRedirects"`
	KeepPadding      bool   `json:"keepPadding"`
	Minify           bool   `json:"minify"`
	SingleLine       bool   `json:"singleLine"`
	FunctionNextLine bool   `json:"functionNextLine"`
}

//go:wasmexport wasmAlloc
func wasmAlloc(size uint32) uint32 {
	if size == 0 {
		return 0
	}
	value := make([]byte, size)
	pointer := uint32(uintptr(unsafe.Pointer(&value[0])))
	buffers[pointer] = value
	return pointer
}

//go:wasmexport wasmFree
func wasmFree(pointer uint32) {
	delete(buffers, pointer)
}

func bytesAt(pointer uint32, length uint32) []byte {
	if pointer == 0 || length == 0 {
		return nil
	}
	return unsafe.Slice((*byte)(unsafe.Pointer(uintptr(pointer))), length)
}

//go:wasmexport process
func process(
	filepathPointer uint32,
	filepathLength uint32,
	textPointer uint32,
	textLength uint32,
	optionsPointer uint32,
	optionsLength uint32,
) uint32 {
	var options processOptions
	if err := json.Unmarshal(bytesAt(optionsPointer, optionsLength), &options); err != nil {
		lastResult = []byte(err.Error() + "\x00")
		return uint32(uintptr(unsafe.Pointer(&lastResult[0])))
	}

	parserOptions := processor.ParserOptions{
		KeepComments:  options.KeepComments,
		Variant:       syntax.LangVariant(options.Variant),
		StopAt:        options.StopAt,
		RecoverErrors: options.RecoverErrors,
	}

	printerOptions := processor.PrinterOptions{
		Simplify:         options.Simplify,
		Indent:           options.Indent,
		BinaryNextLine:   options.BinaryNextLine,
		SwitchCaseIndent: options.SwitchCaseIndent,
		SpaceRedirects:   options.SpaceRedirects,
		KeepPadding:      options.KeepPadding,
		Minify:           options.Minify,
		SingleLine:       options.SingleLine,
		FunctionNextLine: options.FunctionNextLine,
	}

	result := processor.Process(
		bytesAt(filepathPointer, filepathLength),
		bytesAt(textPointer, textLength),
		options.Print,
		parserOptions,
		printerOptions,
	)

	lastResult = append(result, 0)
	return uint32(uintptr(unsafe.Pointer(&lastResult[0])))
}

func main() {
	select {}
}
