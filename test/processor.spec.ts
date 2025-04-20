import fs from 'node:fs/promises'
import path from 'node:path'

import { testFixtures } from './fixtures.ts'

import {
  type GetWebAssemblyInstance,
  type ShOptions,
  type ShPrintOptions,
  getProcessor,
  print as print_,
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
    const { instance } = await WebAssembly.instantiate(
      buffer as BufferSource,
      imports,
    )
    return instance
  }

  const processor = getProcessor(initWasm)

  const parse = (text: string, options?: ShOptions) => processor(text, options)

  const print: typeof print_ = (textOrAst, options) => {
    if (typeof textOrAst === 'string') {
      return processor(textOrAst, {
        ...options,
        print: true,
      })
    }
    return processor(textOrAst, options as ShPrintOptions)
  }

  testFixtures(parse, print)
})
