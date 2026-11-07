package processor

import (
	"bytes"
	"encoding/json"

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

	return PrintNode(file, syntaxOptions.PrinterOptions)
}

// PrintNode formats an already parsed syntax node.
func PrintNode(node syntax.Node, printerOptions PrinterOptions) (string, error) {
	if printerOptions.Simplify || printerOptions.Minify {
		syntax.Simplify(node)
	}

	printer := syntax.NewPrinter(
		syntax.Indent(printerOptions.Indent),
		syntax.BinaryNextLine(printerOptions.BinaryNextLine),
		syntax.SwitchCaseIndent(printerOptions.SwitchCaseIndent),
		syntax.SpaceRedirects(printerOptions.SpaceRedirects),
		syntax.KeepPadding(printerOptions.KeepPadding),
		syntax.Minify(printerOptions.Minify),
		syntax.SingleLine(printerOptions.SingleLine),
		syntax.FunctionNextLine(printerOptions.FunctionNextLine),
	)

	var buf bytes.Buffer
	if err := printer.Print(&buf, node); err != nil {
		return "", err
	}

	return buf.String(), nil
}

// Process processes the input file path and text by performing either
// formatting or parsing, based on the print flag. The result is a JSON
// envelope.
func Process(
	filepathBytes []byte,
	textBytes []byte,

	print bool,

	parserOptions ParserOptions,
	printerOptions PrinterOptions,
) []byte {
	filepath := string(filepathBytes)
	text := string(textBytes)

	fileJSON := []byte("null")
	textOut := ""
	message := ""

	var err error

	if print {
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
		encoded.Grow(min(len(textBytes)*64, 64<<20))
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

	parseErrorJSON, marshalErr := json.Marshal(parseError)
	if marshalErr != nil {
		parseErrorJSON = []byte("null")
	}

	var out bytes.Buffer
	out.Grow(len(fileJSON) + len(parseErrorJSON) + len(textOut) + len(message) + 64)
	out.WriteString(`{"file":`)
	out.Write(fileJSON)
	out.WriteString(`,"text":`)
	writeString(&out, textOut)
	out.WriteString(`,"parseError":`)
	out.Write(parseErrorJSON)
	out.WriteString(`,"message":`)
	writeString(&out, message)
	out.WriteByte('}')
	return out.Bytes()
}

func main() {
}
