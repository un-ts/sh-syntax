// oxlint-disable-next-line import/no-unassigned-import -- wasm_exec registers the Go runtime
import '../../vendors/wasm_exec.cjs'
import type { File, PrintableNode, ShOptions, ShPrintOptions, Word } from '../types.js'
import type { Processor } from './processor.js'

/** Synchronous API bound to one sync processor. */
export interface ProcessorAPI {
  parse: (text: string, options?: ShOptions) => File
  splitBraces: (word: Word) => Word
  print: {
    (text: string, options?: ShOptions): string
    (node: PrintableNode, options?: ShPrintOptions): string
  }
}

/** Binds the synchronous parse/print surface to a sync processor. */
export const createProcessorAPI = (processor: Processor): ProcessorAPI => ({
  parse: (text, options) => processor(text, options),
  splitBraces: word => processor.splitBraces(word),
  print: (textOrAst: PrintableNode | string, options?: ShPrintOptions): string => {
    if (typeof textOrAst === 'string') {
      return processor(textOrAst, {
        ...options,
        print: true,
      })
    }
    return processor(textOrAst, options as ShPrintOptions)
  },
})
