package processor

import (
	"bytes"
	"strings"

	"mvdan.cc/sh/v3/syntax"
)

// ProcessInteractive parses complete statements from an interactive chunk and
// returns the unconsumed suffix. The next call should prepend Remaining.
func hasPendingHeredoc(stmt *syntax.Stmt) bool {
	pending := false
	syntax.Walk(stmt, func(node syntax.Node) bool {
		if node == nil {
			return false
		}
		redir, ok := node.(*syntax.Redirect)
		if !ok {
			return true
		}
		if (redir.Op == syntax.Hdoc || redir.Op == syntax.DashHdoc) && !redir.ClosePos.IsValid() {
			pending = true
			return false
		}
		return true
	})
	return pending
}

func interactiveStatementEnd(stmt *syntax.Stmt) uint {
	end := stmt.End().Offset()
	syntax.Walk(stmt, func(node syntax.Node) bool {
		if node == nil {
			return false
		}
		if nodeEnd := node.End().Offset(); nodeEnd > end {
			end = nodeEnd
		}
		if redir, ok := node.(*syntax.Redirect); ok &&
			redir.Word != nil && redir.Hdoc == nil && redir.ClosePos.IsValid() {
			if closeEnd := redir.ClosePos.Offset() + uint(len(redir.Word.Lit())); closeEnd > end {
				end = closeEnd
			}
		}
		return true
	})
	return end
}

func ProcessInteractive(text string, filepath string, parserOptions ParserOptions) []byte {
	parseText := text
	pendingLine := false
	if text != "" && !strings.HasSuffix(text, "\n") {
		pendingLine = true
		if end := strings.LastIndexByte(text, '\n'); end >= 0 {
			parseText = text[:end+1]
		} else {
			parseText = ""
		}
	}
	parser := newParser(parserOptions)
	var collected []*syntax.Stmt
	var stmts []*syntax.Stmt
	var lastEnd uint
	err := parser.Interactive(strings.NewReader(parseText), func(parsed []*syntax.Stmt) bool {
		collected = append(collected, parsed...)
		return true
	})
	pendingHeredoc := false
	for _, stmt := range collected {
		if hasPendingHeredoc(stmt) {
			pendingHeredoc = true
			break
		}
		stmts = append(stmts, stmt)
		if end := interactiveStatementEnd(stmt); end > lastEnd {
			lastEnd = end
		}
	}
	incomplete := syntax.IsIncomplete(err)
	if err == nil {
		incomplete = parser.Incomplete() || pendingHeredoc || pendingLine
	}
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
