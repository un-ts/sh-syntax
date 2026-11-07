---
"sh-syntax": minor
---

Return the full shell syntax tree and keep printing source text.

### Breaking changes

- The AST is no longer Go-shaped. Fields are lowerCamelCase and node
  positions are explicit: use `node.type`, `start`/`end`, and
  `{ offset, line, column }` objects instead of `Pos`/`End`, `Stmts`,
  `Cmd`, `Parts`, `Value`, and the other Go field names.
- `ParseError` / `IParseError` fields are renamed from Go style:
  `Filename` → `filename`, `Incomplete` → `incomplete`, `Text` → `text`,
  and `Pos` → `pos`.
- Operator-valued fields (`op`) now use the upstream numeric enum values instead
  of display strings. Typed constants such as `RedirOperator`,
  `CaseOperator`, `ProcOperator`, and `BinAritOperator` are exported.
- `Word.Lit` is gone; use `parts`. `File.Last` is now `lastComments`.
- `print(ast)` without `originalText` is no longer supported and throws a
  `TypeError`. Printing an edited AST is deferred to a follow-up; the AST is
  currently a parse result, not a second input format.

### Features

- `parse()` now returns every node and field from `mvdan.cc/sh`'s syntax
  package instead of only positions. The tree is plain JSON-compatible data:
  every node has `type`, `start`, and `end`; fields use lowerCamelCase; and
  position fields are `{ offset, line, column }` objects.
- Add a `walk()` helper for the typed tree; use `node.type` instead of a
  node-type helper.
- Public AST types are a discriminated union: `BaseNode` plus literal
  `type` fields, with `Node`, `Command`, `WordPart`, `Loop`,
  `ArithmExpr`, and `TestExpr` unions so `node.type` narrows in TypeScript.
- `print()` continues to format source text. `print(ast, { originalText })`
  and `processor(ast, { originalText })` remain accepted for tooling
  compatibility, but the AST is deliberately ignored and `originalText` is
  formatted.
- `getProcessor()` caches the compiled WebAssembly module, uses
  `compileStreaming()` for `Response` inputs when available, and instantiates a
  fresh runtime per call.
- Add `parseSync()` and `printSync()` for synchronous consumers, plus
  `getProcessorSync()` for preloaded WASM bytes or a synchronous loader.
- Positions recovered by `recoverErrors` now expose `recovered: true`.
