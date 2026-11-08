//go:build js || wasm
// +build js wasm

package main

import (
	"unsafe"

	"github.com/un-ts/sh-syntax/processor"
	"mvdan.cc/sh/v3/syntax"
)

var (
	buffers    = map[uint32][]byte{}
	lastResult []byte
)

// Keep this layout in sync with optionValues in src/processor.ts.
type processOptions struct {
	Print            uint32
	KeepComments     uint32
	Variant          uint32
	RecoverErrors    int32
	StopAtPointer    uint32
	StopAtLength     uint32
	Simplify         uint32
	Indent           uint32
	BinaryNextLine   uint32
	SwitchCaseIndent uint32
	SpaceRedirects   uint32
	KeepPadding      uint32
	Minify           uint32
	SingleLine       uint32
	FunctionNextLine uint32
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

func bytesAt(pointer, length uint32) []byte {
	if pointer == 0 || length == 0 {
		return nil
	}
	return unsafe.Slice((*byte)(unsafe.Pointer(uintptr(pointer))), length)
}

//go:wasmexport process
func process(
	filepathPointer, filepathLength, textPointer, textLength, optionsPointer uint32,
) uint32 {
	options := (*processOptions)(unsafe.Pointer(uintptr(optionsPointer)))

	parserOptions := processor.ParserOptions{
		KeepComments:  options.KeepComments != 0,
		Variant:       syntax.LangVariant(options.Variant),
		StopAt:        string(bytesAt(options.StopAtPointer, options.StopAtLength)),
		RecoverErrors: int(options.RecoverErrors),
	}

	printerOptions := processor.PrinterOptions{
		Simplify:         options.Simplify != 0,
		Indent:           uint(options.Indent),
		BinaryNextLine:   options.BinaryNextLine != 0,
		SwitchCaseIndent: options.SwitchCaseIndent != 0,
		SpaceRedirects:   options.SpaceRedirects != 0,
		KeepPadding:      options.KeepPadding != 0,
		Minify:           options.Minify != 0,
		SingleLine:       options.SingleLine != 0,
		FunctionNextLine: options.FunctionNextLine != 0,
	}

	result := processor.Process(
		bytesAt(filepathPointer, filepathLength),
		bytesAt(textPointer, textLength),
		options.Print != 0,
		parserOptions,
		printerOptions,
	)

	lastResult = append(result, 0)
	return uint32(uintptr(unsafe.Pointer(&lastResult[0])))
}

func main() {
	select {}
}
