package processor

import (
	"bytes"
	"io"

	"mvdan.cc/sh/v3/syntax"
)

var (
	parser  *syntax.Parser
	printer *syntax.Printer
)

type ParserOptions struct {
	KeepComments bool
	StopAt       string
	Variant      syntax.LangVariant
}

type PrinterOptions struct {
	Indent           uint
	BinaryNextLine   bool
	SwitchCaseIndent bool
	SpaceRedirects   bool
	KeepPadding      bool
	Minify           bool
	FunctionNextLine bool
}

type SyntaxOptions struct {
	ParserOptions
	PrinterOptions
}

func Parse(text string, filepath string, parserOptions ParserOptions) (*syntax.File, error) {
	var options []syntax.ParserOption

	options = append(options, syntax.KeepComments(parserOptions.KeepComments), syntax.Variant(parserOptions.Variant))

	if parserOptions.StopAt != "" {
		options = append(options, syntax.StopAt(parserOptions.StopAt))
	}

	parser = syntax.NewParser(options...)

	return parser.Parse(bytes.NewReader([]byte(text)), filepath)
}

func Print(originalText string, filepath string, syntaxOptions SyntaxOptions) (string, error) {
	file, err := Parse(originalText, filepath, syntaxOptions.ParserOptions)

	if err != nil {
		return "", err
	}

	printer = syntax.NewPrinter(
		syntax.Indent(syntaxOptions.Indent),
		syntax.BinaryNextLine(syntaxOptions.BinaryNextLine),
		syntax.SwitchCaseIndent(syntaxOptions.SwitchCaseIndent),
		syntax.SpaceRedirects(syntaxOptions.SpaceRedirects),
		syntax.KeepPadding(syntaxOptions.KeepPadding),
		syntax.Minify(syntaxOptions.Minify),
		syntax.FunctionNextLine(syntaxOptions.FunctionNextLine),
	)

	var buf bytes.Buffer
	writer := io.Writer(&buf)

	err = printer.Print(writer, file)

	if err != nil {
		return "", err
	}

	return buf.String(), err
}
