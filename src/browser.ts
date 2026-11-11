import '../vendors/wasm_exec.cjs'
import { getProcessor } from './processor.js'
import type { File, ShOptions, ShPrintOptions } from './types.js'

const wasmUrl = new URL('../main.wasm', import.meta.url)
const processor = getProcessor(() => fetch(wasmUrl))

/** Loads and initializes the browser WASM runtime. */
export const init = processor.init

/** Parses shell source in the browser. Initializes the runtime automatically. */
export const parse = (text: string, options?: ShOptions): Promise<File> => processor(text, options)

export function print(text: string, options?: ShOptions): Promise<string>
export function print(ast: File, options: ShPrintOptions): Promise<string>
export function print(
  textOrAst: File | string,
  options?: ShOptions & { originalText?: string },
): Promise<string> {
  if (typeof textOrAst === 'string') {
    return processor(textOrAst, {
      ...options,
      print: true,
    })
  }
  return processor(textOrAst, options as ShPrintOptions)
}

export * from './ast.js'
export * from './processor.js'
export * from './source.js'
export * from './types.js'
