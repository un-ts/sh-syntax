import { createSourceIndex, parseSync } from 'sh-syntax'

test('ASCII offsets are unchanged and clamped', () => {
  const text = 'echo hi\n'
  const end = text.length
  const index = createSourceIndex(text)

  expect(index(0)).toBe(0)
  expect(index(end - 1)).toBe(end - 1)
  expect(index(end)).toBe(end)
  expect(index(end + 1)).toBe(end)
  expect(index(-1)).toBe(0)
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

  expect(index(0)).toBe(0)
  expect(index(eAcuteBytes - 1)).toBe(0)
  expect(index(eAcuteBytes)).toBe(emojiStart)
  expect(index(afterEmoji - 1)).toBe(emojiStart)
  expect(index(afterEmoji)).toBe(afterEmojiInUtf16)
  expect(index(afterEmoji + 1)).toBe(text.length)
  expect(index(totalBytes + 1)).toBe(text.length)
})

test('three-byte characters convert to UTF-16 offsets', () => {
  const euro = '€'
  const bytes = new TextEncoder().encode(euro).length
  const index = createSourceIndex(euro)

  expect(index(0)).toBe(0)
  expect(index(bytes)).toBe(euro.length)
})

test('parsed node offsets map back to source text', () => {
  const text = 'echo "héllo 🎉" $var\n'
  const ast = parseSync(text)
  const command = ast.stmts[0]?.cmd
  const word = command?.type === 'CallExpr' ? command.args.at(-1) : null
  const index = createSourceIndex(text)

  expect(word?.type).toBe('Word')
  expect(text.slice(index(word?.start ?? 0), index(word?.end ?? 0))).toBe('$var')
})
