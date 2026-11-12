// oxlint-disable-next-line import/no-unassigned-import -- wasm_exec registers the Go runtime
import '../../vendors/wasm_exec.cjs'
import type { File, ShOptions, ShPrintOptions } from '../types.js'
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

export const parse = (text: string, options?: ShOptions): File => processor(text, options)

export function print(text: string, options?: ShOptions): string
export function print(ast: File, options: ShPrintOptions): string
export function print(
  textOrAst: File | string,
  options?: ShOptions & { originalText?: string },
): string {
  if (typeof textOrAst === 'string') {
    return processor(textOrAst, {
      ...options,
      print: true,
    })
  }
  return processor(textOrAst, options as ShPrintOptions)
}

export { ParseError } from '../processor.js'
export { getProcessor } from './processor.js'
export type { GetWebAssemblySource, WebAssemblyBaseSource } from './processor.js'
export * from '../types.js'
