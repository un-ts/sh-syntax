const NON_ASCII = /[\u{80}-\u{10FFFF}]/u

/**
 * Builds a converter from a source string's UTF-8 byte offsets to UTF-16 code-unit offsets. Byte
 * offsets inside a multi-byte character map to the start of that character; offsets outside the
 * string are clamped.
 */
export const createSourceIndex = (text: string): ((byteOffset: number) => number) => {
  const end = text.length

  if (!NON_ASCII.test(text)) {
    return byteOffset => (byteOffset <= 0 ? 0 : byteOffset >= end ? end : byteOffset)
  }

  const encoder = new TextEncoder()
  const map: number[] = []
  let charIndex = 0

  for (const char of text) {
    const byteLength = encoder.encode(char).length
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
