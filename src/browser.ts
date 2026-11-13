import { createProcessorAPI } from './api.js'
import { getProcessor } from './processor.js'

export const processor = getProcessor(() => fetch(new URL('../main.wasm', import.meta.url)))

export const { init } = processor

export const { parse, print, splitBraces } = createProcessorAPI(processor)

export * from './common.js'
export * from './processor.js'
