import { createProcessorAPI } from './api.js'
import { getProcessor } from './processor.js'

const processor = getProcessor(() => fetch(new URL('../main.wasm', import.meta.url)))
const api = createProcessorAPI(processor)

export { processor }

export const { init } = processor

export const { parse, print } = api

export * from './ast.js'
export * from './processor.js'
export * from './source.js'
export * from './types.js'
