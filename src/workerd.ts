/* istanbul ignore file -- bundler-only entry that imports a compiled wasm module */
// oxlint-disable-next-line import/no-unassigned-import -- wasm_exec registers the Go runtime
import '../vendors/wasm_exec.cjs'
import wasm from '../main.wasm'
import { getProcessor } from './processor.js'
import type { File, ShOptions, ShPrintOptions } from './types.js'

const processor = getProcessor(wasm)

/** Initializes the Go runtime with the bundled compiled WASM module. */
export const init = processor.init

/** Parses shell source. Initializes the runtime automatically. */
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
