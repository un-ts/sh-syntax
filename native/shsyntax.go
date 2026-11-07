package main

/*
#include <stdlib.h>
*/
import "C"

import (
	"bytes"
	"encoding/json"
	"unsafe"

	"github.com/un-ts/sh-syntax/processor"
	"mvdan.cc/sh/v3/syntax"
)

//export sh_syntax_parse
func sh_syntax_parse(text *C.char, filepath *C.char) *C.char {
	file, err := processor.Parse(
		C.GoString(text),
		C.GoString(filepath),
		processor.ParserOptions{
			KeepComments: true,
			Variant:      syntax.LangBash,
		},
	)
	if err != nil {
		return C.CString(errorJSON(err))
	}

	var buf bytes.Buffer
	if err := processor.EncodeNode(&buf, file); err != nil {
		return C.CString(errorJSON(err))
	}

	return C.CString(`{"ok":true,"ast":` + buf.String() + `}`)
}

//export sh_syntax_free
func sh_syntax_free(value *C.char) {
	C.free(unsafe.Pointer(value))
}

func errorJSON(err error) string {
	encoded, _ := json.Marshal(err.Error())
	return `{"ok":false,"error":` + string(encoded) + `}`
}

func main() {}
