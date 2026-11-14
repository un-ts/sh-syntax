package processor

import "mvdan.cc/sh/v3/syntax"

// containsBraceExp reports whether node contains a BraceExp. syntax.Walk has
// no BraceExp case, so it panics on that node; recover turns that into a match.
func containsBraceExp(node syntax.Node) (found bool) {
	defer func() {
		if recover() != nil {
			found = true
		}
	}()
	syntax.Walk(node, func(current syntax.Node) bool {
		if _, ok := current.(*syntax.BraceExp); ok {
			found = true
			return false
		}
		return true
	})
	return found
}

// clearSplitLitPositions makes the synthetic literals from SplitBraces carry no
// source positions instead of keeping the original literal's full range.
func clearSplitLitPositions(word *syntax.Word) {
	for _, part := range word.Parts {
		switch part := part.(type) {
		case *syntax.Lit:
			part.ValuePos = syntax.Pos{}
			part.ValueEnd = syntax.Pos{}
		case *syntax.BraceExp:
			for _, elem := range part.Elems {
				clearSplitLitPositions(elem)
			}
		}
	}
}
