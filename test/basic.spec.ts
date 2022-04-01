import { LangVariant, print } from 'sh-syntax'

test('it should just work', async () => {
  expect(await print('  Hello   World!')).toMatchInlineSnapshot(`
    "Hello World!
    "
  `)

  expect(await print('  Hello   World ! a', { stopAt: '!' }))
    .toMatchInlineSnapshot(`
      "Hello World
      "
    `)

  expect(await print('  Hello   World ! b', { variant: LangVariant.LangPOSIX }))
    .toMatchInlineSnapshot(`
      "Hello World ! b
      "
    `)

  expect(await print('  Hello   World ! c', { useTabs: true }))
    .toMatchInlineSnapshot(`
      "Hello World ! c
      "
    `)

  await expect(print('echo )')).rejects.toMatchInlineSnapshot(
    `[Error: path:1:6: a command can only contain words and redirects; encountered )]`,
  )
})
