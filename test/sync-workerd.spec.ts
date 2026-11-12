import { expect, test } from 'vitest'

test('sync workerd entry rejects at import', async () => {
  await expect(import('../src/sync/workerd.ts')).rejects.toThrow(/not supported on workerd/)
})
