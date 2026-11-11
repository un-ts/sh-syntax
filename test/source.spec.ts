import { createSourceIndex, parseSync } from 'sh-syntax'

test('ASCII offsets are unchanged and clamped', () => {
  const text = 'echo hi\n'
  const end = text.length
  const index = createSourceIndex(text)

  expect(index.toUtf16(0)).toBe(0)
  expect(index.toUtf16(end - 1)).toBe(end - 1)
  expect(index.toUtf16(end)).toBe(end)
  expect(index.toUtf16(end + 1)).toBe(end)
  expect(index.toUtf16(-1)).toBe(0)
})

test('BMP and astral characters convert to UTF-16 offsets', () => {
  const eAcute = 'é'
  const emoji = '🎉'
  const text = `${eAcute}${emoji}x`
  const encoder = new TextEncoder()
  const eAcuteBytes = encoder.encode(eAcute).length
  const emojiBytes = encoder.encode(emoji).length
  const afterEmoji = eAcuteBytes + emojiBytes
  const totalBytes = encoder.encode(text).length
  const emojiStart = eAcute.length
  const afterEmojiInUtf16 = emojiStart + emoji.length
  const index = createSourceIndex(text)

  expect(index.toUtf16(0)).toBe(0)
  expect(index.toUtf16(eAcuteBytes - 1)).toBe(0)
  expect(index.toUtf16(eAcuteBytes)).toBe(emojiStart)
  expect(index.toUtf16(afterEmoji - 1)).toBe(emojiStart)
  expect(index.toUtf16(afterEmoji)).toBe(afterEmojiInUtf16)
  expect(index.toUtf16(afterEmoji + 1)).toBe(text.length)
  expect(index.toUtf16(totalBytes + 1)).toBe(text.length)
})

test('three-byte characters convert to UTF-16 offsets', () => {
  const euro = '€'
  const bytes = new TextEncoder().encode(euro).length
  const index = createSourceIndex(euro)

  expect(index.toUtf16(0)).toBe(0)
  expect(index.toUtf16(bytes)).toBe(euro.length)
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
