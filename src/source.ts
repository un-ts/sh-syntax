const NON_ASCII = /[\u{80}-\u{10FFFF}]/u

/** Converts UTF-8 byte offsets into UTF-16 code-unit offsets for a source string. */
export interface SourceIndex {
  /** Converts a UTF-8 byte offset to a UTF-16 code-unit offset. */
  toUtf16(byteOffset: number): number
}

const ONE_BYTE = 1
const TWO_BYTES = 2
const THREE_BYTES = 3
const FOUR_BYTES = 4
const ONE_BYTE_MAX = 0x7f
const TWO_BYTE_MAX = 0x7ff
const THREE_BYTE_MAX = 0xffff

const utf8Length = (codePoint: number): number =>
  codePoint <= ONE_BYTE_MAX
    ? ONE_BYTE
    : codePoint <= TWO_BYTE_MAX
      ? TWO_BYTES
      : codePoint <= THREE_BYTE_MAX
        ? THREE_BYTES
        : FOUR_BYTES

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

  const byteOffsets: number[] = [0]
  const utf16Offsets: number[] = [0]
  let byteOffset = 0
  let utf16Offset = 0

  for (const char of text) {
    byteOffset += utf8Length(char.codePointAt(0) as number)
    utf16Offset += char.length
    byteOffsets.push(byteOffset)
    utf16Offsets.push(utf16Offset)
  }

  const totalBytes = byteOffsets.at(-1) as number

  return {
    toUtf16(offset) {
      if (offset <= 0) {
        return 0
      }
      if (offset >= totalBytes) {
        return end
      }

      let low = 0
      let high = byteOffsets.length - 1

      while (low + 1 < high) {
        const middle = (low + high) >>> 1
        if ((byteOffsets[middle] as number) <= offset) {
          low = middle
        } else {
          high = middle
        }
      }

      return utf16Offsets[low] as number
    },
  }
}
