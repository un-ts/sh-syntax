import { readFileSync } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import './shim.js'
import '../vendors/wasm_exec.cjs'

import { createSyncProcessor, getProcessor } from './processor.js'
import type { File, ShOptions } from './types.js'

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

const rejectOriginalText = (options: unknown): void => {
  if (
    options != null &&
    typeof options === 'object' &&
    'originalText' in options &&
    (options as { originalText?: unknown }).originalText !== undefined
  ) {
    throw new TypeError(
      '`originalText` is no longer supported; pass the source text to print() instead',
    )
  }
}

export const print = (
  textOrAst: File | string,
  options?: ShOptions,
): Promise<string> => {
  rejectOriginalText(options)

  if (typeof textOrAst === 'string') {
    return processor(textOrAst, {
      ...options,
      print: true,
    })
  }
  return processor(textOrAst, options)
}

let syncProcessor: ReturnType<typeof createSyncProcessor> | undefined

const getSyncProcessor = () =>
  (syncProcessor ??= createSyncProcessor(
    readFileSync(path.resolve(_dirname, '../main.wasm')),
  ))

export const parseSync = (text: string, options?: ShOptions) =>
  getSyncProcessor()(text, options)

export const printSync = (
  textOrAst: File | string,
  options?: ShOptions,
): string => {
  rejectOriginalText(options)

  if (typeof textOrAst === 'string') {
    return getSyncProcessor()(textOrAst, {
      ...options,
      print: true,
    })
  }
  return getSyncProcessor()(textOrAst, options)
}

export { DebugPrint, IsIncomplete, NodeType, Walk } from './ast.js'
export * from './processor.js'
export * from './types.js'
