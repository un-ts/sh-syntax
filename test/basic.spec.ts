import { tmpdir } from 'os'
import path from 'path'

import { expect, test } from 'vitest'

import { LangVariant, parse, print } from 'sh-syntax'

test('parse', async () => {
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

  expect(
    await parse('  Hello   World ! d', {
      filepath: path.resolve(tmpdir(), 'non-existed-1.sh'),
    }),
  ).toMatchSnapshot()

  await expect(parse('echo )')).rejects.toMatchInlineSnapshot(
    `[Error: a command can only contain words and redirects; encountered )]`,
  )
})

test('print', async () => {
  expect(
    await print('  Hello   World ! e', { filepath: 'bar.sh' }),
  ).toMatchSnapshot()

  expect(
    await print('  Hello   World ! f', {
      filepath: path.resolve(tmpdir(), 'non-existed-2.sh'),
    }),
  ).toMatchSnapshot()

  await expect(print(null!, { filepath: 'foo.sh' })).rejects.toMatchSnapshot()
})
