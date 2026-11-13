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

type SyntaxOptions struct {
	ParserOptions
	PrinterOptions
}

// Parse converts shell script text into a structured syntax tree.
func Parse(text string, filepath string, parserOptions ParserOptions) (*syntax.File, error) {
	var options []syntax.ParserOption

	options = append(options, syntax.KeepComments(parserOptions.KeepComments), syntax.Variant(parserOptions.Variant))

	if parserOptions.StopAt != "" {
		options = append(options, syntax.StopAt(parserOptions.StopAt))
	}

	if parserOptions.RecoverErrors != 0 {
		options = append(options, syntax.RecoverErrors(parserOptions.RecoverErrors))
	}

	parser := syntax.NewParser(options...)

	return parser.Parse(bytes.NewReader([]byte(text)), filepath)
}

// Print returns the formatted shell script defined in originalText.
func Print(originalText string, filepath string, syntaxOptions SyntaxOptions) (string, error) {
	file, err := Parse(originalText, filepath, syntaxOptions.ParserOptions)
	if err != nil {
		return "", err
	}

	return printFile(file, syntaxOptions.PrinterOptions)
}

// Process processes the input file path and text by performing either
// formatting or parsing, based on the print flag. The result is a JSON
// envelope.
func Process(
	filepathBytes []byte,
	textBytes []byte,

	printOutput bool,

	parserOptions ParserOptions,
	printerOptions PrinterOptions,
) []byte {
	filepath := string(filepathBytes)
	text := string(textBytes)

	fileJSON := []byte("null")
	textOut := ""
	message := ""

	var err error

	if printOutput {
		textOut, err = Print(text, filepath, SyntaxOptions{
			ParserOptions:  parserOptions,
			PrinterOptions: printerOptions,
		})
	} else {
		var file *syntax.File
		file, err = Parse(text, filepath, parserOptions)
		if file == nil {
			file = &syntax.File{}
		}
		var encoded bytes.Buffer
		const maxGrow = 64 << 20
		grow := maxGrow
		if len(textBytes) < maxGrow/64 {
			grow = len(textBytes) * 64
		}
		encoded.Grow(grow)
		if encodeErr := EncodeNode(&encoded, file); encodeErr != nil {
			err = encodeErr
		} else {
			fileJSON = encoded.Bytes()
		}
	}

	if err != nil {
		message = err.Error()
	}
	var parseError *ParseError
	if mapped, mappedMessage := MapParseError(err); mapped != nil {
		parseError = mapped
		if mappedMessage != "" {
			message = mappedMessage
		}
	}

	var out bytes.Buffer
	out.Grow(len(fileJSON) + len(textOut) + len(message) + 256)
	out.WriteString(`{"file":`)
	out.Write(fileJSON)
	out.WriteString(`,"text":`)
	writeString(&out, textOut)
	out.WriteString(`,"parseError":`)
	writeParseError(&out, parseError)
	out.WriteString(`,"message":`)
	writeString(&out, message)
	out.WriteByte('}')
	return out.Bytes()
}
