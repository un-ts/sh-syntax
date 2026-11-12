import type { File, ShOptions, ShPrintOptions } from '../types.js'
import type { Processor } from './processor.js'

const unsupported = (): never => {
  throw new Error('sh-syntax/sync is not supported on workerd; use sh-syntax')
}

export const processor = unsupported as unknown as Processor

export const parse = (_text: string, _options?: ShOptions): File => unsupported()

export function print(text: string, options?: ShOptions): string
export function print(ast: File, options: ShPrintOptions): string
export function print(..._args: [File | string, ShOptions?]): string {
  return unsupported()
}

export * from '../common.js'
