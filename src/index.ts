import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import { getPrinter } from './print.js'

import './shim.js'
import '../vendors/wasm_exec.js'

/* istanbul ignore next */
const _dirname =
  typeof __dirname === 'undefined'
    ? path.dirname(fileURLToPath(import.meta.url))
    : __dirname

export const print = getPrinter(() =>
  fs.promises.readFile(path.resolve(_dirname, '../main.wasm')),
)

export * from './print.js'
export * from './types.js'
