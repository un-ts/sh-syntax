// Static JSON encoder for mvdan.cc/sh v3.13.1 syntax nodes.
package processor

import (
	"bytes"
	"io"

	"mvdan.cc/sh/v3/syntax"
)

func writeNodeStart(buf *bytes.Buffer, typeName string, pos, end syntax.Pos, force bool) {
	buf.WriteByte('{')
	buf.WriteString(`"__type":`)
	writeString(buf, typeName)
	if force {
		buf.WriteString(`,"Type":`)
		writeString(buf, typeName)
	}
	buf.WriteString(`,"Pos":`)
	writePos(buf, pos)
	buf.WriteString(`,"End":`)
	writePos(buf, end)
}

func writeKeyFirst(buf *bytes.Buffer, name string, first *bool) {
	if !*first {
		buf.WriteByte(',')
	}
	*first = false
	buf.WriteByte('"')
	buf.WriteString(name)
	buf.WriteString(`":`)
}

func writeBool(buf *bytes.Buffer, value bool) {
	if value {
		buf.WriteString("true")
	} else {
		buf.WriteString("false")
	}
}

func encodeFile(buf *bytes.Buffer, v *syntax.File, force bool) {
	writeNodeStart(buf, "File", v.Pos(), v.End(), force)
	first := false
	writeKeyFirst(buf, "Name", &first)
	writeString(buf, v.Name)
	writeKeyFirst(buf, "Stmts", &first)
	buf.WriteByte('[')
	for i, item := range v.Stmts {
		if i > 0 {
			buf.WriteByte(',')
		}
		if item == nil {
			buf.WriteString("null")
		} else {
			encodeStmt(buf, item, false)
		}
	}
	buf.WriteByte(']')
	writeKeyFirst(buf, "Last", &first)
	buf.WriteByte('[')
	for i := range v.Last {
		if i > 0 {
			buf.WriteByte(',')
		}
		encodeComment(buf, &v.Last[i], false)
	}
	buf.WriteByte(']')
	buf.WriteByte('}')
}

func encodeComment(buf *bytes.Buffer, v *syntax.Comment, force bool) {
	writeNodeStart(buf, "Comment", v.Pos(), v.End(), force)
	first := false
	writeKeyFirst(buf, "Hash", &first)
	writePos(buf, v.Hash)
	writeKeyFirst(buf, "Text", &first)
	writeString(buf, v.Text)
	buf.WriteByte('}')
}

func encodeStmt(buf *bytes.Buffer, v *syntax.Stmt, force bool) {
	writeNodeStart(buf, "Stmt", v.Pos(), v.End(), force)
	first := false
	writeKeyFirst(buf, "Comments", &first)
	buf.WriteByte('[')
	for i := range v.Comments {
		if i > 0 {
			buf.WriteByte(',')
		}
		encodeComment(buf, &v.Comments[i], false)
	}
	buf.WriteByte(']')
	writeKeyFirst(buf, "Cmd", &first)
	encodeCommand(buf, v.Cmd, true)
	writeKeyFirst(buf, "Position", &first)
	writePos(buf, v.Position)
	writeKeyFirst(buf, "Semicolon", &first)
	writePos(buf, v.Semicolon)
	writeKeyFirst(buf, "Negated", &first)
	writeBool(buf, v.Negated)
	writeKeyFirst(buf, "Background", &first)
	writeBool(buf, v.Background)
	writeKeyFirst(buf, "Coprocess", &first)
	writeBool(buf, v.Coprocess)
	writeKeyFirst(buf, "Disown", &first)
	writeBool(buf, v.Disown)
	writeKeyFirst(buf, "Redirs", &first)
	buf.WriteByte('[')
	for i, item := range v.Redirs {
		if i > 0 {
			buf.WriteByte(',')
		}
		if item == nil {
			buf.WriteString("null")
		} else {
			encodeRedirect(buf, item, false)
		}
	}
	buf.WriteByte(']')
	buf.WriteByte('}')
}

func encodeAssign(buf *bytes.Buffer, v *syntax.Assign, force bool) {
	writeNodeStart(buf, "Assign", v.Pos(), v.End(), force)
	first := false
	writeKeyFirst(buf, "Append", &first)
	writeBool(buf, v.Append)
	writeKeyFirst(buf, "Naked", &first)
	writeBool(buf, v.Naked)
	writeKeyFirst(buf, "Name", &first)
	if v.Name == nil {
		buf.WriteString("null")
	} else {
		encodeLit(buf, v.Name, false)
	}
	writeKeyFirst(buf, "Index", &first)
	encodeArithmExpr(buf, v.Index, true)
	writeKeyFirst(buf, "Value", &first)
	if v.Value == nil {
		buf.WriteString("null")
	} else {
		encodeWord(buf, v.Value, false)
	}
	writeKeyFirst(buf, "Array", &first)
	if v.Array == nil {
		buf.WriteString("null")
	} else {
		encodeArrayExpr(buf, v.Array, false)
	}
	buf.WriteByte('}')
}

func encodeRedirect(buf *bytes.Buffer, v *syntax.Redirect, force bool) {
	writeNodeStart(buf, "Redirect", v.Pos(), v.End(), force)
	first := false
	writeKeyFirst(buf, "OpPos", &first)
	writePos(buf, v.OpPos)
	writeKeyFirst(buf, "Op", &first)
	writeUint(buf, uint64(v.Op))
	writeKeyFirst(buf, "N", &first)
	if v.N == nil {
		buf.WriteString("null")
	} else {
		encodeLit(buf, v.N, false)
	}
	writeKeyFirst(buf, "Word", &first)
	if v.Word == nil {
		buf.WriteString("null")
	} else {
		encodeWord(buf, v.Word, false)
	}
	writeKeyFirst(buf, "Hdoc", &first)
	if v.Hdoc == nil {
		buf.WriteString("null")
	} else {
		encodeWord(buf, v.Hdoc, false)
	}
	buf.WriteByte('}')
}

