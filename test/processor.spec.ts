import { readFileSync } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'

import { testFixtures } from './fixtures.ts'

import {
  type GetWebAssemblyInstance,
  type ShOptions,
  getProcessor,
  getProcessorSync,
} from 'sh-syntax'

describe('processor', () => {
  /**
   * `sh-syntax/wasm?init` does not work in vitest. See also
   * {@link https://github.com/vitest-dev/vitest/issues/6723}
   */
  const initWasm: GetWebAssemblyInstance = async imports => {
    const buffer = await fs.readFile(
      path.resolve(import.meta.dirname, '../main.wasm'),
    )
    const { instance } = await WebAssembly.instantiate(buffer, imports)
    return instance
  }

  const processor = getProcessor(initWasm)

  const parse = (text: string, options?: ShOptions) => processor(text, options)

  const print = (text: string, options?: ShOptions) =>
    processor(text, {
      ...options,
      print: true,
    })

  testFixtures(parse, print)

  test('getProcessorSync accepts a synchronous loader', () => {
    const sync = getProcessorSync(() =>
      readFileSync(path.resolve(import.meta.dirname, '../main.wasm')),
    )

    expect(sync('echo hi\n').type).toBe('File')
  })
})
