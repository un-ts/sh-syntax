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

  test('getProcessor streams a WASM response', async () => {
    const wasm = new Uint8Array(
      readFileSync(path.resolve(import.meta.dirname, '../main.wasm')),
    )
    const streaming = getProcessor(() =>
      Promise.resolve(
        new Response(wasm, {
          headers: { 'Content-Type': 'application/wasm' },
        }),
      ),
    )

    await expect(streaming('echo hi\n')).resolves.toMatchObject({
      type: 'File',
    })
  })

  test('getProcessor falls back without compileStreaming', async () => {
    const wasm = new Uint8Array(
      readFileSync(path.resolve(import.meta.dirname, '../main.wasm')),
    )
    const descriptor = Object.getOwnPropertyDescriptor(
      WebAssembly,
      'compileStreaming',
    )
    Object.defineProperty(WebAssembly, 'compileStreaming', {
      configurable: true,
      value: undefined,
    })

    try {
      const fallback = getProcessor(() =>
        Promise.resolve(
          new Response(wasm, {
            headers: { 'Content-Type': 'application/wasm' },
          }),
        ),
      )

      await expect(fallback('echo hi\n')).resolves.toMatchObject({
        type: 'File',
      })
    } finally {
      if (descriptor) {
        Object.defineProperty(WebAssembly, 'compileStreaming', descriptor)
      }
    }
  })

  test('getProcessor accepts response-like sources', async () => {
    const wasm = new Uint8Array(
      readFileSync(path.resolve(import.meta.dirname, '../main.wasm')),
    )
    const responseLike = {
      arrayBuffer: () => Promise.resolve(wasm.buffer),
    }
    const processor = getProcessor(() => responseLike as Response)

    await expect(processor('echo hi\n')).resolves.toMatchObject({
      type: 'File',
    })
  })

  test('getProcessor falls back for a non-WASM response', async () => {
    const wasm = new Uint8Array(
      readFileSync(path.resolve(import.meta.dirname, '../main.wasm')),
    )
    const fallback = getProcessor(() =>
      Promise.resolve(
        new Response(wasm, {
          headers: { 'Content-Type': 'application/octet-stream' },
        }),
      ),
    )

    await expect(fallback('echo hi\n')).resolves.toMatchObject({
      type: 'File',
    })
  })

  test('getProcessorSync accepts a synchronous loader', () => {
    const sync = getProcessorSync(() =>
      readFileSync(path.resolve(import.meta.dirname, '../main.wasm')),
    )

    expect(sync('echo hi\n').type).toBe('File')
  })
})