func encodeCallExpr(buf *bytes.Buffer, v *syntax.CallExpr, force bool) {
	writeNodeStart(buf, "CallExpr", v.Pos(), v.End(), force)
	first := false
	writeKeyFirst(buf, "Assigns", &first)
	buf.WriteByte('[')
	for i, item := range v.Assigns {
		if i > 0 {
			buf.WriteByte(',')
		}
		if item == nil {
			buf.WriteString("null")
		} else {
			encodeAssign(buf, item, false)
		}
	}
	buf.WriteByte(']')
	writeKeyFirst(buf, "Args", &first)
	buf.WriteByte('[')
	for i, item := range v.Args {
		if i > 0 {
			buf.WriteByte(',')
		}
		if item == nil {
			buf.WriteString("null")
		} else {
			encodeWord(buf, item, false)
		}
	}
	buf.WriteByte(']')
	buf.WriteByte('}')
}

func encodeSubshell(buf *bytes.Buffer, v *syntax.Subshell, force bool) {
	writeNodeStart(buf, "Subshell", v.Pos(), v.End(), force)
	first := false
	writeKeyFirst(buf, "Lparen", &first)
	writePos(buf, v.Lparen)
	writeKeyFirst(buf, "Rparen", &first)
	writePos(buf, v.Rparen)
	writeKeyFirst(buf, "Stmts", &first)
	buf.WriteByte('[')
	for i, item := range v.Stmts {
		if i > 0 {
			buf.WriteByte(',')
		}
		if item == nil {
			buf.WriteString("null")
		} else {
			encodeStmt(buf, item, false)
		}
	}
	buf.WriteByte(']')
	writeKeyFirst(buf, "Last", &first)
	buf.WriteByte('[')
	for i := range v.Last {
		if i > 0 {
			buf.WriteByte(',')
		}
		encodeComment(buf, &v.Last[i], false)
	}
	buf.WriteByte(']')
	buf.WriteByte('}')
}

func encodeBlock(buf *bytes.Buffer, v *syntax.Block, force bool) {
	writeNodeStart(buf, "Block", v.Pos(), v.End(), force)
	first := false
	writeKeyFirst(buf, "Lbrace", &first)
	writePos(buf, v.Lbrace)
	writeKeyFirst(buf, "Rbrace", &first)
	writePos(buf, v.Rbrace)
	writeKeyFirst(buf, "Stmts", &first)
	buf.WriteByte('[')
	for i, item := range v.Stmts {
		if i > 0 {
			buf.WriteByte(',')
		}
		if item == nil {
			buf.WriteString("null")
		} else {
			encodeStmt(buf, item, false)
		}
	}
	buf.WriteByte(']')
	writeKeyFirst(buf, "Last", &first)
	buf.WriteByte('[')
	for i := range v.Last {
		if i > 0 {
			buf.WriteByte(',')
		}
		encodeComment(buf, &v.Last[i], false)
	}
	buf.WriteByte(']')
	buf.WriteByte('}')
}

func encodeIfClause(buf *bytes.Buffer, v *syntax.IfClause, force bool) {
	writeNodeStart(buf, "IfClause", v.Pos(), v.End(), force)
	first := false
	writeKeyFirst(buf, "Position", &first)
	writePos(buf, v.Position)
	writeKeyFirst(buf, "ThenPos", &first)
	writePos(buf, v.ThenPos)
	writeKeyFirst(buf, "FiPos", &first)
	writePos(buf, v.FiPos)
	writeKeyFirst(buf, "Cond", &first)
	buf.WriteByte('[')
	for i, item := range v.Cond {
		if i > 0 {
			buf.WriteByte(',')
		}
		if item == nil {
			buf.WriteString("null")
		} else {
			encodeStmt(buf, item, false)
		}
	}
	buf.WriteByte(']')
	writeKeyFirst(buf, "CondLast", &first)
	buf.WriteByte('[')
	for i := range v.CondLast {
		if i > 0 {
			buf.WriteByte(',')
		}
		encodeComment(buf, &v.CondLast[i], false)
	}
	buf.WriteByte(']')
	writeKeyFirst(buf, "Then", &first)
	buf.WriteByte('[')
	for i, item := range v.Then {
		if i > 0 {
			buf.WriteByte(',')
		}
		if item == nil {
			buf.WriteString("null")
		} else {
			encodeStmt(buf, item, false)
		}
	}
	buf.WriteByte(']')
	writeKeyFirst(buf, "ThenLast", &first)
	buf.WriteByte('[')
	for i := range v.ThenLast {
		if i > 0 {
			buf.WriteByte(',')
		}
		encodeComment(buf, &v.ThenLast[i], false)
	}
	buf.WriteByte(']')
	writeKeyFirst(buf, "Else", &first)
	if v.Else == nil {
		buf.WriteString("null")
	} else {
		encodeIfClause(buf, v.Else, false)
	}
	writeKeyFirst(buf, "Last", &first)
	buf.WriteByte('[')
	for i := range v.Last {
		if i > 0 {
			buf.WriteByte(',')
		}
		encodeComment(buf, &v.Last[i], false)
	}
	buf.WriteByte(']')
	buf.WriteByte('}')
}

func encodeWhileClause(buf *bytes.Buffer, v *syntax.WhileClause, force bool) {
	writeNodeStart(buf, "WhileClause", v.Pos(), v.End(), force)
	first := false
	writeKeyFirst(buf, "WhilePos", &first)
	writePos(buf, v.WhilePos)
	writeKeyFirst(buf, "DoPos", &first)
	writePos(buf, v.DoPos)
	writeKeyFirst(buf, "DonePos", &first)
	writePos(buf, v.DonePos)
	writeKeyFirst(buf, "Until", &first)
	writeBool(buf, v.Until)
	writeKeyFirst(buf, "Cond", &first)
	buf.WriteByte('[')
	for i, item := range v.Cond {
		if i > 0 {
			buf.WriteByte(',')
		}
		if item == nil {
			buf.WriteString("null")
		} else {
			encodeStmt(buf, item, false)
		}
	}
	buf.WriteByte(']')
	writeKeyFirst(buf, "CondLast", &first)
	buf.WriteByte('[')
	for i := range v.CondLast {
		if i > 0 {
			buf.WriteByte(',')
		}
		encodeComment(buf, &v.CondLast[i], false)
	}
	buf.WriteByte(']')
	writeKeyFirst(buf, "Do", &first)
	buf.WriteByte('[')
	for i, item := range v.Do {
		if i > 0 {
			buf.WriteByte(',')
		}
		if item == nil {
			buf.WriteString("null")
		} else {
			encodeStmt(buf, item, false)
		}
	}
	buf.WriteByte(']')
	writeKeyFirst(buf, "DoLast", &first)
	buf.WriteByte('[')
	for i := range v.DoLast {
		if i > 0 {
			buf.WriteByte(',')
		}
		encodeComment(buf, &v.DoLast[i], false)
	}
	buf.WriteByte(']')
	buf.WriteByte('}')
}

