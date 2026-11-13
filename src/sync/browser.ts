import { createProcessorAPI } from './api.js'
import { getProcessor } from './processor.js'

const wasmUrl = new URL('../../main.wasm', import.meta.url)

const loadWasm = async (): Promise<WebAssembly.Module> => {
  const response = await fetch(wasmUrl)

  if (typeof WebAssembly.compileStreaming === 'function') {
    try {
      return await WebAssembly.compileStreaming(response.clone())
    } catch {
      // Fall back for servers that do not send an application/wasm content type.
    }
  }

  return WebAssembly.compile(await response.arrayBuffer())
}

export const processor = getProcessor(await loadWasm())

export const { parse, print, splitBraces } = createProcessorAPI(processor)

export * from '../common.js'

export * from './processor.js'
