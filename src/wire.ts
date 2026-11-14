/**
 * Binary AST wire.
 *
 * Layout: LEB128 varints, a node id for the root and interface values, start/end offsets before
 * each node body, presence bytes for nullable refs, and counts before slices. Non-node records have
 * no type/start/end header. The authoritative field order is src/wire-schema.ts, generated from
 * scripts/gen-ast/binary.go; the envelope lives in processor/result.go.
 */
import { InputError } from './common.js'
import type { File, PrintableNode } from './types.js'
import { WIRE_SCHEMA, WIRE_TYPES, type WireField } from './wire-schema.js'

const VARINT_BASE = 0x80
const VARINT_MASK = 0x7f
const MAX_VARINT_BYTES = 8

const encoder = new TextEncoder()
const decoder = new TextDecoder('utf-8', { ignoreBOM: true })
const NODE_TYPES = new Map<number, string>(
  Object.entries(WIRE_TYPES).map(([name, id]) => [id, name]),
)

class Writer {
  private bytes = new Uint8Array(1024)
  private offset = 0

  private ensure(size: number): void {
    if (this.offset + size <= this.bytes.length) {
      return
    }
    let length = this.bytes.length
    while (length < this.offset + size) {
      length *= 2
    }
    const next = new Uint8Array(length)
    next.set(this.bytes)
    this.bytes = next
  }

  byte(value: number): void {
    this.ensure(1)
    this.bytes[this.offset++] = value
  }

  uint(value: number): void {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new InputError('wire integers must be non-negative safe integers')
    }
    while (value >= VARINT_BASE) {
      this.byte((value & VARINT_MASK) | VARINT_BASE)
      value = Math.floor(value / VARINT_BASE)
    }
    this.byte(value)
  }

  string(value: string): void {
    const bytes = encoder.encode(value)
    this.uint(bytes.byteLength)
    this.ensure(bytes.byteLength)
    this.bytes.set(bytes, this.offset)
    this.offset += bytes.byteLength
  }

  finish(): Uint8Array {
    return this.bytes.slice(0, this.offset)
  }
}

class Reader {
  private position = 0
  private readonly bytes: Uint8Array

  constructor(bytes: Uint8Array) {
    this.bytes = bytes
  }

  get offset(): number {
    return this.position
  }

  get length(): number {
    return this.bytes.length
  }

  byte(): number {
    if (this.position >= this.bytes.length) {
      throw new Error('truncated wire payload')
    }
    return this.bytes[this.position++]!
  }

  uint(): number {
    let value = 0
    let shift = 1
    for (let index = 0; index < MAX_VARINT_BYTES; index++) {
      const byte = this.byte()
      value += (byte & VARINT_MASK) * shift
      if (!Number.isSafeInteger(value)) {
        throw new InputError('wire integer overflow')
      }
      if (byte < VARINT_BASE) {
        return value
      }
      shift *= VARINT_BASE
    }
    throw new Error('invalid wire integer')
  }

  string(): string {
    const length = this.uint()
    if (length > this.bytes.length - this.position) {
      throw new Error('truncated wire string')
    }
    const value = decoder.decode(this.bytes.subarray(this.position, this.position + length))
    this.position += length
    return value
  }

  count(): number {
    const count = this.uint()
    /* istanbul ignore next -- malformed payload guard */
    if (count > this.bytes.length - this.position) {
      throw new Error('wire count exceeds payload')
    }
    return count
  }
}

const writeNode = (writer: Writer, node: unknown, typeName: string): void => {
  const schema = WIRE_SCHEMA[typeName]
  if (node == null || typeof node !== 'object' || !schema?.node) {
    throw new InputError(`wire expects a ${typeName} node`)
  }
  const value = node as Record<string, unknown>
  if (value.type !== typeName) {
    throw new InputError(`wire expected ${typeName}, got ${String(value.type)}`)
  }
  writer.uint(Number(value.start ?? 0))
  writer.uint(Number(value.end ?? 0))
  for (const [name, field] of schema.fields) {
    writeField(writer, value[name], field)
  }
}

const writeTyped = (writer: Writer, value: unknown, typeName: string): void => {
  if (WIRE_SCHEMA[typeName]?.node) {
    writeNode(writer, value, typeName)
  } else {
    if (value == null || typeof value !== 'object') {
      throw new InputError(`wire expects a ${typeName} record`)
    }
    const record = value as Record<string, unknown>
    const fields = WIRE_SCHEMA[typeName]!.fields
    for (const [name, field] of fields) {
      writeField(writer, record[name], field)
    }
  }
}

