/* istanbul ignore file -- bundler-only entry that imports a compiled wasm module */
import wasm from '../main.wasm'
import { createProcessorAPI } from './api.js'
import { getProcessor } from './processor.js'

const processor = getProcessor(wasm)
const api = createProcessorAPI(processor)

export const { init } = processor

export const { parse, print } = api

export * from './ast.js'
export * from './processor.js'
export * from './source.js'
export * from './types.js'
