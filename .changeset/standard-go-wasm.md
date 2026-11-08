---
'sh-syntax': patch
---

Build WASM with standard Go instead of TinyGo. The standard Go GC removes the
`-gc=leaking` memory growth that made long-running synchronous parsing unsafe. The
binary is larger and both startup and steady-state throughput are slower. The internal
`process` ABI changed, so `main.wasm` must match the package version.
