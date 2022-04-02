//go:build js || wasm
// +build js wasm

package main

import (
	"bytes"
	"flag"
	"io"
	"syscall/js"

	"mvdan.cc/sh/v3/syntax"
)

var (
	parser  *syntax.Parser
	printer *syntax.Printer
)

var (
	uid          = flag.String("uid", "", "unique ID")
	text         = flag.String("text", "", "processing text")
	filepath     = flag.String("filepath", "", "file path of the processing text")
	keepComments = flag.Bool("keepComments", false, "KeepComments makes the parser parse comments and attach them to nodes, as opposed to discarding them.")
	stopAt       = flag.String("stopAt", "", `StopAt configures the lexer to stop at an arbitrary word, treating it as if it were the end of the input. It can contain any characters except whitespace, and cannot be over four bytes in size.
This can be useful to embed shell code within another language, as one can use a special word to mark the delimiters between the two.
As a word, it will only apply when following whitespace or a separating token. For example, StopAt("$$") will act on the inputs "foo $$" and "foo;$$", but not on "foo \'$$\'".
The match is done by prefix, so the example above will also act on "foo $$bar".`)
	variant          = flag.Int("variant", 0, "Variant changes the shell language variant that the parser will accept.")
	indent           = flag.Uint("indent", 0, "Indent sets the number of spaces used for indentation. If set to 0, tabs will be used instead.")
	binaryNextLine   = flag.Bool("binaryNextLine", true, "BinaryNextLine will make binary operators appear on the next line when a binary command, such as a pipe, spans multiple lines. A backslash will be used.")
	switchCaseIndent = flag.Bool("switchCaseIndent", true, "SwitchCaseIndent will make switch cases be indented. As such, switch case bodies will be two levels deeper than the switch itself.")
	spaceRedirects   = flag.Bool("spaceRedirects", true, "SpaceRedirects will put a space after most redirection operators. The exceptions are '>&', '<&', '>(', and '<('.")
	keepPadding      = flag.Bool("keepPadding", false, `KeepPadding will keep most nodes and tokens in the same column that they were in the original source. This allows the user to decide how to align and pad their code with spaces.
Note that this feature is best-effort and will only keep the alignment stable, so it may need some human help the first time it is run.`)
	minify           = flag.Bool("minify", false, "Minify will print programs in a way to save the most bytes possible. For example, indentation and comments are skipped, and extra whitespace is avoided when possible.")
	functionNextLine = flag.Bool("functionNextLine", false, "FunctionNextLine will place a function's opening braces on the next line.")
)

func main() {
	flag.Parse()

	var options []syntax.ParserOption

	options = append(options, syntax.KeepComments(*keepComments), syntax.Variant(syntax.LangVariant(*variant)))

	if *stopAt != "" {
		options = append(options, syntax.StopAt(*stopAt))
	}

	parser = syntax.NewParser(options...)

	printer = syntax.NewPrinter(
		syntax.Indent(*indent),
		syntax.BinaryNextLine(*binaryNextLine),
		syntax.SwitchCaseIndent(*switchCaseIndent),
		syntax.SpaceRedirects(*spaceRedirects),
		syntax.KeepPadding(*keepPadding),
		syntax.FunctionNextLine(*functionNextLine),
	)

	Go := js.Global().Get("Go")

	if Go.Get("__shProcessing").IsUndefined() {
		Go.Set("__shProcessing", js.ValueOf(map[string]interface{}{}))
	}

	result := map[string]interface{}{}

	file, err := parser.Parse(bytes.NewReader([]byte(*text)), "path")
	if err != nil {
		error, ok := err.(syntax.ParseError)
		if ok {
			result["error"] = map[string]interface{}{
				"filename":   error.Filename,
				"incomplete": error.Incomplete,
				"text":       error.Text,
				"pos": map[string]interface{}{
					"col":    error.Col(),
					"line":   error.Line(),
					"offset": error.Offset(),
				},
				"message": error.Error(),
			}
		} else {
			result["error"] = err.Error()
		}
	} else {
		var buf bytes.Buffer
		writer := io.Writer(&buf)
		err = printer.Print(writer, file)
		if err != nil {
			result["error"] = err.Error()
		} else {
			result["text"] = buf.String()
		}
	}

	Go.Get("__shProcessing").Set(*uid, js.ValueOf(result))
}
