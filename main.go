//go:build js || wasm
// +build js wasm

package main

import (
	"container/list"

	"github.com/mailru/easyjson"
	"github.com/rx-ts/sh-syntax/processor"

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

func Parse(text string, filepath string, parserOptions processor.ParserOptions) (*syntax.File, error) {
	return processor.Parse(text, filepath, parserOptions)
}

func Print(originalText string, filepath string, syntaxOptions processor.SyntaxOptions) (string, error) {
	return processor.Print(originalText, filepath, syntaxOptions)
}

//export process
func process(
	filepathBytes []byte,
	textBytes []byte,

	print bool,

	// parser
	keepComments bool,
	stopAt []byte,
	variant int,

	// printer
	indent int,
	binaryNextLine,
	switchCaseIndent,
	spaceRedirects,
	keepPadding,
	minify,
	functionNextLine bool,
) *byte {
	filepath := string(filepathBytes)
	text := string(textBytes)

	parserOptions := processor.ParserOptions{
		KeepComments: keepComments,
		StopAt:       string(stopAt),
		Variant:      syntax.LangVariant(variant),
	}

	var file processor.File
	var error error

	if print {
		printerOptions := processor.PrinterOptions{
			Indent:           uint(indent),
			BinaryNextLine:   binaryNextLine,
			SwitchCaseIndent: switchCaseIndent,
			SpaceRedirects:   spaceRedirects,
			KeepPadding:      keepPadding,
			Minify:           minify,
			FunctionNextLine: functionNextLine,
		}

		text, error = Print(text, filepath, processor.SyntaxOptions{
			ParserOptions:  parserOptions,
			PrinterOptions: printerOptions,
		})

	} else {
		astFile, err := Parse(text, filepath, parserOptions)
		file = processor.MapFile(*astFile)
		error = err
	}

	parseError, message := processor.MapParseError(error)

	result := processor.Result{
		File:       file,
		Text:       text,
		ParseError: parseError,
		Message:    message,
	}

	bytes, err := easyjson.Marshal(&result)

	if err != nil {
		panic(err)
	}

	return &bytes[0]
}

func main() {
}
