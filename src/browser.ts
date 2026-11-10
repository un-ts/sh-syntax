import '../vendors/wasm_exec.cjs'
import { getProcessorSync } from './processor.js'
import type { File, ShOptions, ShPrintOptions } from './types.js'

const wasmUrl = new URL('../main.wasm', import.meta.url)

/**
 * Loads and compiles the WASM module for the browser entry.
 *
 * @returns The compiled module
 */
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
const processor = getProcessorSync(wasmModule)

/**
 * Parses shell source in the browser.
 *
 * @param text Shell source
 * @param options Parser options
 * @returns Parsed syntax tree
 */
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

/** Synchronous alias for {@link parse}. */
export const parseSync = parse

/** Synchronous alias for {@link print}. */
export const printSync = print

export { isIncomplete, walk } from './ast.js'
export * from './processor.js'
export * from './types.js'
