// oxlint-disable-next-line import/no-unassigned-import -- wasm_exec registers the Go runtime
import '../vendors/wasm_exec.cjs'
import type { Processor } from './processor.js'
import type { File, ShOptions, ShPrintOptions } from './types.js'

/** Async API bound to one processor. */
export interface ProcessorAPI {
  parse: (text: string, options?: ShOptions) => Promise<File>
  print: {
    (text: string, options?: ShOptions): Promise<string>
    (ast: File, options?: ShPrintOptions): Promise<string>
  }
}

/** Binds the async parse/print surface to a processor. */
export const createProcessorAPI = (processor: Processor): ProcessorAPI => ({
  parse: (text, options) => processor(text, options),
  print: (
    textOrAst: File | string,
    options?: ShOptions & { originalText?: string },
  ): Promise<string> => {
    if (typeof textOrAst === 'string') {
      return processor(textOrAst, {
        ...options,
        print: true,
      })
    }
    return processor(textOrAst, options as ShPrintOptions)
  },
})