const writeField = (writer: Writer, value: unknown, field: WireField): void => {
  switch (field.k) {
    case 'string': {
      writer.string(typeof value === 'string' ? value : '')
      break
    }
    case 'bool': {
      writer.byte(value ? 1 : 0)
      break
    }
    case 'uint': {
      writer.uint(Number(value ?? 0))
      break
    }
    case 'pos': {
      const position = (value ?? {}) as {
        offset?: number
        line?: number
        column?: number
        recovered?: boolean
      }
      writer.uint(Number(position.offset ?? 0))
      writer.uint(Number(position.line ?? 0))
      writer.uint(Number(position.column ?? 0))
      writer.byte(position.recovered ? 1 : 0)
      break
    }
    case 'ref': {
      if (field.n) {
        if (value == null) {
          writer.byte(0)
          return
        }
        writer.byte(1)
      }
      writeTyped(writer, value, field.t!)
      break
    }
    case 'iface': {
      if (value == null) {
        writer.uint(0)
        return
      }
      const node = value as { type?: unknown }
      const id = WIRE_TYPES[node.type as string]
      if (!id) {
        throw new InputError(`unknown wire node type: ${String(node.type)}`)
      }
      writer.uint(id)
      writeNode(writer, value, node.type as string)
      break
    }
    case 'slice': {
      const items: unknown[] = Array.isArray(value) ? value : []
      writer.uint(items.length)
      for (const item of items) {
        writeField(writer, item, field.e!)
      }
      break
    }
  }
}

const readNode = (reader: Reader, typeName: string): Record<string, unknown> => {
  const schema = WIRE_SCHEMA[typeName]!
  const node: Record<string, unknown> = {
    type: typeName,
    start: reader.uint(),
    end: reader.uint(),
  }
  for (const [name, field] of schema.fields) {
    node[name] = readField(reader, field)
  }
  return node
}

const readTyped = (reader: Reader, typeName: string): unknown => {
  if (WIRE_SCHEMA[typeName]?.node) {
    return readNode(reader, typeName)
  }
  const record: Record<string, unknown> = {}
  const fields = WIRE_SCHEMA[typeName]!.fields
  for (const [name, field] of fields) {
    record[name] = readField(reader, field)
  }
  return record
}

const readField = (reader: Reader, field: WireField): unknown => {
  switch (field.k) {
    case 'string':
      return reader.string()
    case 'bool':
      return reader.byte() !== 0
    case 'uint':
      return reader.uint()
    case 'pos': {
      const offset = reader.uint()
      const line = reader.uint()
      const column = reader.uint()
      const recovered = reader.byte() !== 0
      return recovered ? { offset, line, column, recovered: true } : { offset, line, column }
    }
    case 'ref': {
      if (field.n && reader.byte() === 0) {
        return null
      }
      return readTyped(reader, field.t!)
    }
    case 'iface': {
      const id = reader.uint()
      if (id === 0) {
        return null
      }
      const typeName = NODE_TYPES.get(id)
      /* istanbul ignore next -- schema/id mismatch guard */
      if (!typeName) {
        throw new Error(`unknown wire node id: ${id}`)
      }
      return readNode(reader, typeName)
    }
    case 'slice': {
      const count = reader.count()
      const items: unknown[] = []
      for (let index = 0; index < count; index++) {
        items.push(readField(reader, field.e!))
      }
      return items
    }
  }
}

/** Encodes the current JS AST as the compact binary wire. */
export const encodeAST = (ast: PrintableNode): Uint8Array => {
  if (ast == null || !WIRE_SCHEMA[ast.type]?.node) {
    throw new InputError('print(node) requires a syntax node')
  }
  const writer = new Writer()
  writer.uint(WIRE_TYPES[ast.type]!)
  writeNode(writer, ast, ast.type)
  return writer.finish()
}

/** Decodes a binary AST payload into plain JS objects. */
export const decodeAST = (bytes: Uint8Array): File => {
  const reader = new Reader(bytes)
  const id = reader.uint()
  const typeName = NODE_TYPES.get(id)
  if (!typeName) {
    throw new Error(`unknown wire node id: ${id}`)
  }
  const node = readNode(reader, typeName)
  if (reader.offset !== reader.length) {
    throw new Error('unexpected trailing wire data')
  }
  return node as unknown as File
}
