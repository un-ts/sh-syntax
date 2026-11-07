---
"sh-syntax": minor
---

Return the full shell syntax tree and keep printing source text.

- `parse()` now returns every node and field from `mvdan.cc/sh`'s syntax
  package instead of only positions. The tree is plain JSON-compatible data:
  every node has `type`, `start`, and `end`; fields use lowerCamelCase; and
  position fields are `{ offset, line, column }` objects.
- Add `NodeType()` and `Walk()` helpers for the typed tree.
- `print()` continues to format source text. `print(ast, { originalText })`
  remains accepted for compatibility, but the AST is deliberately ignored and
  `originalText` is formatted. Printing an edited AST is deferred to a
  follow-up; the AST is currently a parse result, not a second input format.
- Add `parseSync()` and `printSync()` for synchronous consumers, plus
  `createSyncProcessor()` for preloaded WASM.
