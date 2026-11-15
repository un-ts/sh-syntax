// oxlint-disable-next-line import/no-unassigned-import -- shim installs the runtime shim
import './shim.js'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createProcessorAPI } from './api.js'
import { getProcessor } from './processor.js'

const importMetaUrl = import.meta.url

/* istanbul ignore next -- @preserve */
const moduleDir = importMetaUrl ? path.dirname(fileURLToPath(importMetaUrl)) : __dirname

export const processor = getProcessor(() => fs.readFile(path.resolve(moduleDir, '../main.wasm')))

export const { init } = processor

export const { parse, print } = createProcessorAPI(processor)
export const { splitBraces, createInteractiveParser } = processor

export * from './common.js'
export * from './processor.js'
