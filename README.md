# sh-syntax

[![GitHub Actions](https://github.com/un-ts/sh-syntax/workflows/CI/badge.svg)](https://github.com/un-ts/sh-syntax/actions/workflows/ci.yml)
[![Codecov](https://img.shields.io/codecov/c/github/un-ts/sh-syntax.svg)](https://codecov.io/gh/un-ts/sh-syntax)
[![Language grade: JavaScript](https://img.shields.io/lgtm/grade/javascript/g/un-ts/sh-syntax.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/un-ts/sh-syntax/context:javascript)
[![type-coverage](https://img.shields.io/badge/dynamic/json.svg?label=type-coverage&prefix=%E2%89%A5&suffix=%&query=$.typeCoverage.atLeast&uri=https%3A%2F%2Fraw.githubusercontent.com%2Fun-ts%2Fsh-syntax%2Fmain%2Fpackage.json)](https://github.com/plantain-00/type-coverage)
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

## Sponsors

| 1stG                                                                                                                               | RxTS                                                                                                                               | UnTS                                                                                                                               |
| ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| [![1stG Open Collective backers and sponsors](https://opencollective.com/1stG/organizations.svg)](https://opencollective.com/1stG) | [![RxTS Open Collective backers and sponsors](https://opencollective.com/rxts/organizations.svg)](https://opencollective.com/rxts) | [![UnTS Open Collective backers and sponsors](https://opencollective.com/unts/organizations.svg)](https://opencollective.com/unts) |

## Backers

| 1stG                                                                                                                             | RxTS                                                                                                                             | UnTS                                                                                                                             |
| -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| [![1stG Open Collective backers and sponsors](https://opencollective.com/1stG/individuals.svg)](https://opencollective.com/1stG) | [![RxTS Open Collective backers and sponsors](https://opencollective.com/rxts/individuals.svg)](https://opencollective.com/rxts) | [![UnTS Open Collective backers and sponsors](https://opencollective.com/unts/individuals.svg)](https://opencollective.com/unts) |

## Changelog

Detailed changes for each release are documented in [CHANGELOG.md](./CHANGELOG.md).

## License

[MIT][] © [JounQin][]@[1stG.me][]

[1stg.me]: https://www.1stg.me
[jounqin]: https://GitHub.com/JounQin
[mit]: http://opensource.org/licenses/MIT
