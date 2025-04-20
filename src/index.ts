import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import './shim.js'
import '../vendors/wasm_exec.cjs'

import { getProcessor } from './processor.js'
import type { File, ShOptions, ShPrintOptions } from './types.js'

/* istanbul ignore next -- @preserve */
const _dirname = import.meta.url
  ? path.dirname(fileURLToPath(import.meta.url))
  : __dirname

export const processor = getProcessor(() =>
  fs.readFile(path.resolve(_dirname, '../main.wasm')),
)

export const parse = (text: string, options?: ShOptions) =>
  processor(text, options)

export function print(text: string, options?: ShOptions): Promise<string>
export function print(ast: File, options?: ShPrintOptions): Promise<string>
export function print(
  textOrAst: File | string,
  options?: ShOptions & {
    originalText?: string
  },
) {
  if (typeof textOrAst === 'string') {
    return processor(textOrAst, {
      ...options,
      print: true,
    })
  }
  return processor(textOrAst, options as ShPrintOptions)
}

export * from './processor.js'
export * from './types.js'
