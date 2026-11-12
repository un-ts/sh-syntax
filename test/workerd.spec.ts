import { expect, test, vi } from 'vitest'

test('workerd entry initializes from the bundled module', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => {
      throw new Error('fetch must not be used')
    }),
  )
  const workerd = await import('../src/workerd.ts')

  await workerd.init()
  await expect(workerd.parse('echo hi\n')).resolves.toMatchObject({ type: 'File' })
  await expect(workerd.print('echo   hi\n')).resolves.toBe('echo hi\n')
  expect(vi.mocked(fetch)).not.toHaveBeenCalled()
  vi.unstubAllGlobals()
})
