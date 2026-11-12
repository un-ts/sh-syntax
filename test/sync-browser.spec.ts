import { readFileSync } from 'node:fs'

import { afterEach, expect, test, vi } from 'vitest'

const wasm = readFileSync(new URL('../main.wasm', import.meta.url))

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

test('sync browser entry loads wasm before exposing sync parse/print', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(wasm, {
          headers: { 'content-type': 'application/wasm' },
        }),
    ),
  )
  const sync = await import('../src/sync/browser.ts')

  const ast = sync.parse('echo hi\n')
  expect(ast).toMatchObject({ type: 'File' })
  expect(sync.print('echo   hi\n')).toBe('echo hi\n')
  expect(sync.print(ast, { originalText: 'echo   hi\n' })).toBe('echo hi\n')
  expect(vi.mocked(fetch)).toHaveBeenCalledOnce()
})

test('sync browser entry falls back without compileStreaming', async () => {
  const descriptor = Object.getOwnPropertyDescriptor(WebAssembly, 'compileStreaming')
  Object.defineProperty(WebAssembly, 'compileStreaming', { configurable: true, value: undefined })
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(wasm, {
          headers: { 'content-type': 'application/octet-stream' },
        }),
    ),
  )

  try {
    const sync = await import('../src/sync/browser.ts')
    expect(sync.parse('echo fallback\n')).toMatchObject({ type: 'File' })
  } finally {
    if (descriptor) {
      Object.defineProperty(WebAssembly, 'compileStreaming', descriptor)
    }
  }
})
