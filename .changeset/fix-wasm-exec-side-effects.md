---
"sh-syntax": patch
---

Keep the vendored Go runtime in bundled builds by pointing `sideEffects` at
`vendors/wasm_exec.cjs` instead of the renamed `vendors/wasm_exec.js`.
