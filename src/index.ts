import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import './shim.js'
import '../vendors/wasm_exec.js'
import { getProcessor } from './processor.js'
import type { File, ShOptions } from './types.js'

/* istanbul ignore next */
const _dirname =
  typeof __dirname === 'undefined'
    ? path.dirname(fileURLToPath(import.meta.url))
    : __dirname

export const processor = getProcessor(() =>
  fs.promises.readFile(path.resolve(_dirname, '../main.wasm')),
)

export const parse = async (text: string, options?: ShOptions) =>
  processor(text, options)

export const print = async (ast: File, options?: ShOptions) =>
  processor(ast, options)

export * from './processor.js'
export * from './types.js'
