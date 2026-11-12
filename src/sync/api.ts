import type { File, ShOptions, ShPrintOptions } from '../types.js'
import type { SyncProcessor } from './processor.js'

/** Synchronous API bound to one sync processor. */
export interface SyncProcessorAPI {
  parse: (text: string, options?: ShOptions) => File
  print: {
    (text: string, options?: ShOptions): string
    (ast: File, options: ShPrintOptions): string
  }
}

/** Binds the synchronous parse/print surface to a sync processor. */
export const createSyncProcessorAPI = (processor: SyncProcessor): SyncProcessorAPI => ({
  parse: (text, options) => processor(text, options),
  print: (textOrAst: File | string, options?: ShOptions & { originalText?: string }): string => {
    if (typeof textOrAst === 'string') {
      return processor(textOrAst, {
        ...options,
        print: true,
      })
    }
    return processor(textOrAst, options as ShPrintOptions)
  },
})
