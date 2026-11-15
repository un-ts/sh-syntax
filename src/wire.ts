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
import {
  WIRE_SCHEMA,
  WIRE_TYPES,
  type WireField,
  type WireNodeName,
  type WireTypeName,
} from './wire-schema.js'

const VARINT_BASE = 0x80
const VARINT_MASK = 0x7f
const MAX_VARINT_BYTES = 8

const encoder = new TextEncoder()
const decoder = new TextDecoder('utf-8', { ignoreBOM: true })
const NODE_TYPES = new Map<number, WireNodeName>(
  Object.entries(WIRE_TYPES).map(([name, id]) => [id, name as WireNodeName]),
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
        // Wires come from the decoder; this is not caller input, so keep it out of InputError.
        throw new TypeError('wire integer overflow')
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

type WriteTask =
  | { kind: 'node'; value: unknown; typeName: WireTypeName }
  | { kind: 'typed'; value: unknown; typeName: WireTypeName }
  | { kind: 'field'; value: unknown; field: WireField }

const pushFields = (
  stack: WriteTask[],
  value: Record<string, unknown>,
  fields: readonly (readonly [string, WireField])[],
): void => {
  for (let index = fields.length - 1; index >= 0; index--) {
    const [name, field] = fields[index]!
    stack.push({ kind: 'field', value: value[name], field })
  }
}

const writeNodeTask = (
  writer: Writer,
  stack: WriteTask[],
  task: Extract<WriteTask, { kind: 'node' }>,
): void => {
  const { typeName, value } = task
  const schema = WIRE_SCHEMA[typeName]
  if (value == null || typeof value !== 'object' || !schema?.node) {
    throw new InputError(`wire expects a ${typeName} node`)
  }
  const record = value as Record<string, unknown>
  if (record.type !== typeName) {
    throw new InputError(`wire expected ${typeName}, got ${String(record.type)}`)
  }
  writer.uint(Number(record.start ?? 0))
  writer.uint(Number(record.end ?? 0))
  pushFields(stack, record, schema.fields)
}

const writeFieldTask = (
  writer: Writer,
  stack: WriteTask[],
  task: Extract<WriteTask, { kind: 'field' }>,
): void => {
  const { field, value } = task
  switch (field.k) {
    case 'string': {
      writer.string(typeof value === 'string' ? value : '')
      return
    }
    case 'bool': {
      writer.byte(value ? 1 : 0)
      return
    }
    case 'uint': {
      writer.uint(Number(value ?? 0))
      return
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
      return
    }
    case 'ref': {
      if (field.n) {
        if (value == null) {
          writer.byte(0)
          return
        }
        writer.byte(1)
      }
      stack.push({ kind: 'typed', value, typeName: field.t })
      return
    }
    case 'iface': {
      if (value == null) {
        writer.uint(0)
        return
      }
      const node = value as { type?: unknown }
      const id = WIRE_TYPES[node.type as WireNodeName]
      if (!id) {
        throw new InputError(`unknown wire node type: ${String(node.type)}`)
      }
      writer.uint(id)
      stack.push({ kind: 'node', value, typeName: node.type as WireNodeName })
      return
    }
    case 'slice': {
      const items: unknown[] = Array.isArray(value) ? value : []
      writer.uint(items.length)
      for (let index = items.length - 1; index >= 0; index--) {
        stack.push({ kind: 'field', value: items[index], field: field.e })
      }
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
  const stack: WriteTask[] = [{ kind: 'node', value: ast, typeName: ast.type }]
  while (stack.length > 0) {
    const task = stack.pop()!
    if (task.kind === 'node') {
      writeNodeTask(writer, stack, task)
      continue
    }
    if (task.kind === 'typed') {
      if (WIRE_SCHEMA[task.typeName]?.node) {
        stack.push({ kind: 'node', value: task.value, typeName: task.typeName })
        continue
      }
      if (task.value == null || typeof task.value !== 'object') {
        throw new InputError(`wire expects a ${task.typeName} record`)
      }
      const record = task.value as Record<string, unknown>
      pushFields(stack, record, WIRE_SCHEMA[task.typeName]!.fields)
      continue
    }

    writeFieldTask(writer, stack, task)
  }
  return writer.finish()
}

interface ObjectFrame {
  kind: 'object'
  value: Record<string, unknown>
  fields: readonly (readonly [string, WireField])[]
  index: number
  assign: (value: unknown) => void
}

interface SliceFrame {
  kind: 'slice'
  values: unknown[]
  field: WireField
  remaining: number
  assign: (value: unknown) => void
}

type ReadFrame = ObjectFrame | SliceFrame

interface ReaderState {
  frames: ReadFrame[]
  reader: Reader
  startObject: (typeName: WireTypeName, assign: (value: unknown) => void) => void
  readValue: (field: WireField, assign: (value: unknown) => void) => void
}

const readScalar = (reader: Reader, field: WireField): unknown => {
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
    /* istanbul ignore next -- caller only passes scalar fields */
    default:
      throw new Error('unexpected wire scalar field')
  }
}

const readValue = (
  state: ReaderState,
  field: WireField,
  assign: (value: unknown) => void,
): void => {
  if (field.k === 'ref') {
    if (field.n && state.reader.byte() === 0) {
      assign(null)
      return
    }
    state.startObject(field.t!, assign)
    return
  }
  if (field.k === 'iface') {
    const id = state.reader.uint()
    if (id === 0) {
      assign(null)
      return
    }
    const typeName = NODE_TYPES.get(id)
    /* istanbul ignore next -- schema/id mismatch guard */
    if (!typeName) {
      throw new Error(`unknown wire node id: ${id}`)
    }
    state.startObject(typeName, assign)
    return
  }
  if (field.k === 'slice') {
    const count = state.reader.count()
    const values: unknown[] = []
    if (count === 0) {
      assign(values)
      return
    }
    state.frames.push({
      kind: 'slice',
      values,
      field: field.e!,
      remaining: count,
      assign,
    })
    return
  }
  assign(readScalar(state.reader, field))
}

/** Decodes a binary AST payload into plain JS objects. */
export const decodeAST = (bytes: Uint8Array): File => {
  const reader = new Reader(bytes)
  const rootID = reader.uint()
  const rootType = NODE_TYPES.get(rootID)
  if (!rootType) {
    throw new Error(`unknown wire node id: ${rootID}`)
  }
  const state: ReaderState = {
    frames: [],
    reader,
    startObject: (typeName, assign) => {
      const schema = WIRE_SCHEMA[typeName]!
      const value: Record<string, unknown> = schema.node
        ? { type: typeName, start: reader.uint(), end: reader.uint() }
        : {}
      state.frames.push({ kind: 'object', value, fields: schema.fields, index: 0, assign })
    },
    readValue: (field, assign) => readValue(state, field, assign),
  }
  let root: unknown
  state.startObject(rootType, value => {
    root = value
  })

  while (state.frames.length > 0) {
    const frame = state.frames[state.frames.length - 1]!
    if (frame.kind === 'slice') {
      if (frame.remaining === 0) {
        state.frames.pop()
        frame.assign(frame.values)
        continue
      }
      frame.remaining -= 1
      state.readValue(frame.field, value => {
        frame.values.push(value)
      })
      continue
    }
    if (frame.index >= frame.fields.length) {
      state.frames.pop()
      frame.assign(frame.value)
      continue
    }
    const [name, field] = frame.fields[frame.index++]!
    state.readValue(field, value => {
      frame.value[name] = value
    })
  }

  if (reader.offset !== reader.length) {
    throw new Error('unexpected trailing wire data')
  }
  return root as File
}
