---
"sh-syntax": patch
---

Make the JS AST wire encoder/decoder and `walk()` iterative, removing the JS call-stack ceiling for deeply nested syntax trees. The remaining Go/WASM printer and transport depth limit is tracked in #188.
