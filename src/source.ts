const MAX_CODE_POINT_BYTES = 4
const ONE_BYTE_LEAD_MAX = 0x7f
const TWO_BYTE_LEAD_MAX = 0xdf
const THREE_BYTE_LEAD_MAX = 0xef

/**
 * Builds a converter from a source string's UTF-8 byte offsets to UTF-16 code-unit offsets. Byte
 * offsets inside a multi-byte character map to the start of that character; offsets outside the
 * string are clamped.
 */
export const createSourceIndex = (text: string): ((byteOffset: number) => number) => {
  const end = text.length
  const bytes = new TextEncoder().encode(text)

  if (bytes.length === end) {
    return byteOffset => Math.min(Math.max(byteOffset, 0), end)
  }

  const map = new Uint32Array(bytes.length + 1)
  let codeUnit = 0

  for (let i = 0; i < bytes.length;) {
    const lead = bytes[i] as number

    if (lead <= ONE_BYTE_LEAD_MAX) {
      map[i] = codeUnit
      codeUnit += 1
      i += 1
      continue
    }

    let byteLength = MAX_CODE_POINT_BYTES
    if (lead <= TWO_BYTE_LEAD_MAX) {
      byteLength = 2
    } else if (lead <= THREE_BYTE_LEAD_MAX) {
      byteLength = 3
    }

    map.fill(codeUnit, i, i + byteLength)
    codeUnit += byteLength >> 1
    i += byteLength
  }

  map[bytes.length] = codeUnit

  return byteOffset => {
    if (byteOffset <= 0) {
      return 0
    }
    return map[byteOffset] ?? end
  }
}
