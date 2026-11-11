import { createSourceIndex, parseSync } from 'sh-syntax'

test('ASCII offsets are unchanged and clamped', () => {
  const index = createSourceIndex('echo hi\n')

  expect(index.toUtf16(0)).toBe(0)
  expect(index.toUtf16(7)).toBe(7)
  expect(index.toUtf16(8)).toBe(8)
  expect(index.toUtf16(100)).toBe(8)
  expect(index.toUtf16(-1)).toBe(0)
})

test('BMP and astral characters convert to UTF-16 offsets', () => {
  const text = 'é🎉x'
  const index = createSourceIndex(text)

  expect(index.toUtf16(0)).toBe(0)
  expect(index.toUtf16(1)).toBe(0)
  expect(index.toUtf16(2)).toBe(1)
  expect(index.toUtf16(5)).toBe(1)
  expect(index.toUtf16(6)).toBe(3)
  expect(index.toUtf16(7)).toBe(4)
  expect(index.toUtf16(8)).toBe(4)
})

test('three-byte characters convert to UTF-16 offsets', () => {
  const index = createSourceIndex('€')
  expect(index.toUtf16(0)).toBe(0)
  expect(index.toUtf16(3)).toBe(1)
})

test('parsed node offsets map back to source text', () => {
  const text = 'echo "héllo 🎉" $var\n'
  const ast = parseSync(text)
  const command = ast.stmts[0]?.cmd
  const word = command?.type === 'CallExpr' ? command.args.at(-1) : null
  const index = createSourceIndex(text)

  expect(word?.type).toBe('Word')
  expect(text.slice(index.toUtf16(word?.start ?? 0), index.toUtf16(word?.end ?? 0))).toBe('$var')
})