func encodeForClause(buf *bytes.Buffer, v *syntax.ForClause, force bool) {
	writeNodeStart(buf, "ForClause", v.Pos(), v.End(), force)
	first := false
	writeKeyFirst(buf, "ForPos", &first)
	writePos(buf, v.ForPos)
	writeKeyFirst(buf, "DoPos", &first)
	writePos(buf, v.DoPos)
	writeKeyFirst(buf, "DonePos", &first)
	writePos(buf, v.DonePos)
	writeKeyFirst(buf, "Select", &first)
	writeBool(buf, v.Select)
	writeKeyFirst(buf, "Braces", &first)
	writeBool(buf, v.Braces)
	writeKeyFirst(buf, "Loop", &first)
	encodeLoop(buf, v.Loop, true)
	writeKeyFirst(buf, "Do", &first)
	buf.WriteByte('[')
	for i, item := range v.Do {
		if i > 0 {
			buf.WriteByte(',')
		}
		if item == nil {
			buf.WriteString("null")
		} else {
			encodeStmt(buf, item, false)
		}
	}
	buf.WriteByte(']')
	writeKeyFirst(buf, "DoLast", &first)
	buf.WriteByte('[')
	for i := range v.DoLast {
		if i > 0 {
			buf.WriteByte(',')
		}
		encodeComment(buf, &v.DoLast[i], false)
	}
	buf.WriteByte(']')
	buf.WriteByte('}')
}

func encodeWordIter(buf *bytes.Buffer, v *syntax.WordIter, force bool) {
	writeNodeStart(buf, "WordIter", v.Pos(), v.End(), force)
	first := false
	writeKeyFirst(buf, "Name", &first)
	if v.Name == nil {
		buf.WriteString("null")
	} else {
		encodeLit(buf, v.Name, false)
	}
	writeKeyFirst(buf, "InPos", &first)
	writePos(buf, v.InPos)
	writeKeyFirst(buf, "Items", &first)
	buf.WriteByte('[')
	for i, item := range v.Items {
		if i > 0 {
			buf.WriteByte(',')
		}
		if item == nil {
			buf.WriteString("null")
		} else {
			encodeWord(buf, item, false)
		}
	}
	buf.WriteByte(']')
	buf.WriteByte('}')
}

func encodeCStyleLoop(buf *bytes.Buffer, v *syntax.CStyleLoop, force bool) {
	writeNodeStart(buf, "CStyleLoop", v.Pos(), v.End(), force)
	first := false
	writeKeyFirst(buf, "Lparen", &first)
	writePos(buf, v.Lparen)
	writeKeyFirst(buf, "Rparen", &first)
	writePos(buf, v.Rparen)
	writeKeyFirst(buf, "Init", &first)
	encodeArithmExpr(buf, v.Init, true)
	writeKeyFirst(buf, "Cond", &first)
	encodeArithmExpr(buf, v.Cond, true)
	writeKeyFirst(buf, "Post", &first)
	encodeArithmExpr(buf, v.Post, true)
	buf.WriteByte('}')
}

func encodeBinaryCmd(buf *bytes.Buffer, v *syntax.BinaryCmd, force bool) {
	writeNodeStart(buf, "BinaryCmd", v.Pos(), v.End(), force)
	first := false
	writeKeyFirst(buf, "OpPos", &first)
	writePos(buf, v.OpPos)
	writeKeyFirst(buf, "Op", &first)
	writeUint(buf, uint64(v.Op))
	writeKeyFirst(buf, "X", &first)
	if v.X == nil {
		buf.WriteString("null")
	} else {
		encodeStmt(buf, v.X, false)
	}
	writeKeyFirst(buf, "Y", &first)
	if v.Y == nil {
		buf.WriteString("null")
	} else {
		encodeStmt(buf, v.Y, false)
	}
	buf.WriteByte('}')
}

func encodeFuncDecl(buf *bytes.Buffer, v *syntax.FuncDecl, force bool) {
	writeNodeStart(buf, "FuncDecl", v.Pos(), v.End(), force)
	first := false
	writeKeyFirst(buf, "Position", &first)
	writePos(buf, v.Position)
	writeKeyFirst(buf, "RsrvWord", &first)
	writeBool(buf, v.RsrvWord)
	writeKeyFirst(buf, "Parens", &first)
	writeBool(buf, v.Parens)
	writeKeyFirst(buf, "Name", &first)
	if v.Name == nil {
		buf.WriteString("null")
	} else {
		encodeLit(buf, v.Name, false)
	}
	writeKeyFirst(buf, "Names", &first)
	buf.WriteByte('[')
	for i, item := range v.Names {
		if i > 0 {
			buf.WriteByte(',')
		}
		if item == nil {
			buf.WriteString("null")
		} else {
			encodeLit(buf, item, false)
		}
	}
	buf.WriteByte(']')
	writeKeyFirst(buf, "Body", &first)
	if v.Body == nil {
		buf.WriteString("null")
	} else {
		encodeStmt(buf, v.Body, false)
	}
	buf.WriteByte('}')
}

func encodeWord(buf *bytes.Buffer, v *syntax.Word, force bool) {
	writeNodeStart(buf, "Word", v.Pos(), v.End(), force)
	first := false
	writeKeyFirst(buf, "Parts", &first)
	buf.WriteByte('[')
	for i, item := range v.Parts {
		if i > 0 {
			buf.WriteByte(',')
		}
		encodeWordPart(buf, item, true)
	}
	buf.WriteByte(']')
	buf.WriteByte('}')
}

func encodeLit(buf *bytes.Buffer, v *syntax.Lit, force bool) {
	writeNodeStart(buf, "Lit", v.Pos(), v.End(), force)
	first := false
	writeKeyFirst(buf, "ValuePos", &first)
	writePos(buf, v.ValuePos)
	writeKeyFirst(buf, "ValueEnd", &first)
	writePos(buf, v.ValueEnd)
	writeKeyFirst(buf, "Value", &first)
	writeString(buf, v.Value)
	buf.WriteByte('}')
}

