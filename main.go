//go:build js || wasm
// +build js wasm

package main

import (
	"reflect"
	"strconv"
	"syscall/js"

	"github.com/rx-ts/sh-syntax/processor"

	"mvdan.cc/sh/v3/syntax"
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

func Parse(text string, filepath string, parserOptions processor.ParserOptions) (*syntax.File, error) {
	return processor.Parse(text, filepath, parserOptions)
}

func Print(originalText string, filepath string, syntaxOptions processor.SyntaxOptions) (string, error) {
	return processor.Print(originalText, filepath, syntaxOptions)
}

func jsBool(value js.Value) bool {
	if value.IsUndefined() || value.IsNull() {
		return false
	}

	return value.Bool()
}

func jsInt(value js.Value) int {
	if value.IsUndefined() || value.IsNull() {
		return 0
	}

	return value.Int()
}

func jsString(value js.Value) string {
	if value.IsUndefined() || value.IsNull() {
		return ""
	}

	return value.String()
}

func getParserOptions(options js.Value) processor.ParserOptions {
	return processor.ParserOptions{
		KeepComments: jsBool(options.Get("keepComments")),
		StopAt:       jsString(options.Get("stopAt")),
		Variant:      syntax.LangVariant(jsInt(options.Get("variant"))),
	}
}

func getPrinterOptions(options js.Value) processor.PrinterOptions {
	return processor.PrinterOptions{
		Indent:           uint(jsInt(options.Get("indent"))),
		BinaryNextLine:   jsBool(options.Get("binaryNextLine")),
		SwitchCaseIndent: jsBool(options.Get("switchCaseIndent")),
		SpaceRedirects:   jsBool(options.Get("spaceRedirects")),
		KeepPadding:      jsBool(options.Get("keepPadding")),
		Minify:           jsBool(options.Get("minify")),
		FunctionNextLine: jsBool(options.Get("functionNextLine")),
	}
}

func main() {
	uid := strconv.Itoa(getUid())

	println("uid:", uid)

	Go := js.Global().Get("Go")

	if Go.Get("__shProcessing").IsUndefined() {
		Go.Set("__shProcessing", js.ValueOf(map[string]interface{}{}))
	}

	__shProcessing := Go.Get("__shProcessing")

	if __shProcessing.Get(uid).IsUndefined() {
		__shProcessing.Set(uid, js.ValueOf(map[string]interface{}{}))
	}

	options := __shProcessing.Get(uid)

	filepath := jsString(options.Get("filepath"))
	ast := jsString(options.Get("ast"))
	text := jsString(options.Get("text"))

	parserOptions := getParserOptions(options)

	var data interface{}
	var error interface{}

	println("filepath:", filepath)

	if ast == "" {
		file, err := Parse(text, filepath, parserOptions)
		data = fileToMap(*file)
		error = mapParseError(err)
	} else {
		result, err := Print(text, filepath, processor.SyntaxOptions{
			ParserOptions:  parserOptions,
			PrinterOptions: getPrinterOptions(options),
		})
		data = result
		error = mapParseError(err)
	}

	__shProcessing.Set(uid, js.ValueOf(map[string]interface{}{
		"data":  data,
		"error": error,
	}))
}

func getUid() int
