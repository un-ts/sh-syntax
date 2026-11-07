package main

import (
	"bytes"
	"fmt"
	"io"
	"os"

	"github.com/un-ts/sh-syntax/processor"
	"mvdan.cc/sh/v3/syntax"
)

func main() {
	text, err := io.ReadAll(os.Stdin)
	if err != nil {
		fail(err)
	}

	filepath := "<input>"
	if len(os.Args) > 1 {
		filepath = os.Args[1]
	}

	file, err := processor.Parse(
		string(text),
		filepath,
		processor.ParserOptions{
			KeepComments: true,
			Variant:      syntax.LangBash,
		},
	)
	if err != nil {
		fail(err)
	}

	var buf bytes.Buffer
	if err := processor.EncodeNode(&buf, file); err != nil {
		fail(err)
	}

	fmt.Print(`{"ok":true,"ast":` + buf.String() + `}`)
}

func fail(err error) {
	fmt.Fprintf(os.Stderr, "%v\n", err)
	os.Exit(1)
}
