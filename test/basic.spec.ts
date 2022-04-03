import { jest } from '@jest/globals'
import { Mock } from 'jest-mock'

import { LangVariant, parse, print } from 'sh-syntax'

const originalConsoleWarn = console.warn
let spyConsoleWarn: Mock<unknown>

beforeEach(() => {
  spyConsoleWarn = console.warn = jest.fn()
})

afterEach(() => {
  console.warn = originalConsoleWarn
})

test('it should just work', async () => {
  expect(await parse('  Hello   World!')).toMatchSnapshot()

  expect(await parse('  Hello   World ! a', { stopAt: '!' })).toMatchSnapshot()

  expect(
    await parse('  Hello   World ! b', {
      variant: LangVariant.LangPOSIX,
    }),
  ).toMatchSnapshot()

  expect(
    await parse('  Hello   World ! c', { useTabs: true }),
  ).toMatchSnapshot()

  expect(await print(null!, { filepath: 'foo.sh' })).toBe('\n')

  expect(spyConsoleWarn).toHaveBeenCalledTimes(1)

  await expect(parse('echo )')).rejects.toMatchInlineSnapshot(
    `[Error: a command can only contain words and redirects; encountered )]`,
  )
})
