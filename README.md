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
    - [browser](#browser)
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
import { parse, print } from 'sh-syntax'

const text = "echo 'Hello World!'"
const ast = await parse(text)

// print() formats source text; printing an edited AST is a planned follow-up.
const formatted = await print(text)

// Compatibility: print(ast, { originalText }) is accepted, but the AST is
// ignored and originalText is formatted.
const legacyFormatted = await print(ast, { originalText: text })
```

The synchronous API is available as `parseSync` and `printSync`:

```js
import { parseSync, printSync } from 'sh-syntax'

const ast = parseSync("echo 'Hello World!'")
const formatted = printSync("echo 'Hello World!'")
```

#### syntax tree

`parse` returns the complete shell syntax tree as plain, JSON-friendly data.
Every node has a `type` plus `start`/`end` byte offsets, and fields use
lowerCamelCase. Position fields are `{ offset, line, column }` data:

```js
import { LangVariant, parseSync, walk } from 'sh-syntax'

const ast = parseSync("echo 'Hello World!'", {
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
expose `offset`, `line` (1-based), and `column` (0-based). `walk` passes the nearest enclosing node, the field that reached it, and the
array index; `parent`, `prop`, and `index` are null when absent. Returning
`false` from `enter` skips a node's children, while `false` from `exit`
stops the walk.

#### browser

```js
import { getProcessor } from 'sh-syntax'

// choose your own way to load the WASM file

// with `fetch`
const processor = getProcessor(() =>
  fetch('http://cdn.jsdelivr.net/npm/sh-syntax@latest/main.wasm'),
)

// with `wasm?init` via `vite`
import initWasm from 'sh-syntax/wasm?init'
const processor = getProcessor(initWasm)

const parse = (text, options) => processor(text, options)

const print = (text, options) =>
  processor(text, {
    ...options,
    print: true,
  })

// just like node again
const text = "echo 'Hello World!'"
const ast = await parse(text)
console.log(ast.stmts[0].cmd)
const formatted = await print(text)
```

## Benchmark

```console
clk: ~3.03 GHz
cpu: Apple M1 Max
runtime: node 26.12.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
sh-syntax                     18.35 ms/iter  20.02 ms               █
                      (14.59 ms … 22.44 ms)  22.20 ms ▇▇   ▂  ▇▂▂▇ ▂█▂ ▂  ▂
                    ( 94.64 kb … 608.02 kb) 577.27 kb ██▆▆▁█▁▁████▆███▁█▁▁█
                  4.26 ipc (  0.57% stalls)    NaN% L1 data cache
         58.65M cycles 249.90M instructions   0.00% retired LD/ST (   0.00)

sh-syntax (sync)              18.70 ms/iter  20.53 ms                █  ██
                      (14.52 ms … 21.81 ms)  21.48 ms █ █   ███   ██ █ ████
                    (598.83 kb … 692.00 kb) 603.65 kb █▁█▁█▁███████████████
                  4.23 ipc (  0.55% stalls)    NaN% L1 data cache
         58.66M cycles 248.24M instructions   0.00% retired LD/ST (   0.00)

sh-syntax (synckit)           18.48 ms/iter  19.62 ms         ▂ ▂   █     ▂
                      (15.49 ms … 20.98 ms)  20.57 ms   ▅    ▅█ █▅ ▅█▅  ▅▅█
                    (291.08 kb …   1.48 mb) 325.51 kb ▇▇█▇▁▁▇██▁██▇███▇▇███
                  2.80 ipc (  9.87% stalls)    NaN% L1 data cache
        497.94k cycles   1.39M instructions   0.00% retired LD/ST (   0.00)

mvdan-sh                      67.72 ms/iter  65.80 ms     █
                      (61.50 ms … 88.60 ms)  82.67 ms █ █ █
                    (  4.46 mb …  22.87 mb)  16.25 mb █████▁█▁▁▁▁▁▁▁▁▁▁▁▁▁█
                  5.38 ipc (  1.20% stalls)    NaN% L1 data cache
        210.36M cycles   1.13G instructions   0.00% retired LD/ST (   0.00)

summary
  sh-syntax
   1.01x faster than sh-syntax (synckit)
   1.02x faster than sh-syntax (sync)
   3.69x faster than mvdan-sh
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
[MIT]: http://opensource.org/licenses/MIT
