//go:build js || wasm
// +build js wasm

package main

import (
	"unsafe"

	"github.com/un-ts/sh-syntax/processor"
	"mvdan.cc/sh/v3/syntax"
)

var (
	buffers    = map[unsafe.Pointer][]byte{}
	lastResult []byte
)

// Keep this layout in sync with optionValues in src/internal.ts.
type processOptions struct {
	Print            uint32
	KeepComments     uint32
	Variant          uint32
	RecoverErrors    int32
	StopAt           [4]byte
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
func wasmAlloc(size uint32) unsafe.Pointer {
	if size == 0 {
		return nil
	}
	value := make([]byte, size)
	pointer := unsafe.Pointer(&value[0])
	buffers[pointer] = value
	return pointer
}

//go:wasmexport wasmFree
func wasmFree(pointer unsafe.Pointer) {
	delete(buffers, pointer)
}

func bytesAt(pointer unsafe.Pointer, length uint32) []byte {
	if pointer == nil || length == 0 {
		return nil
	}
	return unsafe.Slice((*byte)(pointer), length)
}

func parserOptions(options *processOptions) processor.ParserOptions {
	return processor.ParserOptions{
		KeepComments:  options.KeepComments != 0,
		Variant:       syntax.LangVariant(options.Variant),
		StopAt:        string(options.StopAt[:options.StopAtLength]),
		RecoverErrors: int(options.RecoverErrors),
	}
}

func printerOptions(options *processOptions) processor.PrinterOptions {
	return processor.PrinterOptions{
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
}

//go:wasmexport process
func process(
	filepathPointer unsafe.Pointer, filepathLength uint32,
	textPointer unsafe.Pointer, textLength uint32,
	optionsPointer unsafe.Pointer,
) unsafe.Pointer {
	options := (*processOptions)(optionsPointer)

	result := processor.Process(
		bytesAt(filepathPointer, filepathLength),
		bytesAt(textPointer, textLength),
		options.Print != 0,
		parserOptions(options),
		printerOptions(options),
	)

	lastResult = result
	return unsafe.Pointer(&lastResult[0])
}

//go:wasmexport resultLength
func resultLength() uint32 {
	return uint32(len(lastResult))
}

//go:wasmexport printNode
func printNode(
	nodePointer unsafe.Pointer, nodeLength uint32,
	optionsPointer unsafe.Pointer,
) unsafe.Pointer {
	options := (*processOptions)(optionsPointer)
	result := processor.ProcessNode(bytesAt(nodePointer, nodeLength), printerOptions(options))
	lastResult = result
	return unsafe.Pointer(&lastResult[0])
}

func main() {
	select {}
}