func encodeSglQuoted(buf *bytes.Buffer, v *syntax.SglQuoted, force bool) {
	writeNodeStart(buf, "SglQuoted", v.Pos(), v.End(), force)
	first := false
	writeKeyFirst(buf, "Left", &first)
	writePos(buf, v.Left)
	writeKeyFirst(buf, "Right", &first)
	writePos(buf, v.Right)
	writeKeyFirst(buf, "Dollar", &first)
	writeBool(buf, v.Dollar)
	writeKeyFirst(buf, "Value", &first)
	writeString(buf, v.Value)
	buf.WriteByte('}')
}

func encodeDblQuoted(buf *bytes.Buffer, v *syntax.DblQuoted, force bool) {
	writeNodeStart(buf, "DblQuoted", v.Pos(), v.End(), force)
	first := false
	writeKeyFirst(buf, "Left", &first)
	writePos(buf, v.Left)
	writeKeyFirst(buf, "Right", &first)
	writePos(buf, v.Right)
	writeKeyFirst(buf, "Dollar", &first)
	writeBool(buf, v.Dollar)
	writeKeyFirst(buf, "Parts", &first)
	buf.WriteByte('[')
	for i, item := range v.Parts {
		if i > 0 {
			buf.WriteByte(',')
		}
		encodeWordPart(buf, item, true)
	}
	buf.WriteByte(']')
	buf.WriteByte('}')
}

func encodeCmdSubst(buf *bytes.Buffer, v *syntax.CmdSubst, force bool) {
	writeNodeStart(buf, "CmdSubst", v.Pos(), v.End(), force)
	first := false
	writeKeyFirst(buf, "Left", &first)
	writePos(buf, v.Left)
	writeKeyFirst(buf, "Right", &first)
	writePos(buf, v.Right)
	writeKeyFirst(buf, "Stmts", &first)
	buf.WriteByte('[')
	for i, item := range v.Stmts {
		if i > 0 {
			buf.WriteByte(',')
		}
		if item == nil {
			buf.WriteString("null")
		} else {
			encodeStmt(buf, item, false)
		}
	}
	buf.WriteByte(']')
	writeKeyFirst(buf, "Last", &first)
	buf.WriteByte('[')
	for i := range v.Last {
		if i > 0 {
			buf.WriteByte(',')
		}
		encodeComment(buf, &v.Last[i], false)
	}
	buf.WriteByte(']')
	writeKeyFirst(buf, "Backquotes", &first)
	writeBool(buf, v.Backquotes)
	writeKeyFirst(buf, "TempFile", &first)
	writeBool(buf, v.TempFile)
	writeKeyFirst(buf, "ReplyVar", &first)
	writeBool(buf, v.ReplyVar)
	buf.WriteByte('}')
}

func encodeParamExp(buf *bytes.Buffer, v *syntax.ParamExp, force bool) {
	writeNodeStart(buf, "ParamExp", v.Pos(), v.End(), force)
	first := false
	writeKeyFirst(buf, "Dollar", &first)
	writePos(buf, v.Dollar)
	writeKeyFirst(buf, "Rbrace", &first)
	writePos(buf, v.Rbrace)
	writeKeyFirst(buf, "Short", &first)
	writeBool(buf, v.Short)
	writeKeyFirst(buf, "Flags", &first)
	if v.Flags == nil {
		buf.WriteString("null")
	} else {
		encodeLit(buf, v.Flags, false)
	}
	writeKeyFirst(buf, "Excl", &first)
	writeBool(buf, v.Excl)
	writeKeyFirst(buf, "Length", &first)
	writeBool(buf, v.Length)
	writeKeyFirst(buf, "Width", &first)
	writeBool(buf, v.Width)
	writeKeyFirst(buf, "IsSet", &first)
	writeBool(buf, v.IsSet)
	writeKeyFirst(buf, "Param", &first)
	if v.Param == nil {
		buf.WriteString("null")
	} else {
		encodeLit(buf, v.Param, false)
	}
	writeKeyFirst(buf, "NestedParam", &first)
	encodeWordPart(buf, v.NestedParam, true)
	writeKeyFirst(buf, "Index", &first)
	encodeArithmExpr(buf, v.Index, true)
	writeKeyFirst(buf, "Modifiers", &first)
	buf.WriteByte('[')
	for i, item := range v.Modifiers {
		if i > 0 {
			buf.WriteByte(',')
		}
		if item == nil {
			buf.WriteString("null")
		} else {
			encodeLit(buf, item, false)
		}
	}
	buf.WriteByte(']')
	writeKeyFirst(buf, "Slice", &first)
	if v.Slice == nil {
		buf.WriteString("null")
	} else {
		encodeSlice(buf, v.Slice)
	}
	writeKeyFirst(buf, "Repl", &first)
	if v.Repl == nil {
		buf.WriteString("null")
	} else {
		encodeReplace(buf, v.Repl)
	}
	writeKeyFirst(buf, "Names", &first)
	writeUint(buf, uint64(v.Names))
	writeKeyFirst(buf, "Exp", &first)
	if v.Exp == nil {
		buf.WriteString("null")
	} else {
		encodeExpansion(buf, v.Exp)
	}
	buf.WriteByte('}')
}

func encodeSlice(buf *bytes.Buffer, v *syntax.Slice) {
	buf.WriteByte('{')
	first := true
	writeKeyFirst(buf, "Offset", &first)
	encodeArithmExpr(buf, v.Offset, true)
	writeKeyFirst(buf, "Length", &first)
	encodeArithmExpr(buf, v.Length, true)
	buf.WriteByte('}')
}

func encodeReplace(buf *bytes.Buffer, v *syntax.Replace) {
	buf.WriteByte('{')
	first := true
	writeKeyFirst(buf, "All", &first)
	writeBool(buf, v.All)
	writeKeyFirst(buf, "Orig", &first)
	if v.Orig == nil {
		buf.WriteString("null")
	} else {
		encodeWord(buf, v.Orig, false)
	}
	writeKeyFirst(buf, "With", &first)
	if v.With == nil {
		buf.WriteString("null")
	} else {
		encodeWord(buf, v.With, false)
	}
	buf.WriteByte('}')
}

