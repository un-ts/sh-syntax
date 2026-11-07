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
	Text     string `json:"text"`
	Filepath string `json:"filepath"`
}

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

	fmt.Print(parse(string(text), filepath))
}

func serve() {
	scanner := bufio.NewScanner(os.Stdin)
	scanner.Buffer(make([]byte, 1024), 64*1024*1024)

	for scanner.Scan() {
		var req request
		if err := json.Unmarshal(scanner.Bytes(), &req); err != nil {
			fmt.Println(errorJSON(err))
			continue
		}
		if req.Filepath == "" {
			req.Filepath = "<input>"
		}
		fmt.Println(parse(req.Text, req.Filepath))
	}

	if err := scanner.Err(); err != nil {
		fail(err)
	}
}

func parse(text string, filepath string) string {
	file, err := processor.Parse(
		text,
		filepath,
		processor.ParserOptions{
			KeepComments: true,
			Variant:      syntax.LangBash,
		},
	)
	if err != nil {
		return errorJSON(err)
	}

	var buf bytes.Buffer
	if err := processor.EncodeNode(&buf, file); err != nil {
		return errorJSON(err)
	}

	return `{"ok":true,"ast":` + buf.String() + `}`
}

func errorJSON(err error) string {
	encoded, _ := json.Marshal(err.Error())
	return `{"ok":false,"error":` + string(encoded) + `}`
}

func fail(err error) {
	fmt.Fprintf(os.Stderr, "%v\n", err)
	os.Exit(1)
}
