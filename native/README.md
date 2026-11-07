# Native addon validation

This directory is a feasibility spike for the native-first direction in #146. It is not published and not wired into the package yet.

- Go: `native/shsyntax.go` builds a `c-shared` library exposing `sh_syntax_parse` / `sh_syntax_print` / `sh_syntax_free`.
- N-API: `native/linux-x64-gnu/binding.cc` wraps the C ABI and exports `parse` and `print`.
- Package name (validation only): `@ungo/sh-syntax-binding-linux-x64-gnu`.

WASM is deliberately excluded from the performance matrix. It is only used to validate that native `parse` and `print(text)` produce the same result.

## Build

On Linux x64 with Go, Node.js headers, and a C/C++ toolchain:

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

## API parity

`native/validate.mjs` compares native output with the WASM implementation:

- AST: 11/11 parseable fixtures
- `print(text)`: 11/11 fixtures

WASM is not benchmarked because it is the fallback path, not the performance target.

## Native performance

Latest run on Linux x64, Go 1.27.3, Node 26:

| case | N-API addon | CLI + spawnSync | CLI daemon (async) |
|---|---:|---:|---:|
| `echo hi` | <0.1ms | 4.1ms | 0.2ms |
| `install.sh` (140KB) | 145ms | 189ms | 121ms |

The daemon is the persistent esbuild-style case: one long-lived child process and a line-delimited JSON protocol. It is async here; a synchronous API would need an additional worker + `Atomics.wait` bridge. The `spawnSync` case is the conservative one-process-per-call upper bound.

Memory growth for repeated synchronous `parse('echo hi')` calls, measured in isolated processes:

| calls | N-API addon RSS delta | daemon parent + child |
|---:|---:|---:|
| 2,000 | +6.3MB | +10.8MB |
| 5,000 | +7.0MB | +11.7MB |
| 10,000 | +7.0MB | +15.9MB |
| 50,000 | +11.9MB | +16.1MB |

Both native paths plateau; the addon avoids the extra process.

## `print(ast)` and the patch fast path

The generated non-reflective decoder makes full-AST `printAst` correct, but serializing the whole tree is not the performance path. The POC adds:

- `parseHandle(text)` → native AST handle + JS AST
- shared-prototype `BaseNode.patch('value', value)` (POC covers `Lit.value`)
- `printHandle(handle)` → native printer without JSON serialization

Latest `install.sh` print benchmark:

| path | time |
|---|---:|
| full `printAst(JSON.stringify(ast))` | 1494ms |
| `patch('value') + print(handle)` | 4.4ms |

`native/patch.mjs` decorates the returned AST with a shared prototype; node mutations are sent as `(handle, start, end, field, value)` and applied directly to the Go AST. This is a POC: only `Lit.value` is supported, and the daemon patch adapter is not implemented yet.

The native API can diverge from the WASM API here; the priority is the native parse/print performance path, not API symmetry.
