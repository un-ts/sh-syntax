package processor

import (
	"bytes"

	"mvdan.cc/sh/v3/syntax"
)

// PrintNode formats an encoded syntax tree. Unlike Print, the tree is used as
// given, including edits made by the caller, rather than reparsing source text.
func PrintNode(encoded []byte, _ string, syntaxOptions SyntaxOptions) (string, error) {
	node, err := decodeNode(encoded)
	if err != nil {
		return "", err
	}

	file, ok := node.(*syntax.File)
	if !ok {
		return "", &PrintNodeError{Type: nodeType(node)}
	}

	if syntaxOptions.Simplify || syntaxOptions.Minify {
		syntax.Simplify(file)
	}

	printer := syntax.NewPrinter(
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
	if err := printer.Print(&buf, file); err != nil {
		return "", err
	}

	return buf.String(), nil
}

// PrintNodeError reports a node that cannot be printed as a full file.
type PrintNodeError struct {
	Type string
}

func (e *PrintNodeError) Error() string {
	if e.Type == "" {
		return "print(ast) requires a File node"
	}
	return "print(ast) requires a File node, got " + e.Type
}

func nodeType(node syntax.Node) string {
	switch node.(type) {
	case *syntax.File:
		return "File"
	case *syntax.Stmt:
		return "Stmt"
	case *syntax.Word:
		return "Word"
	case *syntax.Lit:
		return "Lit"
	default:
		return "unknown"
	}
}
