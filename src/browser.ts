import '../vendors/wasm_exec.cjs'
import { createProcessorAPI } from './api.js'
import { getProcessor } from './processor.js'

const api = createProcessorAPI(getProcessor(() => fetch(new URL('../main.wasm', import.meta.url))))

export const { init, parse, print } = api

export * from './ast.js'
export * from './processor.js'
export * from './source.js'
export * from './types.js'
