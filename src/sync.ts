// oxlint-disable-next-line import/no-unassigned-import -- shim installs the runtime shim
import './shim.js'
// oxlint-disable-next-line import/no-unassigned-import -- wasm_exec registers the Go runtime
import '../vendors/wasm_exec.cjs'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { getProcessorSync } from './processor.js'
import type { File, ShOptions, ShPrintOptions } from './types.js'

const importMetaUrl = import.meta.url

/* istanbul ignore next -- @preserve */
const moduleDir = importMetaUrl ? path.dirname(fileURLToPath(importMetaUrl)) : __dirname

export const processorSync = getProcessorSync(readFileSync(path.resolve(moduleDir, '../main.wasm')))

export const parseSync = (text: string, options?: ShOptions) => processorSync(text, options)

export function printSync(text: string, options?: ShOptions): string
export function printSync(ast: File, options: ShPrintOptions): string
export function printSync(
  textOrAst: File | string,
  options?: ShOptions & { originalText?: string },
): string {
  if (typeof textOrAst === 'string') {
    return processorSync(textOrAst, {
      ...options,
      print: true,
    })
  }
  return processorSync(textOrAst, options as ShPrintOptions)
}

export { getProcessorSync, ParseError } from './processor.js'
export type {
  GetWebAssembly,
  GetWebAssemblyInstance,
  GetWebAssemblySource,
  GetWebAssemblySourceSync,
  Processor,
  WebAssemblyBaseSource,
  WebAssemblySource,
} from './processor.js'
export * from './types.js'
