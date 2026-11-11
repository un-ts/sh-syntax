const NON_ASCII = /[\u{80}-\u{10FFFF}]/u
const MAX_CODE_POINT_BYTES = 4

/**
 * Builds a converter from a source string's UTF-8 byte offsets to UTF-16 code-unit offsets. Byte
 * offsets inside a multi-byte character map to the start of that character; offsets outside the
 * string are clamped.
 */
export const createSourceIndex = (text: string): ((byteOffset: number) => number) => {
  const end = text.length

  if (!NON_ASCII.test(text)) {
    return byteOffset => Math.min(Math.max(byteOffset, 0), end)
  }

  const encoder = new TextEncoder()
  const buffer = new Uint8Array(MAX_CODE_POINT_BYTES)
  const map: number[] = []
  let charIndex = 0

  for (const char of text) {
    const { written: byteLength } = encoder.encodeInto(char, buffer)
    for (let i = 0; i < byteLength; i++) {
      map.push(charIndex)
    }
    charIndex += char.length
  }
  map.push(charIndex)

  return byteOffset => {
    if (byteOffset <= 0) {
      return 0
    }
    return map[byteOffset] ?? end
  }
}
