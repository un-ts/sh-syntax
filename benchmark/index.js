// @ts-check

/* eslint-disable @babel/new-cap */

import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

import { baseline, bench, run } from 'mitata'
import sh from 'mvdan-sh'

import { print } from '../lib/index.js'

/**
 * @typedef {import('../lib').ShOptions} ShOptions
 * @typedef {import('mvdan-sh').LangVariant} LangVariant
 */

const keepComments = true
/**
 * @type {LangVariant}
 */
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

/**
 * @type {ShOptions}
 */
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

baseline('sh-syntax', () => print(text, shOptions))

bench('mvdan-sh', () => {
  const { syntax } = sh
  syntax
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

await run({
  colors: !['1', 'true'].includes(
    /** @type {string} */ (process.env.NO_COLOR?.toLowerCase()),
  ),
})
