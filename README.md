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

```js
// node
import { parse, print } from 'sh-syntax'

const text = "echo 'Hello World!'"
const ast = await parse(text)
const newText = await print(ast, {
  // `originalText` is required for now, hope we will find better solution later
  originalText: text,
})
```

```js
// browser
import { getProcessor } from 'sh-syntax'

const processor = getProcessor(() =>
  fetch('sh-syntax/main.wasm').then(res => res.arrayBuffer()),
)

const parse = (text, options) => processor(text, options)

const print = (textOrAst, options) => {
  if (typeof textOrAst === 'string') {
    return processor(textOrAst, {
      ...options,
      print: true,
    })
  }
  return processor(textOrAst, options)
}

// just like node again
const text = "echo 'Hello World!'"
const ast = await parse(text)
const newText = await print(ast, { originalText: text })
```

## Benchmark

```console
clk: ~3.10 GHz
cpu: Apple M1 Max
runtime: node 18.20.8 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
sh-syntax                     36.97 ms/iter  37.32 ms     █
                      (36.50 ms … 37.53 ms)  37.38 ms █   █              ██
                    (601.05 kb … 711.16 kb) 641.13 kb █▁▁██▁▁▁█▁▁██▁█▁▁▁▁██
                  4.88 ipc (  0.63% stalls)  99.64% L1 data cache
        118.27M cycles 577.63M instructions  38.24% retired LD/ST (220.90M)

sh-syntax (synckit)           37.13 ms/iter  37.04 ms      █
                      (36.69 ms … 38.15 ms)  38.05 ms ▅ ▅  █
                    (291.31 kb …   4.70 mb) 553.03 kb █▇█▇▇█▁▇▁▁▁▁▁▁▁▁▇▁▁▁▇
                  1.04 ipc ( 11.15% stalls)  38.89% L1 data cache
        406.85k cycles 423.12k instructions  20.01% retired LD/ST ( 84.65k)

mvdan-sh                      78.00 ms/iter  74.63 ms     █
                     (70.44 ms … 127.50 ms)  78.25 ms     █  █
                    (  1.11 mb …   9.87 mb)   7.88 mb █▁▁▁█▁▁██▁███▁▁▁▁▁▁▁█
                  5.18 ipc (  1.02% stalls)  99.05% L1 data cache
        244.60M cycles   1.27G instructions  34.47% retired LD/ST (436.51M)

summary
  sh-syntax
   1x faster than sh-syntax (synckit)
   2.11x faster than mvdan-sh
```

See [benchmark](./benchmark/benchmark.txt) for more details.

You can try it with running `node benchmark` by yourself. [Here](./benchmark/index.js) is the benchmark source code.

[![Sponsors](https://raw.githubusercontent.com/1stG/static/master/sponsors.svg)](https://github.com/sponsors/JounQin)

## Sponsors

| 1stG                                                                                                                   | RxTS                                                                                                                   | UnTS                                                                                                                   |
| ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| [![1stG Open Collective sponsors](https://opencollective.com/1stG/organizations.svg)](https://opencollective.com/1stG) | [![RxTS Open Collective sponsors](https://opencollective.com/rxts/organizations.svg)](https://opencollective.com/rxts) | [![UnTS Open Collective sponsors](https://opencollective.com/unts/organizations.svg)](https://opencollective.com/unts) |

## Backers

| 1stG                                                                                                                | RxTS                                                                                                                | UnTS                                                                                                                |
| ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| [![1stG Open Collective backers](https://opencollective.com/1stG/individuals.svg)](https://opencollective.com/1stG) | [![RxTS Open Collective backers](https://opencollective.com/rxts/individuals.svg)](https://opencollective.com/rxts) | [![UnTS Open Collective backers](https://opencollective.com/unts/individuals.svg)](https://opencollective.com/unts) |

## Changelog

Detailed changes for each release are documented in [CHANGELOG.md](./CHANGELOG.md).

## License

[MIT][] © [JounQin][]@[1stG.me][]

[1stG.me]: https://www.1stg.me
[JounQin]: https://GitHub.com/JounQin
[MIT]: http://opensource.org/licenses/MIT
