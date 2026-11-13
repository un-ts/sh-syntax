package processor

import (
	"bytes"

	"mvdan.cc/sh/v3/syntax"
)

// printSyntaxNode formats a syntax tree with the configured printer.
func printSyntaxNode(node syntax.Node, options PrinterOptions) (string, error) {
	if options.Simplify || options.Minify {
		syntax.Simplify(node)
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
	if err := printer.Print(&buf, node); err != nil {
		return "", err
	}

	return buf.String(), nil
}
