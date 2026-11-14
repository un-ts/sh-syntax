package processor

import (
	"bytes"

	"mvdan.cc/sh/v3/syntax"
)

type ParserOptions struct {
	KeepComments  bool
	Variant       syntax.LangVariant
	StopAt        string
	RecoverErrors int
}

type PrinterOptions struct {
	Simplify         bool
	Indent           uint
	BinaryNextLine   bool
	SwitchCaseIndent bool
	SpaceRedirects   bool
	KeepPadding      bool
	Minify           bool
	SingleLine       bool
	FunctionNextLine bool
}

func newParser(parserOptions ParserOptions) *syntax.Parser {
	var options []syntax.ParserOption

	options = append(options, syntax.KeepComments(parserOptions.KeepComments), syntax.Variant(parserOptions.Variant))

	if parserOptions.StopAt != "" {
		options = append(options, syntax.StopAt(parserOptions.StopAt))
	}

	if parserOptions.RecoverErrors != 0 {
		options = append(options, syntax.RecoverErrors(parserOptions.RecoverErrors))
	}

	return syntax.NewParser(options...)
}

// Parse converts shell script text into a structured syntax tree.
func Parse(text string, filepath string, parserOptions ParserOptions) (*syntax.File, error) {
	return newParser(parserOptions).Parse(bytes.NewReader([]byte(text)), filepath)
}

// Process performs formatting or parsing and returns a framed binary result.
func Process(
	filepathBytes []byte,
	textBytes []byte,

	printOutput bool,

	parserOptions ParserOptions,
	printerOptions PrinterOptions,
) []byte {
	filepath := string(filepathBytes)
	text := string(textBytes)

	var ast []byte
	textOut := ""
	message := ""

	var err error
	errorKind := ""

	if printOutput {
		var file *syntax.File
		file, err = Parse(text, filepath, parserOptions)
		if err != nil {
			errorKind = errorKindLanguage
		} else {
			textOut, err = printSyntaxNode(file, printerOptions)
			if err != nil {
				errorKind = errorKindPrint
			}
		}
	} else {
		var file *syntax.File
		file, err = Parse(text, filepath, parserOptions)
		if err == nil {
			if file == nil {
				file = &syntax.File{}
			}
			var encoded bytes.Buffer
			if encodeErr := EncodeNodeBinary(&encoded, file); encodeErr != nil {
				err = encodeErr
			} else {
				ast = encoded.Bytes()
			}
		} else {
			errorKind = "language"
		}
	}

	if err != nil {
		message = err.Error()
	}
	var parseError *ParseError
	if mapped, mappedMessage := MapParseError(err); mapped != nil {
		parseError = mapped
		errorKind = errorKindParse
		if mappedMessage != "" {
			message = mappedMessage
		}
	}

	return encodeResult(ast, textOut, parseError, message, nil, errorKind, nil)
}
