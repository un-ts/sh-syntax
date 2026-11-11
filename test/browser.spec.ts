import { readFileSync } from 'node:fs'

import { afterEach, expect, test, vi } from 'vitest'

const wasm = readFileSync(new URL('../main.wasm', import.meta.url))

const stubFetch = () =>
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(wasm, {
          headers: { 'content-type': 'application/wasm' },
        }),
    ),
  )

afterEach(() => {
  vi.unstubAllGlobals()
})

test('browser init is cached and parse initializes automatically', async () => {
  stubFetch()
  const browser = await import('../src/browser.ts')

  await browser.init()
  const ast = await browser.parse('echo hi\n')
  expect(ast.type).toBe('File')
  expect(await browser.print('echo hi\n')).toBe('echo hi\n')
  expect(await browser.print(ast, { originalText: 'echo hi\n' })).toBe('echo hi\n')

  const fetches = vi.mocked(fetch).mock.calls.length
  await browser.parse('echo two\n')
  expect(vi.mocked(fetch).mock.calls).toHaveLength(fetches)
})
