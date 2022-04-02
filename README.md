# sh-syntax

[![GitHub Actions](https://github.com/rx-ts/sh-syntax/workflows/CI/badge.svg)](https://github.com/rx-ts/sh-syntax/actions/workflows/ci.yml)
[![Codecov](https://img.shields.io/codecov/c/github/rx-ts/sh-syntax.svg)](https://codecov.io/gh/rx-ts/sh-syntax)
[![Codacy Grade](https://img.shields.io/codacy/grade/1d00ac27c99d4412bb70211e258706ab)](https://app.codacy.com/gh/rx-ts/sh-syntax)
[![type-coverage](https://img.shields.io/badge/dynamic/json.svg?label=type-coverage&prefix=%E2%89%A5&suffix=%&query=$.typeCoverage.atLeast&uri=https%3A%2F%2Fraw.githubusercontent.com%2Frx-ts%2Fsh-syntax%2Fmain%2Fpackage.json)](https://github.com/plantain-00/type-coverage)
[![npm](https://img.shields.io/npm/v/sh-syntax.svg)](https://www.npmjs.com/package/sh-syntax)
[![GitHub Release](https://img.shields.io/github/release/rx-ts/sh-syntax)](https://github.com/rx-ts/sh-syntax/releases)

[![David Peer](https://img.shields.io/david/peer/rx-ts/sh-syntax.svg)](https://david-dm.org/rx-ts/sh-syntax?type=peer)
[![David](https://img.shields.io/david/rx-ts/sh-syntax.svg)](https://david-dm.org/rx-ts/sh-syntax)
[![David Dev](https://img.shields.io/david/dev/rx-ts/sh-syntax.svg)](https://david-dm.org/rx-ts/sh-syntax?type=dev)

[![Conventional Commits](https://img.shields.io/badge/conventional%20commits-1.0.0-yellow.svg)](https://conventionalcommits.org)
[![Renovate enabled](https://img.shields.io/badge/renovate-enabled-brightgreen.svg)](https://renovatebot.com)
[![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)
[![Code Style: Prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg)](https://github.com/prettier/prettier)
[![changesets](https://img.shields.io/badge/maintained%20with-changesets-176de3.svg)](https://github.com/atlassian/changesets)

A WASM shell parser and formatter with bash support, based on mvdan/sh

## TOC <!-- omit in toc -->

- [Usage](#usage)
  - [Install](#install)
  - [API](#api)
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
import { print } from 'sh-syntax'

await print("echo 'Hello World!'")
```

```js
// browser
import { getPrinter } from 'sh-syntax'

const print = getPrinter(() =>
  fetch('path/to/main.wasm').then(res => res.arrayBuffer()),
)
await print("echo 'Hello World!'")
```

## Changelog

Detailed changes for each release are documented in [CHANGELOG.md](./CHANGELOG.md).

## License

[MIT][] © [JounQin][]@[1stG.me][]

[1stg.me]: https://www.1stg.me
[jounqin]: https://GitHub.com/JounQin
[mit]: http://opensource.org/licenses/MIT
