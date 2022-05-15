import { LangVariant, parse, print } from 'sh-syntax'

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

  await expect(print(null!, { filepath: 'foo.sh' })).rejects.toMatchSnapshot()

  await expect(parse('echo )')).rejects.toMatchInlineSnapshot(
    `[Error: a command can only contain words and redirects; encountered )]`,
  )
})
