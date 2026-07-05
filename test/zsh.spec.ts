import { LangVariant, parse, print } from 'sh-syntax'

// Regression test for zsh support.
//
// zsh parameter-expansion word modifiers such as `:A` (absolute path) and `:h`
// (dirname) are valid zsh but not valid bash. In bash mode mvdan/sh reads
// `${p:offset:length}` as a substring expansion whose `length` is an arithmetic
// expression, so a third `:` yields `ternary operator missing ? before :`.
//
// See https://github.com/un-ts/sh-syntax/issues (zsh scripts fail to parse).
const ZSH_SNIPPET = 'REPO="${0:A:h:h}"'

test('parses zsh parameter-expansion modifiers under LangZsh', async () => {
  // Must not throw when the zsh dialect is selected.
  await expect(
    parse(ZSH_SNIPPET, { variant: LangVariant.LangZsh }),
  ).resolves.toBeTruthy()
})

test('prints zsh parameter-expansion modifiers under LangZsh', async () => {
  await expect(
    print(ZSH_SNIPPET, { variant: LangVariant.LangZsh }),
  ).resolves.toBe(`${ZSH_SNIPPET}\n`)
})

test('rejects zsh parameter-expansion modifiers under LangBash', async () => {
  // Documents that the same input is (correctly) invalid bash.
  await expect(
    parse(ZSH_SNIPPET, { variant: LangVariant.LangBash }),
  ).rejects.toThrow(/ternary operator missing/)
})
