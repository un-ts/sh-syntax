// Command gen-ast generates the Go encoder/decoder and the TypeScript AST
// types/operators from the mvdan.cc/sh syntax node definitions.
package main

import (
	"bytes"
	"fmt"
	"go/ast"
	"go/format"
	"go/parser"
	"go/token"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
)

type field struct {
	name string
	typ  string
}

type typeInfo struct {
	fields []field
	isNode bool
}

var interfaceMethods = map[string]string{
	"Command":    "commandNode",
	"WordPart":   "wordPartNode",
	"Loop":       "loopNode",
	"ArithmExpr": "arithmExprNode",
	"TestExpr":   "testExprNode",
}

func main() {
	file, moduleDir := parseNodes()
	structs, order, implementors := collectTypes(file)
	markNodeTypes(structs, implementors)
	allTypes := typeOrder(order)
	interfaces := interfaceImplementations(implementors)
	operators := loadOperators(moduleDir)

	var buf bytes.Buffer
	writeEncoder(&buf, structs, allTypes, interfaces)
	var decBuf bytes.Buffer
	writeDecoder(&decBuf, structs, allTypes, interfaces)
	writeTypes(structs, order, interfaces, operators)
	writeOperators(operators)

	formatted, err := format.Source(buf.Bytes())
	if err != nil {
		fatalf("format generated source: %v", err)
	}
	if err := os.WriteFile("processor/encode_generated.go", formatted, 0o644); err != nil {
		fatalf("write encoder: %v", err)
	}
	formattedDecoder, err := format.Source(decBuf.Bytes())
	if err != nil {
		fatalf("format generated decoder: %v", err)
	}
	if err := os.WriteFile("processor/decode_generated.go", formattedDecoder, 0o644); err != nil {
		fatalf("write decoder: %v", err)
	}
}

func goCommand() string {
	name := "go"
	if runtime.GOOS == "windows" {
		name += ".exe"
	}
	return filepath.Join(runtime.GOROOT(), "bin", name)
}

func parseNodes() (*ast.File, string) {
	goBin := goCommand()
	if err := exec.Command(goBin, "mod", "download", "mvdan.cc/sh/v3").Run(); err != nil {
		fatalf("download mvdan.cc/sh/v3: %v", err)
	}
	moduleDir, err := exec.Command(goBin, "list", "-m", "-f", "{{.Dir}}", "mvdan.cc/sh/v3").Output()
	if err != nil {
		fatalf("locate mvdan.cc/sh/v3: %v", err)
	}
	dir := strings.TrimSpace(string(moduleDir))
	if dir == "" {
		fatalf("mvdan.cc/sh/v3 has no module directory")
	}
	nodesPath := filepath.Join(dir, "syntax", "nodes.go")

	fset := token.NewFileSet()
	file, err := parser.ParseFile(fset, nodesPath, nil, 0)
	if err != nil {
		fatalf("parse %s: %v", nodesPath, err)
	}
	return file, dir
}

func collectTypes(file *ast.File) (map[string]*typeInfo, []string, map[string][]string) {
	structs := make(map[string]*typeInfo)
	var order []string
	implementors := make(map[string][]string)

	for _, decl := range file.Decls {
		switch decl := decl.(type) {
		case *ast.GenDecl:
			collectGenDecl(decl, structs, &order)
		case *ast.FuncDecl:
			collectFuncDecl(decl, structs, implementors)
		}
	}

	return structs, order, implementors
}

func collectGenDecl(decl *ast.GenDecl, structs map[string]*typeInfo, order *[]string) {
	if decl.Tok != token.TYPE {
		return
	}
	for _, spec := range decl.Specs {
		ts, ok := spec.(*ast.TypeSpec)
		if !ok {
			continue
		}
		typ, ok := ts.Type.(*ast.StructType)
		if !ok {
			continue
		}
		info := &typeInfo{}
		for _, f := range typ.Fields.List {
			fieldType := typeString(f.Type)
			for _, name := range f.Names {
				info.fields = append(info.fields, field{name.Name, fieldType})
			}
		}
		structs[ts.Name.Name] = info
		*order = append(*order, ts.Name.Name)
	}
}

func collectFuncDecl(decl *ast.FuncDecl, structs map[string]*typeInfo, implementors map[string][]string) {
	if decl.Recv == nil {
		return
	}
	recv := receiverName(decl.Recv.List[0].Type)
	if recv == "" {
		return
	}
	implementors[decl.Name.Name] = append(implementors[decl.Name.Name], recv)
}

func markNodeTypes(structs map[string]*typeInfo, implementors map[string][]string) {
	for _, method := range []string{"Pos", "End"} {
		for _, impl := range implementors[method] {
			if info := structs[impl]; info != nil {
				info.isNode = true
			}
		}
	}
}

func typeOrder(order []string) []string {
	allTypes := make([]string, 0, len(order))
	for _, name := range order {
		if name != "Pos" {
			allTypes = append(allTypes, name)
		}
	}
	return allTypes
}

func interfaceImplementations(implementors map[string][]string) map[string][]string {
	interfaces := make(map[string][]string)
	for name, method := range interfaceMethods {
		interfaces[name] = implementors[method]
	}
	return interfaces
}

func typeString(expr ast.Expr) string {
	switch expr := expr.(type) {
	case *ast.Ident:
		return expr.Name
	case *ast.StarExpr:
		return "*" + typeString(expr.X)
	case *ast.ArrayType:
		return "[]" + typeString(expr.Elt)
	case *ast.SelectorExpr:
		return typeString(expr.X) + "." + expr.Sel.Name
	default:
		panic(fmt.Sprintf("unsupported type %T", expr))
	}
}

func receiverName(expr ast.Expr) string {
	if star, ok := expr.(*ast.StarExpr); ok {
		return typeString(star.X)
	}
	return typeString(expr)
}

func jsName(name string) string {
	switch name {
	case "Last":
		return "lastComments"
	case "CondLast":
		return "condComments"
	case "ThenLast":
		return "thenComments"
	case "DoLast":
		return "doComments"
	default:
		return strings.ToLower(name[:1]) + name[1:]
	}
}

func fatalf(format string, args ...any) {
	fmt.Fprintf(os.Stderr, format+"\n", args...)
	os.Exit(1)
}