func encodeExpansion(buf *bytes.Buffer, v *syntax.Expansion) {
	buf.WriteByte('{')
	first := true
	writeKeyFirst(buf, "Op", &first)
	writeUint(buf, uint64(v.Op))
	writeKeyFirst(buf, "Word", &first)
	if v.Word == nil {
		buf.WriteString("null")
	} else {
		encodeWord(buf, v.Word, false)
	}
	buf.WriteByte('}')
}

func encodeArithmExp(buf *bytes.Buffer, v *syntax.ArithmExp, force bool) {
	writeNodeStart(buf, "ArithmExp", v.Pos(), v.End(), force)
	first := false
	writeKeyFirst(buf, "Left", &first)
	writePos(buf, v.Left)
	writeKeyFirst(buf, "Right", &first)
	writePos(buf, v.Right)
	writeKeyFirst(buf, "Bracket", &first)
	writeBool(buf, v.Bracket)
	writeKeyFirst(buf, "Unsigned", &first)
	writeBool(buf, v.Unsigned)
	writeKeyFirst(buf, "X", &first)
	encodeArithmExpr(buf, v.X, true)
	buf.WriteByte('}')
}

func encodeArithmCmd(buf *bytes.Buffer, v *syntax.ArithmCmd, force bool) {
	writeNodeStart(buf, "ArithmCmd", v.Pos(), v.End(), force)
	first := false
	writeKeyFirst(buf, "Left", &first)
	writePos(buf, v.Left)
	writeKeyFirst(buf, "Right", &first)
	writePos(buf, v.Right)
	writeKeyFirst(buf, "Unsigned", &first)
	writeBool(buf, v.Unsigned)
	writeKeyFirst(buf, "X", &first)
	encodeArithmExpr(buf, v.X, true)
	buf.WriteByte('}')
}

func encodeBinaryArithm(buf *bytes.Buffer, v *syntax.BinaryArithm, force bool) {
	writeNodeStart(buf, "BinaryArithm", v.Pos(), v.End(), force)
	first := false
	writeKeyFirst(buf, "OpPos", &first)
	writePos(buf, v.OpPos)
	writeKeyFirst(buf, "Op", &first)
	writeUint(buf, uint64(v.Op))
	writeKeyFirst(buf, "X", &first)
	encodeArithmExpr(buf, v.X, true)
	writeKeyFirst(buf, "Y", &first)
	encodeArithmExpr(buf, v.Y, true)
	buf.WriteByte('}')
}

func encodeUnaryArithm(buf *bytes.Buffer, v *syntax.UnaryArithm, force bool) {
	writeNodeStart(buf, "UnaryArithm", v.Pos(), v.End(), force)
	first := false
	writeKeyFirst(buf, "OpPos", &first)
	writePos(buf, v.OpPos)
	writeKeyFirst(buf, "Op", &first)
	writeUint(buf, uint64(v.Op))
	writeKeyFirst(buf, "Post", &first)
	writeBool(buf, v.Post)
	writeKeyFirst(buf, "X", &first)
	encodeArithmExpr(buf, v.X, true)
	buf.WriteByte('}')
}

func encodeParenArithm(buf *bytes.Buffer, v *syntax.ParenArithm, force bool) {
	writeNodeStart(buf, "ParenArithm", v.Pos(), v.End(), force)
	first := false
	writeKeyFirst(buf, "Lparen", &first)
	writePos(buf, v.Lparen)
	writeKeyFirst(buf, "Rparen", &first)
	writePos(buf, v.Rparen)
	writeKeyFirst(buf, "X", &first)
	encodeArithmExpr(buf, v.X, true)
	buf.WriteByte('}')
}

func encodeFlagsArithm(buf *bytes.Buffer, v *syntax.FlagsArithm, force bool) {
	writeNodeStart(buf, "FlagsArithm", v.Pos(), v.End(), force)
	first := false
	writeKeyFirst(buf, "Flags", &first)
	if v.Flags == nil {
		buf.WriteString("null")
	} else {
		encodeLit(buf, v.Flags, false)
	}
	writeKeyFirst(buf, "X", &first)
	encodeArithmExpr(buf, v.X, true)
	buf.WriteByte('}')
}

func encodeCaseClause(buf *bytes.Buffer, v *syntax.CaseClause, force bool) {
	writeNodeStart(buf, "CaseClause", v.Pos(), v.End(), force)
	first := false
	writeKeyFirst(buf, "Case", &first)
	writePos(buf, v.Case)
	writeKeyFirst(buf, "In", &first)
	writePos(buf, v.In)
	writeKeyFirst(buf, "Esac", &first)
	writePos(buf, v.Esac)
	writeKeyFirst(buf, "Braces", &first)
	writeBool(buf, v.Braces)
	writeKeyFirst(buf, "Word", &first)
	if v.Word == nil {
		buf.WriteString("null")
	} else {
		encodeWord(buf, v.Word, false)
	}
	writeKeyFirst(buf, "Items", &first)
	buf.WriteByte('[')
	for i, item := range v.Items {
		if i > 0 {
			buf.WriteByte(',')
		}
		if item == nil {
			buf.WriteString("null")
		} else {
			encodeCaseItem(buf, item, false)
		}
	}
	buf.WriteByte(']')
	writeKeyFirst(buf, "Last", &first)
	buf.WriteByte('[')
	for i := range v.Last {
		if i > 0 {
			buf.WriteByte(',')
		}
		encodeComment(buf, &v.Last[i], false)
	}
	buf.WriteByte(']')
	buf.WriteByte('}')
}

