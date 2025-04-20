// @ts-check

import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

import { bench, run, summary } from 'mitata'
import sh from 'mvdan-sh'
import { createSyncFn } from 'synckit'

import { print } from '../lib/index.js'

/** @import { ShOptions } from 'sh-syntax' */

const keepComments = true

const variant = 0 // LangVariant.LangBash

const indent = 2
const binaryNextLine = true
const switchCaseIndent = true
const spaceRedirects = true
const keepPadding = false
const minify = false
const functionNextLine = false

const filePath = fileURLToPath(
  new URL('../test/fixtures/install.sh', import.meta.url),
)

const text = fs.readFileSync(filePath, 'utf8')

/** @type {ShOptions} */
const shOptions = {
  keepComments,
  variant,

  indent,
  binaryNextLine,
  switchCaseIndent,
  spaceRedirects,
  keepPadding,
  minify,
  functionNextLine,
}

/** @type {(text: string, options?: ShOptions) => string} */
const printSync = createSyncFn(new URL('worker.mjs', import.meta.url))

summary(() => {
  bench('sh-syntax', () => print(text, shOptions)).baseline()

  bench('sh-syntax (synckit)', () => printSync(text, shOptions))

  bench('mvdan-sh', () => {
    const { syntax } = sh
    return syntax
      .NewPrinter(
        syntax.Indent(indent),
        syntax.BinaryNextLine(binaryNextLine),
        syntax.SwitchCaseIndent(switchCaseIndent),
        syntax.SpaceRedirects(spaceRedirects),
        syntax.KeepPadding(keepPadding),
        syntax.Minify(minify),
        syntax.FunctionNextLine(functionNextLine),
      )
      .Print(
        syntax
          .NewParser(syntax.KeepComments(keepComments), syntax.Variant(variant))
          .Parse(text, filePath),
      )
  })
})

await run({
  colors: !['1', 'true'].includes(
    /** @type {string} */ (process.env.NO_COLOR?.toLowerCase()),
  ),
})
