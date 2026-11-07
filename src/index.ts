import { readFileSync } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import './shim.js'
import '../vendors/wasm_exec.cjs'

import { getProcessorSync, getProcessor } from './processor.js'
import type { File, ShOptions, ShPrintOptions } from './types.js'

const importMetaUrl = import.meta.url

/* istanbul ignore next -- @preserve */
const _dirname = importMetaUrl ? path.dirname(fileURLToPath(importMetaUrl)) : __dirname

export const processor = getProcessor(() => fs.readFile(path.resolve(_dirname, '../main.wasm')))

export const parse = (text: string, options?: ShOptions) => processor(text, options)

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

let syncProcessor: ReturnType<typeof getProcessorSync> | undefined

const getSyncProcessor = () =>
  (syncProcessor ??= getProcessorSync(readFileSync(path.resolve(_dirname, '../main.wasm'))))

export const parseSync = (text: string, options?: ShOptions) => getSyncProcessor()(text, options)

export function printSync(text: string, options?: ShOptions): string
export function printSync(ast: File, options: ShPrintOptions): string
export function printSync(
  textOrAst: File | string,
  options?: ShOptions & { originalText?: string },
): string {
  if (typeof textOrAst === 'string') {
    return getSyncProcessor()(textOrAst, {
      ...options,
      print: true,
    })
  }
  return getSyncProcessor()(textOrAst, options as ShPrintOptions)
}

export { isIncomplete, walk } from './ast.js'
export * from './processor.js'
export * from './types.js'
