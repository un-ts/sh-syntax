// oxlint-disable-next-line import/no-unassigned-import -- shim installs the runtime shim
import '../shim.js'
// oxlint-disable-next-line import/no-unassigned-import -- wasm_exec registers the Go runtime
import '../../vendors/wasm_exec.cjs'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createSyncProcessorAPI } from './api.js'
import { getProcessor } from './processor.js'

const importMetaUrl = import.meta.url

/* istanbul ignore next -- @preserve */
const moduleDir = importMetaUrl ? path.dirname(fileURLToPath(importMetaUrl)) : __dirname

export const processor = getProcessor(readFileSync(path.resolve(moduleDir, '../../main.wasm')))

export const { parse, print } = createSyncProcessorAPI(processor)

export { ParseError } from '../processor.js'
export { getProcessor } from './processor.js'
export type { GetWebAssemblySource, WebAssemblyBaseSource } from './processor.js'
export * from '../types.js'
