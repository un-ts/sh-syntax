package processor

import (
	"bytes"

	"mvdan.cc/sh/v3/syntax"
)

// printFile formats a parsed syntax tree with the configured printer.
func printFile(file *syntax.File, options PrinterOptions) (string, error) {
	if options.Simplify || options.Minify {
		syntax.Simplify(file)
	}

	printer := syntax.NewPrinter(
		syntax.Indent(options.Indent),
		syntax.BinaryNextLine(options.BinaryNextLine),
		syntax.SwitchCaseIndent(options.SwitchCaseIndent),
		syntax.SpaceRedirects(options.SpaceRedirects),
		syntax.KeepPadding(options.KeepPadding),
		syntax.Minify(options.Minify),
		syntax.SingleLine(options.SingleLine),
		syntax.FunctionNextLine(options.FunctionNextLine),
	)

	var buf bytes.Buffer
	if err := printer.Print(&buf, file); err != nil {
		return "", err
	}

	return buf.String(), nil
}
