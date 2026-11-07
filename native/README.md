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

Validation observed on Linux x64 (Go 1.27.3, Node 26):

- AST parity: 11/11 parseable fixtures matched the WASM AST
- `install.sh` parse: native ~141ms vs WASM ~247ms (including JSON parsing)
- 50,000 `parse('echo hi')` calls: RSS +14MB native vs multi-GB/OOM on the current leaking-WASM sync path

These numbers are a spike, not a release guarantee.
