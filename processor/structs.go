package processor

import (
	"mvdan.cc/sh/v3/syntax"
)

type Pos struct {
	Offset uint
	Line   uint
	Col    uint
}

type Node struct {
	Pos Pos
	End Pos
}

type Comment struct {
	Hash Pos
	Text string
	Pos  Pos
	End  Pos
}

type Word struct {
	Parts []Node
	Lit   string
	Pos   Pos
	End   Pos
}

type Lit struct {
	ValuePos Pos
	ValueEnd Pos
	Value    string
	Pos      Pos
	End      Pos
}

type Redirect struct {
	OpPos Pos
	Op    string
	N     *Lit
	Word  *Word
	Hdoc  *Word
	Pos   Pos
	End   Pos
}

type Stmt struct {
	Comments   []Comment
	Cmd        *Node
	Position   Pos
	Semicolon  Pos
	Negated    bool
	Background bool
	Coprocess  bool
	Redirs     []Redirect
	Pos        Pos
	End        Pos
}

type File struct {
	Name string
	Stmt []Stmt
	Last []Comment
	Pos  Pos
	End  Pos
}

type ParseError struct {
	syntax.ParseError
	Pos Pos
}

type Result struct {
	File        `json:"file"`
	Text        string `json:"text"`
	*ParseError `json:"parseError"`
	Message     string `json:"message"`
}

func MapParseError(err error) (*ParseError, string) {
	if err == nil {
		return nil, ""
	}

	parseError, ok := err.(syntax.ParseError)

	if ok {
		return &ParseError{
			ParseError: parseError,
			Pos:        mapPos(parseError.Pos),
		}, parseError.Error()
	}

	return nil, err.Error()
}

func mapPos(pos syntax.Pos) Pos {
	return Pos{
		Offset: pos.Offset(),
		Line:   pos.Line(),
		Col:    pos.Col(),
	}
}

func mapNode(node syntax.Node) *Node {
	if node == nil {
		return nil
	}
	return &Node{
		Pos: mapPos(node.Pos()),
		End: mapPos(node.End()),
	}
}

// `mapComments` transforms a slice of syntax.Comment into a slice of Comment by converting each comment's hash, text, start, and end positions using mapPos. It preserves the order of the comments and returns an empty slice if the input is nil or empty.
func mapComments(comments []syntax.Comment) []Comment {
	commentsSize := len(comments)
	commentList := make([]Comment, commentsSize)
	for i := range commentsSize {
		curr := comments[i]
		commentList[i] = Comment{
			Hash: mapPos(curr.Hash),
			Text: curr.Text,
			Pos:  mapPos(curr.Pos()),
			End:  mapPos(curr.End()),
		}
	}
	return commentList
}

// `mapWord` converts a *syntax.Word into a custom *Word structure. It maps each part of the syntax.Word using mapNode,
// extracts the literal via Lit(), and maps the start and end positions using mapPos. If the input word is nil, it returns nil.
func mapWord(word *syntax.Word) *Word {
	if word == nil {
		return nil
	}

	size := len(word.Parts)
	parts := make([]Node, size)

	for i := range size {
		parts[i] = *mapNode(word.Parts[i])
	}

	return &Word{
		Parts: parts,
		Lit:   word.Lit(),
		Pos:   mapPos(word.Pos()),
		End:   mapPos(word.End()),
	}
}

// `mapRedirects` converts a slice of syntax.Redirect pointers into a slice of custom Redirect structures.
// It maps each redirect’s operator position, associated literal (if present), word, heredoc, and overall positional data using helper functions.
// If the literal component (N) is non-nil, it is transformed into a Lit structure that encapsulates both its value and positional information.
func mapRedirects(redirects []*syntax.Redirect) []Redirect {
	redirsSize := len(redirects)
	redirs := make([]Redirect, redirsSize)
	for i := range redirsSize {
		curr := redirects[i]
		var N *Lit
		if curr.N != nil {
			ValuePos := mapPos(curr.N.Pos())
			ValueEnd := mapPos(curr.N.End())
			N = &Lit{
				ValuePos: ValuePos,
				ValueEnd: ValueEnd,
				Value:    curr.N.Value,
				Pos:      ValuePos,
				End:      ValueEnd,
			}
		}
		redirs[i] = Redirect{
			OpPos: mapPos(curr.OpPos),
			Op:    curr.Op.String(),
			N:     N,
			Word:  mapWord(curr.Word),
			Hdoc:  mapWord(curr.Hdoc),
			Pos:   mapPos(curr.Pos()),
			End:   mapPos(curr.End()),
		}
	}
	return redirs
}

// `mapStmts` converts a slice of *syntax.Stmt into a slice of Stmt by mapping each statement's components—including comments, command node, positional information, semicolon, redirections, and execution flags (negated, background, coprocess).
func mapStmts(stmts []*syntax.Stmt) []Stmt {
	stmtsSize := len(stmts)
	stmtList := make([]Stmt, stmtsSize)
	for i := range stmtsSize {
		curr := stmts[i]
		stmtList[i] = Stmt{
			Comments:   mapComments(curr.Comments),
			Cmd:        mapNode(curr.Cmd),
			Position:   mapPos(curr.Position),
			Semicolon:  mapPos(curr.Semicolon),
			Negated:    curr.Negated,
			Background: curr.Background,
			Coprocess:  curr.Coprocess,
			Redirs:     mapRedirects(curr.Redirs),
			Pos:        mapPos(curr.Pos()),
			End:        mapPos(curr.End()),
		}
	}
	return stmtList
}

func MapFile(file syntax.File) File {
	return File{
		Name: file.Name,
		Stmt: mapStmts(file.Stmts),
		Last: mapComments(file.Last),
		Pos:  mapPos(file.Pos()),
		End:  mapPos(file.End()),
	}
}
