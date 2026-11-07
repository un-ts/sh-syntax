import { readFileSync } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import './shim.js'
import '../vendors/wasm_exec.cjs'

import { createSyncProcessor, getProcessor } from './processor.js'
import type { File, ShOptions, ShPrintOptions } from './types.js'

const importMetaUrl = import.meta.url

/* istanbul ignore next -- @preserve */
const _dirname = importMetaUrl
  ? path.dirname(fileURLToPath(importMetaUrl))
  : __dirname

export const processor = getProcessor(() =>
  fs.readFile(path.resolve(_dirname, '../main.wasm')),
)

export const parse = (text: string, options?: ShOptions) =>
  processor(text, options)

const printSource = (
  textOrAst: File | string,
  options?: ShOptions & { originalText?: string },
): string => {
  if (typeof textOrAst === 'string') {
    return textOrAst
  }
  if (options?.originalText == null) {
    throw new TypeError(
      'print(ast) is not supported yet; pass { originalText } to format the source text',
    )
  }
  return options.originalText
}

export function print(text: string, options?: ShOptions): Promise<string>
export function print(ast: File, options: ShPrintOptions): Promise<string>
export function print(
  textOrAst: File | string,
  options?: ShOptions & { originalText?: string },
): Promise<string> {
  return processor(printSource(textOrAst, options), {
    ...options,
    print: true,
  })
}

let syncProcessor: ReturnType<typeof createSyncProcessor> | undefined

const getSyncProcessor = () =>
  (syncProcessor ??= createSyncProcessor(
    readFileSync(path.resolve(_dirname, '../main.wasm')),
  ))

export const parseSync = (text: string, options?: ShOptions) =>
  getSyncProcessor()(text, options)

export function printSync(text: string, options?: ShOptions): string
export function printSync(ast: File, options: ShPrintOptions): string
export function printSync(
  textOrAst: File | string,
  options?: ShOptions & { originalText?: string },
): string {
  return getSyncProcessor()(printSource(textOrAst, options), {
    ...options,
    print: true,
  })
}

export { isIncomplete, walk } from './ast.js'
export * from './processor.js'
export * from './types.js'
