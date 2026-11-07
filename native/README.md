# Native addon validation

This directory is a feasibility spike for the native-first direction in #146. It is not published and not wired into the package yet.

- Go: `native/shsyntax.go` builds a `c-shared` library exposing `sh_syntax_parse`/`sh_syntax_free`.
- N-API: `native/linux-x64-gnu/binding.cc` wraps the C ABI.
- Package name (validation only): `@ungo/sh-syntax-binding-linux-x64-gnu`.

Build on Linux x64 with Go, Node.js headers, and a C/C++ toolchain:

```sh
go build -buildmode=c-shared -o build/libshsyntax.so native/shsyntax.go
cd native/linux-x64-gnu
node-gyp rebuild
LD_LIBRARY_PATH=../../build npm test
```

On systems without `make`, the validation was also built with Zig:

```sh
CC="zig cc" go build -buildmode=c-shared -o build/libshsyntax.so native/shsyntax.go
zig c++ -shared -fPIC -I"$NODE_HEADERS/include/node" \
  native/linux-x64-gnu/binding.cc -Lbuild -lshsyntax \
  -Wl,-rpath,"$PWD/build" -o native/linux-x64-gnu/build/Release/sh_syntax_binding.node
```

Run the comparison with:

```sh
CGO_ENABLED=0 go build -trimpath -o native/sh-syntax-native ./native/cli
node native/benchmark.mjs
```

Validation observed on Linux x64 (Go 1.27.3, Node 26, latest run):

| case | N-API addon | WASM | CLI + spawnSync | CLI daemon (async) |
|---|---:|---:|---:|---:|
| `echo hi` | <0.1ms | 2.6ms | 4.1ms | 0.2ms |
| `install.sh` (140KB) | 145ms | 154ms | 189ms | 121ms |

- AST parity: 11/11 parseable fixtures matched the WASM AST
- 50,000 `parse('echo hi')` calls: RSS +14MB for the addon vs multi-GB/OOM on the current leaking-WASM sync path

Memory growth for repeated synchronous `parse('echo hi')` calls (separate processes, `global.gc()` between measurements):

| calls | N-API addon RSS delta | WASM RSS delta | daemon parent + child |
|---:|---:|---:|---:|
| 2,000 | +6.3MB | +452.2MB | +10.8MB |
| 5,000 | +7.0MB | +1,097.6MB | +11.7MB |
| 10,000 | +7.0MB | +2,156.8MB | +15.9MB |
| 50,000 | +11.9MB | OOM | +16.1MB |

The N-API addon plateaus because Go's GC reclaims the temporary ASTs. The daemon column is the Node parent plus the native child RSS; both are stable. The current leaking-WASM sync path retains one instance per call until the event loop yields, so it grows linearly.

The CLI daemon is the persistent esbuild-style case: one long-lived child process and a line-delimited JSON protocol. It is measured asynchronously here; a synchronous API would need an additional worker + `Atomics.wait` bridge. The pure `spawnSync` case is the conservative one-process-per-call upper bound. These numbers are a spike, not a release guarantee.