func encodeCaseItem(buf *bytes.Buffer, v *syntax.CaseItem, force bool) {
	writeNodeStart(buf, "CaseItem", v.Pos(), v.End(), force)
	first := false
	writeKeyFirst(buf, "Op", &first)
	writeUint(buf, uint64(v.Op))
	writeKeyFirst(buf, "OpPos", &first)
	writePos(buf, v.OpPos)
	writeKeyFirst(buf, "Comments", &first)
	buf.WriteByte('[')
	for i := range v.Comments {
		if i > 0 {
			buf.WriteByte(',')
		}
		encodeComment(buf, &v.Comments[i], false)
	}
	buf.WriteByte(']')
	writeKeyFirst(buf, "Patterns", &first)
	buf.WriteByte('[')
	for i, item := range v.Patterns {
		if i > 0 {
			buf.WriteByte(',')
		}
		if item == nil {
			buf.WriteString("null")
		} else {
			encodeWord(buf, item, false)
		}
	}
	buf.WriteByte(']')
	writeKeyFirst(buf, "Stmts", &first)
	buf.WriteByte('[')
	for i, item := range v.Stmts {
		if i > 0 {
			buf.WriteByte(',')
		}
		if item == nil {
			buf.WriteString("null")
		} else {
			encodeStmt(buf, item, false)
		}
	}
	buf.WriteByte(']')
	writeKeyFirst(buf, "Last", &first)
	buf.WriteByte('[')
	for i := range v.Last {
		if i > 0 {
			buf.WriteByte(',')
		}
		encodeComment(buf, &v.Last[i], false)
	}
	buf.WriteByte(']')
	buf.WriteByte('}')
}

func encodeTestClause(buf *bytes.Buffer, v *syntax.TestClause, force bool) {
	writeNodeStart(buf, "TestClause", v.Pos(), v.End(), force)
	first := false
	writeKeyFirst(buf, "Left", &first)
	writePos(buf, v.Left)
	writeKeyFirst(buf, "Right", &first)
	writePos(buf, v.Right)
	writeKeyFirst(buf, "X", &first)
	encodeTestExpr(buf, v.X, true)
	buf.WriteByte('}')
}

func encodeBinaryTest(buf *bytes.Buffer, v *syntax.BinaryTest, force bool) {
	writeNodeStart(buf, "BinaryTest", v.Pos(), v.End(), force)
	first := false
	writeKeyFirst(buf, "OpPos", &first)
	writePos(buf, v.OpPos)
	writeKeyFirst(buf, "Op", &first)
	writeUint(buf, uint64(v.Op))
	writeKeyFirst(buf, "X", &first)
	encodeTestExpr(buf, v.X, true)
	writeKeyFirst(buf, "Y", &first)
	encodeTestExpr(buf, v.Y, true)
	buf.WriteByte('}')
}

func encodeUnaryTest(buf *bytes.Buffer, v *syntax.UnaryTest, force bool) {
	writeNodeStart(buf, "UnaryTest", v.Pos(), v.End(), force)
	first := false
	writeKeyFirst(buf, "OpPos", &first)
	writePos(buf, v.OpPos)
	writeKeyFirst(buf, "Op", &first)
	writeUint(buf, uint64(v.Op))
	writeKeyFirst(buf, "X", &first)
	encodeTestExpr(buf, v.X, true)
	buf.WriteByte('}')
}

func encodeParenTest(buf *bytes.Buffer, v *syntax.ParenTest, force bool) {
	writeNodeStart(buf, "ParenTest", v.Pos(), v.End(), force)
	first := false
	writeKeyFirst(buf, "Lparen", &first)
	writePos(buf, v.Lparen)
	writeKeyFirst(buf, "Rparen", &first)
	writePos(buf, v.Rparen)
	writeKeyFirst(buf, "X", &first)
	encodeTestExpr(buf, v.X, true)
	buf.WriteByte('}')
}

func encodeDeclClause(buf *bytes.Buffer, v *syntax.DeclClause, force bool) {
	writeNodeStart(buf, "DeclClause", v.Pos(), v.End(), force)
	first := false
	writeKeyFirst(buf, "Variant", &first)
	if v.Variant == nil {
		buf.WriteString("null")
	} else {
		encodeLit(buf, v.Variant, false)
	}
	writeKeyFirst(buf, "Args", &first)
	buf.WriteByte('[')
	for i, item := range v.Args {
		if i > 0 {
			buf.WriteByte(',')
		}
		if item == nil {
			buf.WriteString("null")
		} else {
			encodeAssign(buf, item, false)
		}
	}
	buf.WriteByte(']')
	buf.WriteByte('}')
}

func encodeArrayExpr(buf *bytes.Buffer, v *syntax.ArrayExpr, force bool) {
	writeNodeStart(buf, "ArrayExpr", v.Pos(), v.End(), force)
	first := false
	writeKeyFirst(buf, "Lparen", &first)
	writePos(buf, v.Lparen)
	writeKeyFirst(buf, "Rparen", &first)
	writePos(buf, v.Rparen)
	writeKeyFirst(buf, "Elems", &first)
	buf.WriteByte('[')
	for i, item := range v.Elems {
		if i > 0 {
			buf.WriteByte(',')
		}
		if item == nil {
			buf.WriteString("null")
		} else {
			encodeArrayElem(buf, item, false)
		}
	}
	buf.WriteByte(']')
	writeKeyFirst(buf, "Last", &first)
	buf.WriteByte('[')
	for i := range v.Last {
		if i > 0 {
			buf.WriteByte(',')
		}
		encodeComment(buf, &v.Last[i], false)
	}
	buf.WriteByte(']')
	buf.WriteByte('}')
}

func encodeArrayElem(buf *bytes.Buffer, v *syntax.ArrayElem, force bool) {
	writeNodeStart(buf, "ArrayElem", v.Pos(), v.End(), force)
	first := false
	writeKeyFirst(buf, "Index", &first)
	encodeArithmExpr(buf, v.Index, true)
	writeKeyFirst(buf, "Value", &first)
	if v.Value == nil {
		buf.WriteString("null")
	} else {
		encodeWord(buf, v.Value, false)
	}
	writeKeyFirst(buf, "Comments", &first)
	buf.WriteByte('[')
	for i := range v.Comments {
		if i > 0 {
			buf.WriteByte(',')
		}
		encodeComment(buf, &v.Comments[i], false)
	}
	buf.WriteByte(']')
	buf.WriteByte('}')
}

func encodeExtGlob(buf *bytes.Buffer, v *syntax.ExtGlob, force bool) {
	writeNodeStart(buf, "ExtGlob", v.Pos(), v.End(), force)
	first := false
	writeKeyFirst(buf, "OpPos", &first)
	writePos(buf, v.OpPos)
	writeKeyFirst(buf, "Op", &first)
	writeUint(buf, uint64(v.Op))
	writeKeyFirst(buf, "Pattern", &first)
	if v.Pattern == nil {
		buf.WriteString("null")
	} else {
		encodeLit(buf, v.Pattern, false)
	}
	buf.WriteByte('}')
}

