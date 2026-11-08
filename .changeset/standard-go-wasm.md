---
'sh-syntax': patch
---

Build WASM with standard Go instead of TinyGo. The standard Go GC removes the
`-gc=leaking` memory growth that made long-running synchronous parsing unsafe. The
binary is larger; a fresh runtime has higher startup cost, although async reuse amortizes it.
`wasm-opt -Oz` is used to trim the final artifact. The async processor now reuses one Go runtime and serializes
calls, so it no longer pays WASM instantiation cost per call. That runtime retains the Go heap
high-water mark for the processor lifetime; memory stays bounded but does not shrink after a
large parse. The internal
`process` ABI changed, so `main.wasm` must match the package version.
