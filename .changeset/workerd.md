---
"sh-syntax": patch
---

Add a dedicated `workerd` entry that imports the bundled `main.wasm` as a compiled module and exports the same async `init` / `parse` / `print` API. `getProcessor` now also accepts a compiled `WebAssembly.Module`.
