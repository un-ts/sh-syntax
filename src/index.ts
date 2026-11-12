// oxlint-disable-next-line import/no-unassigned-import -- shim installs the runtime shim
import './shim.js'
import { readFileSync } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createProcessorAPI } from './api.js'
import { getProcessorSync, getProcessor } from './processor.js'
import type { File, ShOptions, ShPrintOptions } from './types.js'

const importMetaUrl = import.meta.url

/* istanbul ignore next -- @preserve */
const moduleDir = importMetaUrl ? path.dirname(fileURLToPath(importMetaUrl)) : __dirname

export const processor = getProcessor(() => fs.readFile(path.resolve(moduleDir, '../main.wasm')))

export const { init } = processor

export const { parse, print } = createProcessorAPI(processor)

let syncProcessor: ReturnType<typeof getProcessorSync> | undefined

const getSyncProcessor = () =>
  // eslint-disable-next-line unicorn/no-top-level-assignment-in-function -- lazy module cache
  (syncProcessor ??= getProcessorSync(readFileSync(path.resolve(moduleDir, '../main.wasm'))))

export const parseSync = (text: string, options?: ShOptions) => getSyncProcessor()(text, options)

export function printSync(text: string, options?: ShOptions): string
export function printSync(ast: File, options: ShPrintOptions): string
export function printSync(
  textOrAst: File | string,
  options?: ShOptions & { originalText?: string },
): string {
  const processorSync = getSyncProcessor()
  if (typeof textOrAst === 'string') {
    return processorSync(textOrAst, {
      ...options,
      print: true,
    })
  }
  return processorSync(textOrAst, options as ShPrintOptions)
}

export * from './ast.js'
export * from './source.js'
export * from './processor.js'
export * from './types.js'
