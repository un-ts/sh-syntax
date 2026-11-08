---
'sh-syntax': patch
---

Build the WASM fallback with standard Go instead of TinyGo. Standard Go's GC avoids the
`-gc=leaking` memory growth that made long-running synchronous parsing unsafe; the
WASM binary is larger and startup is slower.
