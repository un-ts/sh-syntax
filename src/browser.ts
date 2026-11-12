import { createProcessorAPI } from './api.js'
import { getProcessor } from './processor.js'

export const processor = getProcessor(() => fetch(new URL('../main.wasm', import.meta.url)))

export const { init } = processor

export const { parse, print } = createProcessorAPI(processor)

export * from './ast.js'
export * from './processor.js'
export * from './source.js'
export * from './types.js'