func encodeProcSubst(buf *bytes.Buffer, v *syntax.ProcSubst, force bool) {
	writeNodeStart(buf, "ProcSubst", v.Pos(), v.End(), force)
	first := false
	writeKeyFirst(buf, "OpPos", &first)
	writePos(buf, v.OpPos)
	writeKeyFirst(buf, "Rparen", &first)
	writePos(buf, v.Rparen)
	writeKeyFirst(buf, "Op", &first)
	writeUint(buf, uint64(v.Op))
	writeKeyFirst(buf, "Stmts", &first)
	buf.WriteByte('[')
	for i, item := range v.Stmts {
		if i > 0 {
			buf.WriteByte(',')
		}
		if item == nil {
			buf.WriteString("null")
		} else {
			encodeStmt(buf, item, false)
		}
	}
	buf.WriteByte(']')
	writeKeyFirst(buf, "Last", &first)
	buf.WriteByte('[')
	for i := range v.Last {
		if i > 0 {
			buf.WriteByte(',')
		}
		encodeComment(buf, &v.Last[i], false)
	}
	buf.WriteByte(']')
	buf.WriteByte('}')
}

func encodeTimeClause(buf *bytes.Buffer, v *syntax.TimeClause, force bool) {
	writeNodeStart(buf, "TimeClause", v.Pos(), v.End(), force)
	first := false
	writeKeyFirst(buf, "Time", &first)
	writePos(buf, v.Time)
	writeKeyFirst(buf, "PosixFormat", &first)
	writeBool(buf, v.PosixFormat)
	writeKeyFirst(buf, "Stmt", &first)
	if v.Stmt == nil {
		buf.WriteString("null")
	} else {
		encodeStmt(buf, v.Stmt, false)
	}
	buf.WriteByte('}')
}

func encodeCoprocClause(buf *bytes.Buffer, v *syntax.CoprocClause, force bool) {
	writeNodeStart(buf, "CoprocClause", v.Pos(), v.End(), force)
	first := false
	writeKeyFirst(buf, "Coproc", &first)
	writePos(buf, v.Coproc)
	writeKeyFirst(buf, "Name", &first)
	if v.Name == nil {
		buf.WriteString("null")
	} else {
		encodeWord(buf, v.Name, false)
	}
	writeKeyFirst(buf, "Stmt", &first)
	if v.Stmt == nil {
		buf.WriteString("null")
	} else {
		encodeStmt(buf, v.Stmt, false)
	}
	buf.WriteByte('}')
}

func encodeLetClause(buf *bytes.Buffer, v *syntax.LetClause, force bool) {
	writeNodeStart(buf, "LetClause", v.Pos(), v.End(), force)
	first := false
	writeKeyFirst(buf, "Let", &first)
	writePos(buf, v.Let)
	writeKeyFirst(buf, "Exprs", &first)
	buf.WriteByte('[')
	for i, item := range v.Exprs {
		if i > 0 {
			buf.WriteByte(',')
		}
		encodeArithmExpr(buf, item, true)
	}
	buf.WriteByte(']')
	buf.WriteByte('}')
}

func encodeBraceExp(buf *bytes.Buffer, v *syntax.BraceExp, force bool) {
	writeNodeStart(buf, "BraceExp", v.Pos(), v.End(), force)
	first := false
	writeKeyFirst(buf, "Sequence", &first)
	writeBool(buf, v.Sequence)
	writeKeyFirst(buf, "Elems", &first)
	buf.WriteByte('[')
	for i, item := range v.Elems {
		if i > 0 {
			buf.WriteByte(',')
		}
		if item == nil {
			buf.WriteString("null")
		} else {
			encodeWord(buf, item, false)
		}
	}
	buf.WriteByte(']')
	buf.WriteByte('}')
}

func encodeTestDecl(buf *bytes.Buffer, v *syntax.TestDecl, force bool) {
	writeNodeStart(buf, "TestDecl", v.Pos(), v.End(), force)
	first := false
	writeKeyFirst(buf, "Position", &first)
	writePos(buf, v.Position)
	writeKeyFirst(buf, "Description", &first)
	if v.Description == nil {
		buf.WriteString("null")
	} else {
		encodeWord(buf, v.Description, false)
	}
	writeKeyFirst(buf, "Body", &first)
	if v.Body == nil {
		buf.WriteString("null")
	} else {
		encodeStmt(buf, v.Body, false)
	}
	buf.WriteByte('}')
}

func encodeCommand(buf *bytes.Buffer, v syntax.Command, force bool) {
	if v == nil {
		buf.WriteString("null")
		return
	}
	switch v := v.(type) {
	case *syntax.CallExpr:
		encodeCallExpr(buf, v, force)
	case *syntax.IfClause:
		encodeIfClause(buf, v, force)
	case *syntax.WhileClause:
		encodeWhileClause(buf, v, force)
	case *syntax.ForClause:
		encodeForClause(buf, v, force)
	case *syntax.CaseClause:
		encodeCaseClause(buf, v, force)
	case *syntax.Block:
		encodeBlock(buf, v, force)
	case *syntax.Subshell:
		encodeSubshell(buf, v, force)
	case *syntax.BinaryCmd:
		encodeBinaryCmd(buf, v, force)
	case *syntax.FuncDecl:
		encodeFuncDecl(buf, v, force)
	case *syntax.ArithmCmd:
		encodeArithmCmd(buf, v, force)
	case *syntax.TestClause:
		encodeTestClause(buf, v, force)
	case *syntax.DeclClause:
		encodeDeclClause(buf, v, force)
	case *syntax.LetClause:
		encodeLetClause(buf, v, force)
	case *syntax.TimeClause:
		encodeTimeClause(buf, v, force)
	case *syntax.CoprocClause:
		encodeCoprocClause(buf, v, force)
	case *syntax.TestDecl:
		encodeTestDecl(buf, v, force)
	default:
		buf.WriteString("null")
	}
}

