//go:build js || wasm
// +build js wasm

package main

import (
	"bytes"
	"flag"
	"io"
	"reflect"
	"syscall/js"

	"mvdan.cc/sh/v3/syntax"
)

var (
	parser  *syntax.Parser
	printer *syntax.Printer
)

var (
	uid          = flag.String("uid", "", "the unique ID")
	text         = flag.String("text", "", "the processing text")
	filepath     = flag.String("filepath", "", "file path of the processing text")
	ast          = flag.String("ast", "", "AST of the processing text")
	originalText = flag.String("originalText", "", "original processing text for AST")
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

func mapParseError(err error) interface{} {
	if err == nil {
		return nil
	}

	parseError, ok := err.(syntax.ParseError)

	if ok {
		return map[string]interface{}{
			"Filename":   parseError.Filename,
			"Text":       parseError.Text,
			"Incomplete": parseError.Incomplete,
			"Pos":        posToMap(parseError.Pos),
		}
	}

	return err.Error()
}

func Map(in interface{}, fn func(interface{}) interface{}) interface{} {
	val := reflect.ValueOf(in)
	out := make([]interface{}, val.Len())

	for i := 0; i < val.Len(); i++ {
		out[i] = fn(val.Index(i).Interface())
	}

	return out
}

func posToMap(Pos syntax.Pos) map[string]interface{} {
	return map[string]interface{}{
		"Offset": Pos.Offset(),
		"Line":   Pos.Line(),
		"Col":    Pos.Col(),
	}
}

func handleNode(node syntax.Node) interface{} {
	if node == nil {
		return nil
	}
	return map[string]interface{}{
		"Pos": posToMap(node.Pos()),
		"End": posToMap(node.End()),
	}
}

func handleComments(comments []syntax.Comment) []interface{} {
	return Map(comments, func(val interface{}) interface{} {
		curr := val.(syntax.Comment)
		return map[string]interface{}{
			"Hash": posToMap(curr.Hash),
			"Text": curr.Text,
			"Pos":  posToMap(curr.Pos()),
			"End":  posToMap(curr.End()),
		}
	}).([]interface{})
}

func handleWord(word *syntax.Word) interface{} {
	if word == nil {
		return nil
	}
	return map[string]interface{}{
		"Parts": Map(word.Parts, func(val interface{}) interface{} {
			curr := val.(syntax.WordPart)
			return handleNode(curr)
		}),
		"Lit": word.Lit(),
		"Pos": posToMap(word.Pos()),
		"End": posToMap(word.End()),
	}
}

func fileToMap(file syntax.File) map[string]interface{} {
	return map[string]interface{}{
		"Name": file.Name,
		"Stmt": Map(file.Stmts, func(val interface{}) interface{} {
			curr := val.(*syntax.Stmt)
			return map[string]interface{}{
				"Comments":   handleComments(curr.Comments),
				"Cmd":        handleNode(curr.Cmd),
				"Position":   posToMap(curr.Position),
				"Semicolon":  posToMap(curr.Semicolon),
				"Negated":    curr.Negated,
				"Background": curr.Background,
				"Coprocess":  curr.Coprocess,
				"Redirs": Map(curr.Redirs, func(val interface{}) interface{} {
					curr := val.(*syntax.Redirect)
					var N interface{}
					if curr.N != nil {
						ValuePos := posToMap(curr.N.Pos())
						ValueEnd := posToMap(curr.N.End())
						N = map[string]interface{}{
							"ValuePos": ValuePos,
							"ValueEnd": ValueEnd,
							"Value":    curr.N.Value,
							"Pos":      ValuePos,
							"End":      ValueEnd,
						}
					}
					return map[string]interface{}{
						"OpPos": posToMap(curr.OpPos),
						"Op":    curr.Op.String(),
						"N":     N,
						"Word":  handleWord(curr.Word),
						"Hdoc":  handleWord(curr.Hdoc),
						"Pos":   posToMap(curr.Pos()),
						"End":   posToMap(curr.End()),
					}
				}),
				"Pos": posToMap(curr.Pos()),
				"End": posToMap(curr.End()),
			}
		}),
		"Last": handleComments(file.Last),
		"Pos":  posToMap(file.Pos()),
		"End":  posToMap(file.End()),
	}
}

func parse(text string, filepath string) (*syntax.File, error) {
	var options []syntax.ParserOption

	options = append(options, syntax.KeepComments(*keepComments), syntax.Variant(syntax.LangVariant(*variant)))

	if *stopAt != "" {
		options = append(options, syntax.StopAt(*stopAt))
	}

	parser = syntax.NewParser(options...)

	return parser.Parse(bytes.NewReader([]byte(text)), filepath)
}

func print(originalText string, filepath string) (string, error) {
	file, err := parse(originalText, filepath)

	if err != nil {
		return "", err
	}

	printer = syntax.NewPrinter(
		syntax.Indent(*indent),
		syntax.BinaryNextLine(*binaryNextLine),
		syntax.SwitchCaseIndent(*switchCaseIndent),
		syntax.SpaceRedirects(*spaceRedirects),
		syntax.KeepPadding(*keepPadding),
		syntax.Minify(*minify),
		syntax.FunctionNextLine(*functionNextLine),
	)

	var buf bytes.Buffer
	writer := io.Writer(&buf)

	err = printer.Print(writer, file)

	if err != nil {
		return "", err
	}

	return buf.String(), err
}

func main() {
	flag.Parse()

	Go := js.Global().Get("Go")

	if Go.Get("__shProcessing").IsUndefined() {
		Go.Set("__shProcessing", js.ValueOf(map[string]interface{}{}))
	}

	__shProcessing := Go.Get("__shProcessing")

	if __shProcessing.Get(*uid).IsUndefined() {
		__shProcessing.Set(*uid, js.ValueOf(map[string]interface{}{}))
	}

	Text := __shProcessing.Get(*uid).Get("Text")

	var finalText string

	if Text.IsUndefined() {
		if *ast == "" {
			finalText = *text
		} else {
			finalText = *originalText
		}
	} else {
		finalText = Text.String()
	}

	var Data interface{}
	var Error interface{}

	if *ast == "" {
		file, err := parse(finalText, *filepath)
		Data = fileToMap(*file)
		Error = mapParseError(err)
	} else {
		result, err := print(finalText, *filepath)
		Data = result
		Error = mapParseError(err)
	}

	__shProcessing.Set(*uid, js.ValueOf(map[string]interface{}{
		"Text":  nil,
		"Data":  Data,
		"Error": Error,
	}))
}
