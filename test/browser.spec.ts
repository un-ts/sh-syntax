import { readFileSync } from 'node:fs'

import { afterEach, expect, test, vi } from 'vitest'

const wasm = readFileSync(new URL('../main.wasm', import.meta.url))

const stubFetch = () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(wasm, {
          headers: { 'content-type': 'application/wasm' },
        }),
    ),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

test('browser entry falls back when streaming compilation is unavailable', async () => {
  stubFetch()
  const compileStreaming = WebAssembly.compileStreaming
  Object.defineProperty(WebAssembly, 'compileStreaming', {
    configurable: true,
    value: undefined,
  })

  try {
    // @ts-expect-error -- cache-busting query for a fresh top-level await
    const { parse, print } =
      (await import('../src/browser.ts?fallback')) as typeof import('../src/browser.ts')
    const ast = parse('echo hi')
    expect(ast.type).toBe('File')
    expect(print('  echo hi')).toBe('echo hi\n')
    expect(print(ast, { originalText: '  echo hi' })).toBe('echo hi\n')
  } finally {
    Object.defineProperty(WebAssembly, 'compileStreaming', {
      configurable: true,
      value: compileStreaming,
    })
  }
})

test('browser entry falls back when streaming compilation rejects', async () => {
  stubFetch()
  const compileStreaming = WebAssembly.compileStreaming
  Object.defineProperty(WebAssembly, 'compileStreaming', {
    configurable: true,
    value: vi.fn<() => Promise<never>>(async () => {
      throw new TypeError('invalid content type')
    }),
  })

  try {
    // @ts-expect-error -- cache-busting query for a fresh top-level await
    const { parse } =
      (await import('../src/browser.ts?streaming-error')) as typeof import('../src/browser.ts')
    expect(parse('echo hi').type).toBe('File')
  } finally {
    Object.defineProperty(WebAssembly, 'compileStreaming', {
      configurable: true,
      value: compileStreaming,
    })
  }
})

test('browser entry compiles a streaming response', async () => {
  stubFetch()
  const compileStreaming = WebAssembly.compileStreaming
  Object.defineProperty(WebAssembly, 'compileStreaming', {
    configurable: true,
    value: vi.fn<() => Promise<WebAssembly.Module>>(async () => WebAssembly.compile(wasm)),
  })

  try {
    // @ts-expect-error -- cache-busting query for a fresh top-level await
    const { parse } =
      (await import('../src/browser.ts?streaming')) as typeof import('../src/browser.ts')
    expect(parse('echo hi').type).toBe('File')
  } finally {
    Object.defineProperty(WebAssembly, 'compileStreaming', {
      configurable: true,
      value: compileStreaming,
    })
  }
})
