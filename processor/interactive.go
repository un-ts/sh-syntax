package processor

import (
	"bytes"
	"strings"

	"mvdan.cc/sh/v3/syntax"
)

// ProcessInteractive parses complete statements from an interactive chunk and
// returns the unconsumed suffix. The next call should prepend Remaining.
func ProcessInteractive(text string, filepath string, parserOptions ParserOptions) []byte {
	parser := newParser(parserOptions)
	var stmts []*syntax.Stmt
	var lastEnd uint
	err := parser.Interactive(strings.NewReader(text), func(parsed []*syntax.Stmt) bool {
		if len(parsed) > 0 {
			stmts = append(stmts, parsed...)
			if end := parsed[len(parsed)-1].End().Offset(); end > lastEnd {
				lastEnd = end
			}
		}
		return true
	})

	incomplete := syntax.IsIncomplete(err)
	remaining := ""
	message := ""
	var parseError *ParseError
	errorKind := ""
	if err != nil && !incomplete {
		message = err.Error()
		if mapped, mappedMessage := MapParseError(err); mapped != nil {
			parseError = mapped
			errorKind = errorKindParse
			if mappedMessage != "" {
				message = mappedMessage
			}
		} else {
			errorKind = errorKindLanguage
		}
	}
	if lastEnd > uint(len(text)) {
		lastEnd = uint(len(text))
	}
	remaining = text[lastEnd:]
	if !incomplete && remaining != "" && !strings.HasSuffix(text, "\n") {
		incomplete = true
	}

	file := &syntax.File{Name: filepath, Stmts: stmts}
	var encoded bytes.Buffer
	if encodeErr := EncodeNodeBinary(&encoded, file); encodeErr != nil {
		message = encodeErr.Error()
		parseError = nil
		errorKind = errorKindLanguage
		encoded.Reset()
	}

	return encodeResult(encoded.Bytes(), "", parseError, message, resultMeta{
		errorKind:   errorKind,
		interactive: &InteractiveMeta{Remaining: remaining, Incomplete: incomplete},
	})
}
