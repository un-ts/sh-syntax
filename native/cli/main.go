package main

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"os"

	"github.com/un-ts/sh-syntax/processor"
	"mvdan.cc/sh/v3/syntax"
)

type request struct {
	ID       uint64 `json:"id"`
	Op       string `json:"op"`
	Handle   uint64 `json:"handle"`
	Text     string `json:"text"`
	Filepath string `json:"filepath"`
	Start    uint64 `json:"start"`
	End      uint64 `json:"end"`
	Type     string `json:"type"`
	Field    string `json:"field"`
	Value    string `json:"value"`
}

type response struct {
	ID     uint64          `json:"id"`
	OK     bool            `json:"ok"`
	Handle uint64          `json:"handle,omitempty"`
	AST    json.RawMessage `json:"ast,omitempty"`
	Text   string          `json:"text,omitempty"`
	Error  string          `json:"error,omitempty"`
}

type litKey = [2]uint64

type nodeKey struct {
	typeName string
	start    uint64
	end      uint64
}

type handleState struct {
	file  *syntax.File
	lits  map[litKey]*syntax.Lit
	nodes map[nodeKey]syntax.Node
}

var (
	handles    = map[uint64]*handleState{}
	nextHandle uint64
)

func main() {
	if len(os.Args) > 1 && os.Args[1] == "--server" {
		serve()
		return
	}

	text, err := io.ReadAll(os.Stdin)
	if err != nil {
		fail(err)
	}

	filepath := "<input>"
	if len(os.Args) > 1 {
		filepath = os.Args[1]
	}

	file, ast, err := parseFile(string(text), filepath)
	if err != nil {
		fail(err)
	}
	_ = file
	fmt.Print(string(ast))
}

func serve() {
	scanner := bufio.NewScanner(os.Stdin)
	scanner.Buffer(make([]byte, 1024), 64*1024*1024)
	encoder := json.NewEncoder(os.Stdout)

	for scanner.Scan() {
		var req request
		if err := json.Unmarshal(scanner.Bytes(), &req); err != nil {
			_ = encoder.Encode(response{Error: err.Error()})
			continue
		}
		_ = encoder.Encode(handleRequest(req))
	}

	if err := scanner.Err(); err != nil {
		fail(err)
	}
}

func handleRequest(req request) response {
	switch req.Op {
	case "parse":
		file, ast, err := parseFile(req.Text, req.Filepath)
		if err != nil {
			return response{ID: req.ID, Error: err.Error()}
		}
		nextHandle++
		handle := nextHandle
		lits := map[litKey]*syntax.Lit{}
		nodes := map[nodeKey]syntax.Node{}
		syntax.Walk(file, func(node syntax.Node) bool {
			if node == nil {
				return true
			}
			nodes[nodeKey{processor.NodeTypeName(node), uint64(node.Pos().Offset()), uint64(node.End().Offset())}] = node
			if lit, ok := node.(*syntax.Lit); ok {
				lits[litKey{uint64(lit.Pos().Offset()), uint64(lit.End().Offset())}] = lit
			}
			return true
		})
		handles[handle] = &handleState{file: file, lits: lits, nodes: nodes}
		return response{ID: req.ID, OK: true, Handle: handle, AST: ast}

	case "patch":
		state := handles[req.Handle]
		if state == nil {
			return response{ID: req.ID, Error: "unknown handle"}
		}
		node := state.nodes[nodeKey{req.Type, req.Start, req.End}]
		if node == nil {
			return response{ID: req.ID, Error: "unknown node"}
		}
		if err := processor.PatchScalar(node, req.Field, json.RawMessage(req.Value)); err != nil {
			return response{ID: req.ID, Error: err.Error()}
		}
		return response{ID: req.ID, OK: true}

	case "print":
		state := handles[req.Handle]
		if state == nil {
			return response{ID: req.ID, Error: "unknown handle"}
		}
		output, err := processor.PrintFile(state.file, processor.PrinterOptions{
			Indent:           2,
			BinaryNextLine:   true,
			SwitchCaseIndent: true,
			SpaceRedirects:   true,
		})
		if err != nil {
			return response{ID: req.ID, Error: err.Error()}
		}
		return response{ID: req.ID, OK: true, Text: output}

	case "free":
		delete(handles, req.Handle)
		return response{ID: req.ID, OK: true}

	default:
		return response{ID: req.ID, Error: fmt.Sprintf("unknown op %q", req.Op)}
	}
}

func parseFile(text string, filepath string) (*syntax.File, json.RawMessage, error) {
	file, err := processor.Parse(
		text,
		filepath,
		processor.ParserOptions{
			KeepComments: true,
			Variant:      syntax.LangBash,
		},
	)
	if err != nil {
		return nil, nil, err
	}

	var buf bytes.Buffer
	if err := processor.EncodeNode(&buf, file); err != nil {
		return nil, nil, err
	}
	return file, json.RawMessage(buf.Bytes()), nil
}

func fail(err error) {
	fmt.Fprintf(os.Stderr, "%v\n", err)
	os.Exit(1)
}
