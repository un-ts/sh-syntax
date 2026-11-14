import { LangVariant, parse, print } from 'sh-syntax'

test('parse', async () => {
  expect(await parse('  Hello   World!')).toMatchSnapshot()

  expect(await parse('  Hello   World ! a', { stopAt: '!' })).toMatchSnapshot()

  expect(
    await parse('  Hello   World ! b', {
      variant: LangVariant.LangPOSIX,
    }),
  ).toMatchSnapshot()

  expect(await parse('  Hello   World ! c', { useTabs: true })).toMatchSnapshot()

  await expect(parse('echo )')).rejects.toMatchInlineSnapshot(
    `[ParseError: a command can only contain words and redirects; encountered \`)\`]`,
  )
})

test('parse rejects an overlong stopAt', async () => {
  await expect(parse('echo hi', { stopAt: 'longer' })).rejects.toThrow(TypeError)
  expect((await parse('echo hi')).type).toBe('File')
})

test('print', async () => {
  expect(await print('  Hello   World ! d', { filepath: 'bar.sh' })).toMatchSnapshot()

  const redundantSyntax = 'echo $(( (1 + 2) ))\n'
  expect(await print(redundantSyntax)).toBe('echo $(((1 + 2)))\n')
  expect(await print(redundantSyntax, { simplify: true })).toBe('echo $((1 + 2))\n')
  expect(await print(redundantSyntax, { minify: true })).toBe('echo $((1+2))\n')
})
