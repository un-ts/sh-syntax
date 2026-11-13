// @ts-check

import fs from 'node:fs'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

import { bench, run, summary } from 'mitata'
import sh from 'mvdan-sh'
import { LangVariant, parse, print } from 'sh-syntax'
import { parse as parseSync, print as printSync } from 'sh-syntax/sync'
import { createSyncFn } from 'synckit'

/** @import {ShOptions} from 'sh-syntax' */

const keepComments = true

const shVariant = LangVariant.LangBash
const mvdanVariant = 0 // mvdan-sh's LangBash

const indent = 2
const binaryNextLine = true
const switchCaseIndent = true
const spaceRedirects = true
const keepPadding = false
const minify = false
const functionNextLine = false

const filePath = fileURLToPath(new URL('../test/fixtures/install.sh', import.meta.url))

const text = fs.readFileSync(filePath, 'utf8')

/** @type {ShOptions} */
const shOptions = {
  keepComments,
  variant: shVariant,

  indent,
  binaryNextLine,
  switchCaseIndent,
  spaceRedirects,
  keepPadding,
  minify,
  functionNextLine,
}

const ast = await parse(text, shOptions)

/** @type {(text: string, options?: ShOptions) => string} */
const synckitPrint = createSyncFn(new URL('worker.mjs', import.meta.url))

summary(() => {
  bench('sh-syntax', () => print(text, shOptions)).baseline()

  bench('parse (async)', () => parse(text, shOptions))

  bench('parse (sync)', () => parseSync(text, shOptions))

  bench('print(ast) (async)', () => print(ast, shOptions))

  bench('print(ast) (sync)', () => printSync(ast, shOptions))

  bench('sh-syntax (sync)', () => printSync(text, shOptions))

  bench('sh-syntax (synckit)', () => synckitPrint(text, shOptions))

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
          .NewParser(syntax.KeepComments(keepComments), syntax.Variant(mvdanVariant))
          .Parse(text, filePath),
      )
  })
})

await run({
  colors: !['1', 'true'].includes(/** @type {string} */ (process.env.NO_COLOR?.toLowerCase())),
})
