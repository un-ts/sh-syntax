// oxlint-disable-next-line import/no-unassigned-import -- shim installs the runtime shim
import '../shim.js'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createProcessorAPI } from './api.js'
import { getProcessor } from './processor.js'

const importMetaUrl = import.meta.url

/* istanbul ignore next -- @preserve */
const moduleDir = importMetaUrl ? path.dirname(fileURLToPath(importMetaUrl)) : __dirname

export const processor = getProcessor(readFileSync(path.resolve(moduleDir, '../../main.wasm')))

export const { parse, print } = createProcessorAPI(processor)

export * from '../common.js'

export * from './processor.js'
