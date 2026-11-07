---
"sh-syntax": minor
---

Return the full shell syntax tree and print parsed trees directly.

- `parse()` now returns every node and field from `mvdan.cc/sh`'s syntax
  package instead of only positions. The tree is plain JSON-compatible data:
  every node has `__type`, interface nodes have `Type`, and positions are
  `{ Offset, Line, Col }` objects.
- Add `NodeType()` and `Walk()` helpers for the typed tree.
- `print()` prints the parsed tree directly, so AST edits are reflected in the
  output. Passing source text as `originalText` together with an AST is
  rejected; use `print(text)` for the unmodified-source fast path.
- Add `parseSync()` and `printSync()` for synchronous consumers, plus
  `createSyncProcessor()` for preloaded WASM.
