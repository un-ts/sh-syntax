---
'sh-syntax': patch
---

Build WASM with standard Go instead of TinyGo. The standard Go GC removes the
`-gc=leaking` memory growth that made long-running synchronous parsing unsafe. The
binary is larger and both startup and steady-state throughput are slower; `wasm-opt -Oz`
is used to trim the final artifact. The async processor now reuses one Go runtime and serializes
calls, so it no longer pays WASM instantiation cost per call. The internal
`process` ABI changed, so `main.wasm` must match the package version.
