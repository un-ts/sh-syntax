import { expect, test } from 'vitest'

test('sync workerd entry reports unsupported', async () => {
  const sync = await import('../src/sync/workerd.ts')

  expect(() => sync.parse('echo hi\n')).toThrow(/not supported on workerd/)
  expect(() => sync.print('echo hi\n')).toThrow(/not supported on workerd/)
  expect(() => sync.processor('echo hi\n')).toThrow(/not supported on workerd/)
})
