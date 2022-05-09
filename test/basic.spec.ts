import { jest } from '@jest/globals'

import { LangVariant, parse, print } from 'sh-syntax'

jest.spyOn(console, 'warn').mockImplementationOnce(jest.fn())

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

  expect(console.warn).toHaveBeenCalledTimes(1)

  await expect(parse('echo )')).rejects.toMatchInlineSnapshot(
    `[Error: a command can only contain words and redirects; encountered )]`,
  )
})
