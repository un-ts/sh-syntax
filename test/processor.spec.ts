import fs from 'node:fs/promises'
import path from 'node:path'

import {
  type File,
  type GetWebAssemblyInstance,
  type ShOptions,
  type ShPrintOptions,
  getProcessor,
} from 'sh-syntax'

describe('processor', () => {
  /**
   * `sh-syntax/wasm?init` does not work in vitest
   * See also {@link https://github.com/vitest-dev/vitest/issues/6723}
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

  const print = (textOrAst: File | string, options: ShPrintOptions) => {
    if (typeof textOrAst === 'string') {
      return processor(textOrAst, {
        ...options,
        print: true,
      })
    }
    return processor(textOrAst, options)
  }

  it('should format all fixtures', async () => {
    const fixtures = path.resolve(import.meta.dirname, 'fixtures')
    for (const filepath of await fs.readdir(fixtures)) {
      const input = await fs.readFile(path.resolve(fixtures, filepath), 'utf8')

      try {
        const ast = await parse(input, { filepath })
        expect(ast).toMatchSnapshot(filepath)
        expect(
          await print(ast, { filepath, originalText: input }),
        ).toMatchSnapshot(filepath)
      } catch (err: unknown) {
        expect(err).toMatchSnapshot(filepath)
      }
    }
  })
})
