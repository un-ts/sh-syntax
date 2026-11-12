// oxlint-disable-next-line import/no-unassigned-import -- wasm_exec registers the Go runtime
import '../../vendors/wasm_exec.cjs'
import { createSyncProcessorAPI } from './api.js'
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

const wasmModule = await loadWasm()
export const processor = getProcessor(wasmModule)

export const { parse, print } = createSyncProcessorAPI(processor)

export { ParseError } from '../processor.js'
export { getProcessor } from './processor.js'
export type { GetWebAssemblySource, WebAssemblyBaseSource } from './processor.js'
export * from '../types.js'
