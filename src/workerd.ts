/* istanbul ignore file -- bundler-only entry that imports a compiled wasm module */
import '../vendors/wasm_exec.cjs'
import wasm from '../main.wasm'
import { createProcessorAPI } from './api.js'
import { getProcessor } from './processor.js'

const api = createProcessorAPI(getProcessor(wasm))

export const { init, parse, print } = api

export * from './ast.js'
export * from './processor.js'
export * from './source.js'
export * from './types.js'
