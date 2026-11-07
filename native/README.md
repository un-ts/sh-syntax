# Native addon validation

This directory is a feasibility spike for the native-first direction in #146. It is not published and not wired into the package yet.

- Go: `native/shsyntax.go` builds a `c-shared` library exposing `sh_syntax_parse`/`sh_syntax_free`.
- N-API: `native/linux-x64-gnu/binding.cc` wraps the C ABI.
- Package name (validation only): `@ungo/sh-syntax-binding-linux-x64-gnu`.

Build on a Linux x64 host with Go, Node.js headers, and a C++ toolchain:

```sh
go build -buildmode=c-shared -o build/libshsyntax.so native/shsyntax.go
cd native/linux-x64-gnu
node-gyp rebuild
npm test
```

The validation compares AST output, parse latency, and synchronous memory behavior with the WASM path before we decide on the distribution matrix.
