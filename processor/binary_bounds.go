package processor

import (
	"bytes"

	"mvdan.cc/sh/v3/syntax"
)

// writeBinaryNodeBounds writes a node's byte range, falling back to zero for
// incomplete nodes whose Pos or End would panic, such as an empty Word.
func writeBinaryNodeBounds(buf *bytes.Buffer, node syntax.Node) {
	start, end := binaryNodeBounds(node)
	writeBinaryUint(buf, uint64(start.Offset()))
	writeBinaryUint(buf, uint64(end.Offset()))
}

func binaryNodeBounds(node syntax.Node) (start, end syntax.Pos) {
	defer func() {
		if recover() != nil {
			start, end = syntax.Pos{}, syntax.Pos{}
		}
	}()
	return node.Pos(), node.End()
}
