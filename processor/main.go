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
	KeepComments  bool
	Variant       syntax.LangVariant
	StopAt        string
	RecoverErrors int
}

type PrinterOptions struct {
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
// It assembles parser options based on the provided configuration—such as whether to keep comments,
// the shell syntax variant to use, an optional stopping point, and the desired error recovery level.
// The supplied file path is used for contextual error reporting.
// It returns a syntax.File representing the parsed script, or an error if parsing fails.
func Parse(text string, filepath string, parserOptions ParserOptions) (*syntax.File, error) {
	var options []syntax.ParserOption

	options = append(options, syntax.KeepComments(parserOptions.KeepComments), syntax.Variant(parserOptions.Variant))

	if parserOptions.StopAt != "" {
		options = append(options, syntax.StopAt(parserOptions.StopAt))
	}

	if parserOptions.RecoverErrors != 0 {
		options = append(options, syntax.RecoverErrors(parserOptions.RecoverErrors))
	}

	parser = syntax.NewParser(options...)

	return parser.Parse(bytes.NewReader([]byte(text)), filepath)
}

// Print returns the formatted shell script defined in originalText.
// It first parses the input using the parser options in syntaxOptions and then prints the resulting
// syntax tree using printer options—including indentation, single-line formatting, and others.
// The filepath parameter is used for context in error messages. On success, Print returns the formatted
// script as a string, or an error if parsing or printing fails.
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
		syntax.SingleLine(syntaxOptions.SingleLine),
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
