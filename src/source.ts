const NON_ASCII = /[\u{80}-\u{10FFFF}]/u

/** Converts UTF-8 byte offsets into UTF-16 code-unit offsets for a source string. */
export interface SourceIndex {
  /** Converts a UTF-8 byte offset to a UTF-16 code-unit offset. */
  toUtf16(byteOffset: number): number
}

/**
 * Builds an index from a source string's UTF-8 byte offsets to its UTF-16 code-unit offsets. Byte
 * offsets inside a multi-byte character map to the start of that character; offsets outside the
 * string are clamped.
 */
export const createSourceIndex = (text: string): SourceIndex => {
  const end = text.length

  if (!NON_ASCII.test(text)) {
    return {
      toUtf16: byteOffset => (byteOffset <= 0 ? 0 : byteOffset >= end ? end : byteOffset),
    }
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

  const totalBytes = map.length - 1

  return {
    toUtf16(byteOffset) {
      if (byteOffset <= 0) {
        return 0
      }
      if (byteOffset >= totalBytes) {
        return end
      }
      return map[byteOffset] as number
    },
  }
}
