---
"sh-syntax": patch
---

Use a generated binary wire for AST transport, removing the JSON parser and `encoding/json` from the WASM path.
