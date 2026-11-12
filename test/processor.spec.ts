import { readFileSync } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'

import { type GetWebAssemblyInstance, type ShOptions, getProcessor } from 'sh-syntax'
import { getProcessor as syncGetProcessor } from 'sh-syntax/sync'

import { testFixtures } from './fixtures.ts'

describe('processor', () => {
  /**
   * `sh-syntax/wasm?init` does not work in vitest. See also
   * {@link https://github.com/vitest-dev/vitest/issues/6723}
   */
  const initWasm: GetWebAssemblyInstance = async imports => {
    const buffer = await fs.readFile(path.resolve(import.meta.dirname, '../main.wasm'))
    const { instance } = await WebAssembly.instantiate(buffer, imports)
    return instance
  }

  const processShell = getProcessor(initWasm)

  const parse = (text: string, options?: ShOptions) => processShell(text, options)

  const print = (text: string, options?: ShOptions) =>
    processShell(text, {
      ...options,
      print: true,
    })

  testFixtures(parse, print)

  test('init loads once and the async API initializes automatically', async () => {
    const wasm = new Uint8Array(readFileSync(path.resolve(import.meta.dirname, '../main.wasm')))
    let loads = 0
    const processor = getProcessor(() => {
      loads++
      return Promise.resolve(wasm)
    })

    await Promise.all([processor.init(), processor.init()])
    expect(loads).toBe(1)
    const first = processor.init()
    expect(processor.init()).toBe(first)
    await first

    await expect(processor('echo hi\n')).resolves.toMatchObject({ type: 'File' })
    expect(loads).toBe(1)
  })

  test('getProcessor accepts a direct WASM source', async () => {
    const wasm = new Uint8Array(readFileSync(path.resolve(import.meta.dirname, '../main.wasm')))
    const processor = getProcessor(wasm)

    await processor.init()
    await expect(processor('echo hi\n')).resolves.toMatchObject({ type: 'File' })
  })

  test('init rejects a Go startup failure', async () => {
    const empty = new WebAssembly.Module(Buffer.from('AGFzbQEAAAA=', 'base64'))
    let attempts = 0
    const processor = getProcessor(async _imports => {
      attempts++
      return new WebAssembly.Instance(empty, {})
    })

    await expect(processor.init()).rejects.toThrow(/undefined|not a function/)
    await expect(processor('echo hi\n')).rejects.toThrow(/undefined|not a function/)
    expect(attempts).toBe(2)
  })

  test('getProcessor accepts a compiled module', async () => {
    const bytes = readFileSync(path.resolve(import.meta.dirname, '../main.wasm'))
    const module = await WebAssembly.compile(bytes)
    const processor = getProcessor(module)

    await processor.init()
    await expect(processor('echo hi\n')).resolves.toMatchObject({ type: 'File' })
  })

  test('syncGetProcessor accepts a compiled module', () => {
    const bytes = readFileSync(path.resolve(import.meta.dirname, '../main.wasm'))
    const module = new WebAssembly.Module(bytes)
    const processor = syncGetProcessor(module)

    expect(processor('echo hi\n')).toMatchObject({ type: 'File' })
  })

  test('getProcessor streams a WASM response', async () => {
    const wasm = new Uint8Array(readFileSync(path.resolve(import.meta.dirname, '../main.wasm')))
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
    const wasm = new Uint8Array(readFileSync(path.resolve(import.meta.dirname, '../main.wasm')))
    const descriptor = Object.getOwnPropertyDescriptor(WebAssembly, 'compileStreaming')
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

  test('getProcessor retries module loading after a failure', async () => {
    const wasm = new Uint8Array(readFileSync(path.resolve(import.meta.dirname, '../main.wasm')))
    let attempts = 0
    const processor = getProcessor(() => {
      attempts++
      return attempts === 1 ? Promise.reject(new Error('load failed')) : Promise.resolve(wasm)
    })

    await expect(processor('echo hi\n')).rejects.toThrow('load failed')
    await expect(processor('echo hi\n')).resolves.toMatchObject({
      type: 'File',
    })
    expect(attempts).toBe(2)
  })

  test('getProcessor reuses one instance and serializes calls', async () => {
    let calls = 0
    const processor = getProcessor(async imports => {
      calls++
      return initWasm(imports)
    })

    const results = await Promise.all([
      processor('echo one\n'),
      processor('echo two\n'),
      processor('echo three\n'),
    ])

    expect(results).toHaveLength(3)
    expect(results[0]).toMatchObject({
      stmts: [{ cmd: { args: [{}, { parts: [{ value: 'one' }] }] } }],
    })
    expect(results[1]).toMatchObject({
      stmts: [{ cmd: { args: [{}, { parts: [{ value: 'two' }] }] } }],
    })
    expect(results[2]).toMatchObject({
      stmts: [{ cmd: { args: [{}, { parts: [{ value: 'three' }] }] } }],
    })
    expect(calls).toBe(1)
  })

  test('getProcessor retries runtime creation after a failure', async () => {
    let attempts = 0
    const processor = getProcessor(async imports => {
      attempts++
      if (attempts === 1) {
        throw new Error('init failed')
      }
      return initWasm(imports)
    })

    await expect(processor('echo hi\n')).rejects.toThrow('init failed')
    await expect(processor('echo hi\n')).resolves.toMatchObject({ type: 'File' })
    expect(attempts).toBe(2)
  })

  test('getProcessor accepts response-like sources', async () => {
    const wasm = new Uint8Array(readFileSync(path.resolve(import.meta.dirname, '../main.wasm')))
    const responseLike = {
      arrayBuffer: () => Promise.resolve(wasm.buffer),
    }
    const processor = getProcessor(() => responseLike)

    await expect(processor('echo hi\n')).resolves.toMatchObject({
      type: 'File',
    })
  })

  test('getProcessor falls back for a non-WASM response', async () => {
    const wasm = new Uint8Array(readFileSync(path.resolve(import.meta.dirname, '../main.wasm')))
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

  test('syncGetProcessor throws for a non-Go instance', () => {
    const empty = new WebAssembly.Module(Buffer.from('AGFzbQEAAAA=', 'base64'))

    expect(() => syncGetProcessor(empty)).toThrow(/Go WASM instance/)
  })

  test('syncGetProcessor surfaces a startup rejection', async () => {
    const go = (globalThis as { Go?: { prototype: { run: (...args: never[]) => Promise<void> } } })
      .Go
    const originalRun = go?.prototype.run
    if (!go || !originalRun) {
      throw new Error('Go runtime is unavailable')
    }

    go.prototype.run = () => Promise.reject(new Error('startup failed'))
    try {
      const bytes = readFileSync(path.resolve(import.meta.dirname, '../main.wasm'))
      const syncProcessor = syncGetProcessor(bytes)
      await Promise.resolve()
      expect(() => syncProcessor('echo hi\n')).toThrow('startup failed')
    } finally {
      go.prototype.run = originalRun
    }
  })

  test('syncGetProcessor accepts a synchronous loader and handles repeated calls', () => {
    const syncProcessor = syncGetProcessor(() =>
      readFileSync(path.resolve(import.meta.dirname, '../main.wasm')),
    )

    for (let i = 0; i < 1000; i++) {
      expect(syncProcessor('echo hi\n').type).toBe('File')
    }
  })
})

test('syncGetProcessor throws when Go exits during startup', () => {
  const go = (globalThis as { Go?: { prototype: { run: (...args: never[]) => Promise<void> } } }).Go
  const originalRun = go?.prototype.run
  if (!go || !originalRun) {
    throw new Error('Go runtime is unavailable')
  }

  go.prototype.run = function (this: { exited: boolean }) {
    this.exited = true
    return Promise.resolve()
  } as never
  try {
    const bytes = readFileSync(path.resolve(import.meta.dirname, '../main.wasm'))
    expect(() => syncGetProcessor(bytes)).toThrow(/exited during startup/)
  } finally {
    go.prototype.run = originalRun
  }
})
