# sh-syntax

[![GitHub Actions Workflow Status](https://img.shields.io/github/actions/workflow/status/un-ts/sh-syntax/ci.yml?branch=main)](https://github.com/un-ts/sh-syntax/actions/workflows/ci.yml?query=branch%3Amain)
[![Codecov](https://img.shields.io/codecov/c/github/un-ts/sh-syntax.svg)](https://codecov.io/gh/un-ts/sh-syntax)
[![type-coverage](https://img.shields.io/badge/dynamic/json.svg?label=type-coverage&prefix=%E2%89%A5&suffix=%&query=$.typeCoverage.atLeast&uri=https%3A%2F%2Fraw.githubusercontent.com%2Fun-ts%2Fsh-syntax%2Fmain%2Fpackage.json)](https://github.com/plantain-00/type-coverage)
[![CodeRabbit Pull Request Reviews](https://img.shields.io/coderabbit/prs/github/un-ts/sh-syntax)](https://coderabbit.ai)
[![npm](https://img.shields.io/npm/v/sh-syntax.svg)](https://www.npmjs.com/package/sh-syntax)
[![GitHub Release](https://img.shields.io/github/release/un-ts/sh-syntax)](https://github.com/un-ts/sh-syntax/releases)

[![Conventional Commits](https://img.shields.io/badge/conventional%20commits-1.0.0-yellow.svg)](https://conventionalcommits.org)
[![Renovate enabled](https://img.shields.io/badge/renovate-enabled-brightgreen.svg)](https://renovatebot.com)
[![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)
[![Code Style: Prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg)](https://github.com/prettier/prettier)
[![changesets](https://img.shields.io/badge/maintained%20with-changesets-176de3.svg)](https://github.com/changesets/changesets)

A WASM shell parser and formatter with bash support, based on [mvdan/sh](https://github.com/mvdan/sh)

## TOC <!-- omit in toc -->

- [Usage](#usage)
  - [Install](#install)
  - [API](#api)
    - [node](#node)
    - [syntax tree](#syntax-tree)
    - [source offsets](#source-offsets)
    - [browser](#browser)
    - [workerd](#workerd)
- [Benchmark](#benchmark)
- [Sponsors](#sponsors)
- [Backers](#backers)
- [Changelog](#changelog)
- [License](#license)

## Usage

### Install

```sh
# yarn
yarn add sh-syntax

# npm
npm i sh-syntax
```

### API

#### node

```js
import { init, parse, print, splitBraces } from 'sh-syntax'

// Optional: load and initialize the WASM runtime up front.
await init()

const text = "echo 'Hello World!'"
const ast = await parse(text)

// print() formats source text.
const formatted = await print(text)

// print(node) prints the current tree or any subtree, including edits.
// It serializes the tree to Go and decodes it before printing. For large
// files, the originalText path below is much faster.
const printedAst = await print(ast)
const printedStmt = await print(ast.stmts[0])
// File output ends with a newline; subtree output does not.

// Split brace expressions into BraceExp parts for analysis.
// `changed` can be true even when no BraceExp is produced ({x}, unterminated braces).
// Split literals have no source positions; BraceExp bounds may use retained children.
// The printer rejects BraceExp trees.
const braceAst = await parse('echo {a,b}')
const { word: splitWord, changed } = await splitBraces(braceAst.stmts[0].cmd.args[1])

// originalText still selects the source-text fast path.
const formattedSource = await print(ast, { originalText: text })
```

Errors expose stable codes via `ErrorCode`: `SH_SYNTAX_PARSE`, `SH_SYNTAX_LANGUAGE`, `SH_SYNTAX_INPUT`, `SH_SYNTAX_PRINT`, and `SH_SYNTAX_SPLIT_BRACES`. `name` distinguishes `ParseError`, `InputError`, and the shared `ShSyntaxError`; use `code` for language/print/split failures.

Source text input is a JavaScript string. Unpaired UTF-16 surrogates are replaced with U+FFFD by `TextEncoder`, and byte input such as `Uint8Array` is not accepted.

The synchronous Node API is available from `sh-syntax/sync`:

```js
import { parse, print } from 'sh-syntax/sync'

const ast = parse("echo 'Hello World!'")
const formatted = print("echo 'Hello World!'")
const printedAst = print(ast)
```

#### syntax tree

`parse` returns the complete shell syntax tree as plain, JSON-friendly data.
Every node has a `type` plus `start`/`end` byte offsets, and fields use
lowerCamelCase. Field values are raw shell source text, so the printer re-emits them verbatim; setting `Lit.value` to `a b` prints two words. Position fields are `{ offset, line, column }` data:

```js
import { LangVariant, parse, walk } from 'sh-syntax'

const ast = await parse("echo 'Hello World!'", {
  keepComments: true,
  variant: LangVariant.LangBash,
  filepath: 'script.sh',
})

// A function visitor is the enter phase.
walk(ast, (node, parent, prop, index) => {
  if (node.type === 'Lit') {
    console.log(node.value)
  }
})

// An object visitor can pair enter and exit; exit is required.
walk(ast, {
  enter(node, parent, prop, index) {
    // ...
  },
  exit(node, parent, prop, index) {
    // ...
  },
})

const command = ast.stmts[0].cmd
if (command?.type === 'CallExpr') {
  console.log(command.args[0].start) // 0
}
```

Node `start`/`end` and position fields use UTF-8 byte offsets; position fields
expose `offset`, `line` (1-based), and `column` (0-based). `walk` passes the
nearest enclosing node, the key in the nearest enclosing object (which may be a
non-node wrapper), and the array index; `parent`, `prop`, and `index` are null
when absent. Returning `false` from `enter` skips a node's children, while
`false` from `exit` stops the walk.

#### source offsets

AST offsets are UTF-8 byte offsets, while JavaScript strings use UTF-16 code
units. Build a converter once for the source text:

```js
import { createSourceIndex, parse } from 'sh-syntax'

const text = 'echo "héllo 🎉" $var\n'
const sourceIndex = createSourceIndex(text)
const ast = await parse(text)

const word = ast.stmts[0].cmd.args.at(-1)
const start = sourceIndex(word.start)
const end = sourceIndex(word.end)

console.log(text.slice(start, end)) // $var
```

Offsets inside a multi-byte character map to the start of that character, and
offsets outside the source are clamped to its bounds.

#### browser

The browser entry uses the same `init()` and async API as Node. The entry has no
top-level await, so importing it never blocks; call `init()` once when
convenient, or let the first `parse`/`print` call initialize the runtime:

```js
import { init, parse, print } from 'sh-syntax'

await init()

const text = "echo 'Hello World!'"
const ast = await parse(text)
const formatted = await print(text)
```

The bundler must emit `main.wasm` as an asset (for example, Vite handles
`new URL('../main.wasm', import.meta.url)`); Vite library mode instead inlines
`new URL()` assets as base64, so libraries should supply their own loader:

```js
import { getProcessor } from 'sh-syntax'

const processor = getProcessor(() =>
  fetch('https://cdn.jsdelivr.net/npm/sh-syntax@latest/main.wasm'),
)
```

The sync entry is also available in browsers as `sh-syntax/sync`; unlike the
async entry it uses top-level await to fetch and compile `main.wasm` before
exposing synchronous `parse`/`print`. The bundler must support TLA and emit the
WASM asset; the same Vite library-mode caveat applies. There is no sync variant
on workerd.

#### workerd

The `workerd` export imports the bundled `main.wasm` as a compiled module, so
Worker code does not call `getProcessor` or fetch the asset:

```js
import { init, parse } from 'sh-syntax'

export default {
  async fetch() {
    await init()
    return new Response(JSON.stringify(await parse("echo 'Hello World!'")))
  },
}
```

Call `init()` inside the request handler: Go startup uses
`crypto.getRandomValues`, which Workers disallow outside a request context.

Wrangler and `@cloudflare/vite-plugin` already resolve `.wasm` imports as
`WebAssembly.Module`. Other bundlers must do the same for the workerd entry;
a URL or instantiated module is not sufficient. Nitro's `unwasm` turns a
plain `.wasm` import into instantiated exports, so it needs a loader that
returns a `WebAssembly.Module`.

For TypeScript Worker builds, select the runtime declaration:

```json
{ "compilerOptions": { "customConditions": ["workerd"] } }
```

## Benchmark

`sh-ast` is another WASM binding of the same upstream `mvdan/sh` parser with a Go-shaped AST. Its numbers include its AST transport, so this table is not a comparison of different parsers.

```console
clk: ~3.13 GHz
cpu: Apple M1 Max
runtime: node 26.12.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
sh-syntax                     17.78 ms/iter  18.92 ms       █      █
                      (14.26 ms … 20.82 ms)  20.43 ms    ▂  █   ▇▇▇█ ▂▇  ▂
                    (602.83 kb …   6.63 mb) 881.69 kb ▆▁▁█▆▁█▁▆▆████▆██▁▆█▆
                  4.35 ipc (  0.62% stalls)    NaN% L1 data cache
         57.03M cycles 248.32M instructions   0.00% retired LD/ST (   0.00)

sh-syntax (sync)              17.84 ms/iter  19.13 ms                █
                      (14.50 ms … 20.91 ms)  20.89 ms    ▇ ▂  ▂▂ ▇▇ ▂█   ▂▂
                    (600.70 kb … 627.55 kb) 602.24 kb ▆▆▆█▆█▆▆██▆██▆██▁▁▁██
                  4.34 ipc (  0.61% stalls)    NaN% L1 data cache
         56.56M cycles 245.67M instructions   0.00% retired LD/ST (   0.00)

sh-syntax (synckit)           17.79 ms/iter  18.82 ms    ▃       █
                      (14.29 ms … 21.75 ms)  21.23 ms ▂  █ ▂▂▂ ▇▂█▇ ▂  ▂
                    (291.08 kb …   1.00 mb) 311.42 kb █▁▁█▁███▆████▆█▆▁█▆▆▆
                  3.04 ipc ( 10.66% stalls)    NaN% L1 data cache
        421.63k cycles   1.28M instructions   0.00% retired LD/ST (   0.00)

mvdan-sh                      68.27 ms/iter  67.40 ms   █   █
                      (62.97 ms … 89.92 ms)  71.86 ms ▅▅█   █ ▅▅▅       ▅ ▅
                    (  8.90 mb …  20.51 mb)  15.16 mb ███▁▁▁█▁███▁▁▁▁▁▁▁█▁█
                  5.32 ipc (  1.20% stalls)    NaN% L1 data cache
        212.73M cycles   1.13G instructions   0.00% retired LD/ST (   0.00)

summary
  sh-syntax
   1x faster than sh-syntax (synckit)
   1x faster than sh-syntax (sync)
   3.84x faster than mvdan-sh

------------------------------------------- -------------------------------
parse (async)                 28.59 ms/iter  30.49 ms █                █
                      (25.07 ms … 32.14 ms)  31.63 ms █ █       █   █ ██
                    ( 14.13 mb …  14.93 mb)  14.26 mb ████▁▁▁▁▁▁█▁▁██████▁█
                  5.04 ipc (  0.92% stalls)    NaN% L1 data cache
         92.15M cycles 464.53M instructions   0.00% retired LD/ST (   0.00)

sh-ast (parse)                68.76 ms/iter  72.58 ms   █               █
                      (63.01 ms … 82.75 ms)  73.90 ms ▅▅█▅▅   ▅      ▅  █ ▅
                    ( 16.61 mb …  16.61 mb)  16.61 mb █████▁▁▁█▁▁▁▁▁▁█▁▁█▁█
                  4.41 ipc (  0.58% stalls)    NaN% L1 data cache
        220.13M cycles 971.45M instructions   0.00% retired LD/ST (   0.00)

sh-ast (print ast)           582.44 ms/iter 618.61 ms █ █ █   █ ██    █████
                    (503.81 ms … 635.59 ms) 633.77 ms █ █ █   █ ██    █████
                    ( 35.07 mb …  61.68 mb)  45.47 mb █▁█▁█▁▁▁█▁██▁▁▁▁█████
                  4.82 ipc (  0.44% stalls)    NaN% L1 data cache
          1.83G cycles   8.84G instructions   0.00% retired LD/ST (   0.00)

parse (sync)                  29.16 ms/iter  30.10 ms              ▂█
                      (25.16 ms … 32.71 ms)  32.02 ms ▅           ▅██
                    ( 14.13 mb …  14.14 mb)  14.14 mb █▁▁▇▇▁▇▁▁▁▇▁███▇▇▁▇▁▇
                  5.05 ipc (  0.91% stalls)    NaN% L1 data cache
         93.10M cycles 470.45M instructions   0.00% retired LD/ST (   0.00)

print(ast) (async)            30.85 ms/iter  32.70 ms ██             █ ███
                      (27.10 ms … 33.68 ms)  33.47 ms ██▅   ▅▅       █▅███▅
                    (  2.39 mb …   2.40 mb)   2.39 mb ███▁▁▁██▁▁▁▁▁▁▁██████
                  4.76 ipc (  0.60% stalls)    NaN% L1 data cache
        104.48M cycles 497.79M instructions   0.00% retired LD/ST (   0.00)

print(ast) (sync)             29.44 ms/iter  31.76 ms █
                      (25.97 ms … 33.14 ms)  32.77 ms █               ▂▇  ▂
                    (  2.39 mb …   2.39 mb)   2.39 mb █▆▆▁▁▁▆▁▆▁▁▁▁▆▆▆██▁▁█
                  4.93 ipc (  0.63% stalls)    NaN% L1 data cache
         96.15M cycles 474.21M instructions   0.00% retired LD/ST (   0.00)

summary
  parse (async)
   1.02x faster than parse (sync)
   1.03x faster than print(ast) (sync)
   1.08x faster than print(ast) (async)
   2.4x faster than sh-ast (parse)
   20.37x faster than sh-ast (print ast)
```

See [benchmark](./benchmark/benchmark.txt) for more details.

You can try it with running `node benchmark` by yourself. [Here](./benchmark/index.js) is the benchmark source code.

## Sponsors and Backers

[![Sponsors and Backers](https://raw.githubusercontent.com/1stG/static/master/sponsors.svg)](https://github.com/sponsors/JounQin)

### Sponsors

| 1stG                                                                                                                   | RxTS                                                                                                                   | UnTS                                                                                                                   |
| ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| [![1stG Open Collective sponsors](https://opencollective.com/1stG/organizations.svg)](https://opencollective.com/1stG) | [![RxTS Open Collective sponsors](https://opencollective.com/rxts/organizations.svg)](https://opencollective.com/rxts) | [![UnTS Open Collective sponsors](https://opencollective.com/unts/organizations.svg)](https://opencollective.com/unts) |

### Backers

| 1stG                                                                                                                | RxTS                                                                                                                | UnTS                                                                                                                |
| ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| [![1stG Open Collective backers](https://opencollective.com/1stG/individuals.svg)](https://opencollective.com/1stG) | [![RxTS Open Collective backers](https://opencollective.com/rxts/individuals.svg)](https://opencollective.com/rxts) | [![UnTS Open Collective backers](https://opencollective.com/unts/individuals.svg)](https://opencollective.com/unts) |

## Changelog

Detailed changes for each release are documented in [CHANGELOG.md](./CHANGELOG.md).

## License

[MIT][] © [JounQin][]@[1stG.me][]

[1stG.me]: https://www.1stg.me
[JounQin]: https://github.com/JounQin
[MIT]: https://opensource.org/licenses/MIT
