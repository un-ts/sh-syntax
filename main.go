//go:build js || wasm
// +build js wasm

package main

import (
	"container/list"
	"fmt"

	"github.com/mailru/easyjson"
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

func Parse(text string, filepath string, parserOptions processor.ParserOptions) (*syntax.File, error) {
	return processor.Parse(text, filepath, parserOptions)
}

func Print(originalText string, filepath string, syntaxOptions processor.SyntaxOptions) (string, error) {
	return processor.Print(originalText, filepath, syntaxOptions)
}

// `process` processes the input file path and text by performing either formatting (printing) or parsing based on the print flag.
//
// It converts the input byte slices to strings and configures parser options—including comment retention, language variant, stop marker, and error recovery settings. When printing is enabled, it applies printer options (indentation, binary next line, switch case indentation, space redirects, padding, minification, single-line formatting, and function next line) to format the text via the Print function. Otherwise, it parses the text with Parse and maps the resulting AST into a file representation.
//
// The function then encapsulates the file, the processed text, and any parsing error information into a result structure, marshals it to JSON, appends a null terminator, and returns a pointer to the first byte of the JSON output.
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
	indent int,
	binaryNextLine,
	switchCaseIndent,
	spaceRedirects,
	keepPadding,
	minify,
	singleLine bool,
	functionNextLine bool,
) *byte {
	filepath := string(filepathBytes)
	text := string(textBytes)

	parserOptions := processor.ParserOptions{
		KeepComments:  keepComments,
		Variant:       syntax.LangVariant(variant),
		StopAt:        string(stopAt),
		RecoverErrors: recoverErrors,
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
			SingleLine:       singleLine,
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
		fmt.Println(err)
		bytes = []byte(err.Error())
	}

	bytes = append(bytes, 0)

	return &bytes[0]
}

func main() {
}
