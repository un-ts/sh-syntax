//go:build js || wasm
// +build js wasm

package main

import (
	"reflect"

	"github.com/rx-ts/sh-syntax/processor"

	"mvdan.cc/sh/v3/syntax"
)

var (
	parser  *syntax.Parser
	printer *syntax.Printer
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

func parse(text string, filepath string, parserOptions processor.ParserOptions) (*syntax.File, error) {
	return processor.Parse(text, filepath, parserOptions)
}

func print(originalText string, filepath string, syntaxOptions processor.SyntaxOptions) (string, error) {
	return processor.Print(originalText, filepath, syntaxOptions)
}

func getParserOptions(keepComments bool, stopAt string, variant int) processor.ParserOptions {
	return processor.ParserOptions{
		KeepComments: keepComments,
		StopAt:       stopAt,
		Variant:      syntax.LangVariant(variant),
	}
}

type Result struct {
	Data  interface{} `json:"data"`
	Error interface{} `json:"error"`
}

//export parse
func Parse(text string, filepath string, keepComments bool, stopAt string, variant int) Result {
	file, err := parse(text, filepath, getParserOptions(keepComments, stopAt, variant))
	Data := fileToMap(*file)
	Error := mapParseError(err)
	return Result{
		Data,
		Error,
	}
}

//export print
func Print(originalText string, filepath string,
	// parser
	keepComments bool, stopAt string, variant int,
	// printer
	indent int, binaryNextLine, switchCaseIndent, spaceRedirects, keepPadding, minify, functionNextLine bool,
) Result {
	Data, err := print(originalText, filepath, processor.SyntaxOptions{
		ParserOptions: getParserOptions(keepComments, stopAt, variant),
		PrinterOptions: processor.PrinterOptions{
			Indent:           uint(indent),
			BinaryNextLine:   binaryNextLine,
			SwitchCaseIndent: switchCaseIndent,
			SpaceRedirects:   spaceRedirects,
			KeepPadding:      keepPadding,
			Minify:           minify,
			FunctionNextLine: functionNextLine,
		},
	})
	Error := mapParseError(err)
	return Result{
		Data,
		Error,
	}
}

func main() {}