func encodeWordPart(buf *bytes.Buffer, v syntax.WordPart, force bool) {
	if v == nil {
		buf.WriteString("null")
		return
	}
	switch v := v.(type) {
	case *syntax.Lit:
		encodeLit(buf, v, force)
	case *syntax.SglQuoted:
		encodeSglQuoted(buf, v, force)
	case *syntax.DblQuoted:
		encodeDblQuoted(buf, v, force)
	case *syntax.ParamExp:
		encodeParamExp(buf, v, force)
	case *syntax.CmdSubst:
		encodeCmdSubst(buf, v, force)
	case *syntax.ArithmExp:
		encodeArithmExp(buf, v, force)
	case *syntax.ProcSubst:
		encodeProcSubst(buf, v, force)
	case *syntax.ExtGlob:
		encodeExtGlob(buf, v, force)
	case *syntax.BraceExp:
		encodeBraceExp(buf, v, force)
	default:
		buf.WriteString("null")
	}
}

func encodeLoop(buf *bytes.Buffer, v syntax.Loop, force bool) {
	if v == nil {
		buf.WriteString("null")
		return
	}
	switch v := v.(type) {
	case *syntax.WordIter:
		encodeWordIter(buf, v, force)
	case *syntax.CStyleLoop:
		encodeCStyleLoop(buf, v, force)
	default:
		buf.WriteString("null")
	}
}

func encodeArithmExpr(buf *bytes.Buffer, v syntax.ArithmExpr, force bool) {
	if v == nil {
		buf.WriteString("null")
		return
	}
	switch v := v.(type) {
	case *syntax.BinaryArithm:
		encodeBinaryArithm(buf, v, force)
	case *syntax.UnaryArithm:
		encodeUnaryArithm(buf, v, force)
	case *syntax.ParenArithm:
		encodeParenArithm(buf, v, force)
	case *syntax.FlagsArithm:
		encodeFlagsArithm(buf, v, force)
	case *syntax.Word:
		encodeWord(buf, v, force)
	default:
		buf.WriteString("null")
	}
}

func encodeTestExpr(buf *bytes.Buffer, v syntax.TestExpr, force bool) {
	if v == nil {
		buf.WriteString("null")
		return
	}
	switch v := v.(type) {
	case *syntax.BinaryTest:
		encodeBinaryTest(buf, v, force)
	case *syntax.UnaryTest:
		encodeUnaryTest(buf, v, force)
	case *syntax.ParenTest:
		encodeParenTest(buf, v, force)
	case *syntax.Word:
		encodeWord(buf, v, force)
	default:
		buf.WriteString("null")
	}
}

// EncodeNode writes node as typed JSON.
func EncodeNode(w io.Writer, node syntax.Node) error {
	var buf bytes.Buffer
	switch node := node.(type) {
	case *syntax.File:
		encodeFile(&buf, node, true)
	case *syntax.Comment:
		encodeComment(&buf, node, true)
	case *syntax.Stmt:
		encodeStmt(&buf, node, true)
	case *syntax.Assign:
		encodeAssign(&buf, node, true)
	case *syntax.Redirect:
		encodeRedirect(&buf, node, true)
	case *syntax.CallExpr:
		encodeCallExpr(&buf, node, true)
	case *syntax.Subshell:
		encodeSubshell(&buf, node, true)
	case *syntax.Block:
		encodeBlock(&buf, node, true)
	case *syntax.IfClause:
		encodeIfClause(&buf, node, true)
	case *syntax.WhileClause:
		encodeWhileClause(&buf, node, true)
	case *syntax.ForClause:
		encodeForClause(&buf, node, true)
	case *syntax.WordIter:
		encodeWordIter(&buf, node, true)
	case *syntax.CStyleLoop:
		encodeCStyleLoop(&buf, node, true)
	case *syntax.BinaryCmd:
		encodeBinaryCmd(&buf, node, true)
	case *syntax.FuncDecl:
		encodeFuncDecl(&buf, node, true)
	case *syntax.Word:
		encodeWord(&buf, node, true)
	case *syntax.Lit:
		encodeLit(&buf, node, true)
	case *syntax.SglQuoted:
		encodeSglQuoted(&buf, node, true)
	case *syntax.DblQuoted:
		encodeDblQuoted(&buf, node, true)
	case *syntax.CmdSubst:
		encodeCmdSubst(&buf, node, true)
	case *syntax.ParamExp:
		encodeParamExp(&buf, node, true)
	case *syntax.ArithmExp:
		encodeArithmExp(&buf, node, true)
	case *syntax.ArithmCmd:
		encodeArithmCmd(&buf, node, true)
	case *syntax.BinaryArithm:
		encodeBinaryArithm(&buf, node, true)
	case *syntax.UnaryArithm:
		encodeUnaryArithm(&buf, node, true)
	case *syntax.ParenArithm:
		encodeParenArithm(&buf, node, true)
	case *syntax.FlagsArithm:
		encodeFlagsArithm(&buf, node, true)
	case *syntax.CaseClause:
		encodeCaseClause(&buf, node, true)
	case *syntax.CaseItem:
		encodeCaseItem(&buf, node, true)
	case *syntax.TestClause:
		encodeTestClause(&buf, node, true)
	case *syntax.BinaryTest:
		encodeBinaryTest(&buf, node, true)
	case *syntax.UnaryTest:
		encodeUnaryTest(&buf, node, true)
	case *syntax.ParenTest:
		encodeParenTest(&buf, node, true)
	case *syntax.DeclClause:
		encodeDeclClause(&buf, node, true)
	case *syntax.ArrayExpr:
		encodeArrayExpr(&buf, node, true)
	case *syntax.ArrayElem:
		encodeArrayElem(&buf, node, true)
	case *syntax.ExtGlob:
		encodeExtGlob(&buf, node, true)
	case *syntax.ProcSubst:
		encodeProcSubst(&buf, node, true)
	case *syntax.TimeClause:
		encodeTimeClause(&buf, node, true)
	case *syntax.CoprocClause:
		encodeCoprocClause(&buf, node, true)
	case *syntax.LetClause:
		encodeLetClause(&buf, node, true)
	case *syntax.BraceExp:
		encodeBraceExp(&buf, node, true)
	case *syntax.TestDecl:
		encodeTestDecl(&buf, node, true)
	default:
		buf.WriteString("null")
	}
	_, err := w.Write(buf.Bytes())
	return err
}
