/* eslint-disable @typescript-eslint/restrict-plus-operands */
import fs from 'fs'
import { createRequire } from 'module'
import path from 'path'
import { fileURLToPath } from 'url'

import './shim.js'
import { ShOptions } from './types.js'

/* istanbul ignore next */
const cjsRequire =
  typeof require === 'undefined' ? createRequire(import.meta.url) : require

cjsRequire('../vendors/wasm_exec.cjs')

/* istanbul ignore next */
const _dirname =
  typeof __dirname === 'undefined'
    ? path.dirname(fileURLToPath(import.meta.url))
    : __dirname

let wasmFile: Buffer | undefined

let id = 0

export const print = async (
  text: string,
  {
    filepath,
    keepComments = true,
    stopAt,
    variant,

    useTabs = false,
    tabWidth = 2,
    indent = useTabs ? 0 : tabWidth,
    binaryNextLine = true,
    switchCaseIndent = true,
    spaceRedirects = true,
    keepPadding = false,
    minify = false,
    functionNextLine = false,
  }: Partial<ShOptions> = {},
) => {
  if (!wasmFile) {
    wasmFile = await fs.promises.readFile(
      path.resolve(_dirname, '../main.wasm'),
    )
  }

  const go = new Go()

  const uid = id++

  const argv = [
    'js',
    '-uid=' + uid,
    '-text=' + text,
    '-keepComments=' + keepComments,
    '-indent=' + indent,
    '-binaryNextLine=' + binaryNextLine,
    '-switchCaseIndent=' + switchCaseIndent,
    '-spaceRedirects=' + spaceRedirects,
    '-keepPadding=' + keepPadding,
    '-minify=' + minify,
    '-functionNextLine=' + functionNextLine,
  ]

  if (filepath != null) {
    argv.push('-filepath=' + filepath)
  }

  if (stopAt != null) {
    argv.push('-stopAt=' + stopAt)
  }

  if (variant != null) {
    argv.push('-variant=' + variant)
  }

  go.argv = argv

  const result = await WebAssembly.instantiate(wasmFile, go.importObject)

  const wasm = result.instance

  await go.run(wasm)

  const processed = Go.__shProcessing[uid]

  delete Go.__shProcessing[uid]

  if ('error' in processed) {
    throw new Error(processed.error)
  }

  return processed.text
}

export * from './types.js'
