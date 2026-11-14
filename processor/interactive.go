package processor

import (
	"bytes"
	"strings"

	"mvdan.cc/sh/v3/syntax"
)

// ProcessInteractive parses complete statements from an interactive chunk and
// returns the unconsumed suffix. The next call should prepend Remaining.
func hasPendingHeredoc(stmt *syntax.Stmt) bool {
	for _, redir := range stmt.Redirs {
		if redir.Op != syntax.Hdoc && redir.Op != syntax.DashHdoc {
			continue
		}
		if redir.Hdoc == nil {
			return true
		}
	}
	return false
}

func interactiveStatementEnd(stmt *syntax.Stmt) uint {
	// A panic here is intentionally covered by ProcessInteractive's recover; it
	// also guards incomplete nodes reached while extending the heredoc boundary.
	end := stmt.End().Offset()
	syntax.Walk(stmt, func(node syntax.Node) bool {
		if node == nil {
			return false
		}
		if nodeEnd := node.End().Offset(); nodeEnd > end {
			end = nodeEnd
		}
		return true
	})
	return end
}

func ProcessInteractive(text string, filepath string, parserOptions ParserOptions) []byte {
	parser := newParser(parserOptions)
	var collected []*syntax.Stmt
	var stmts []*syntax.Stmt
	var lastEnd uint
	var err error
	panicked := false
	func() {
		defer func() {
			// Upstream Interactive can panic while iterating incomplete heredocs;
			// see https://github.com/mvdan/sh/issues/1459.
			if recover() != nil {
				panicked = true
			}
		}()
		err = parser.Interactive(strings.NewReader(text), func(parsed []*syntax.Stmt) bool {
			collected = append(collected, parsed...)
			return true
		})
	}()

	for _, stmt := range collected {
		if hasPendingHeredoc(stmt) {
			break
		}
		stmts = append(stmts, stmt)
		if end := interactiveStatementEnd(stmt); end > lastEnd {
			lastEnd = end
		}
	}

	incomplete := syntax.IsIncomplete(err) || parser.Incomplete() || panicked
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
