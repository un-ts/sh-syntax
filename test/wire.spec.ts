// oxlint-disable no-magic-numbers, vitest/require-to-throw-message -- byte-level wire fixtures
import { parse } from 'sh-syntax/sync'

import { decodeAST, encodeAST } from '../src/wire.js'

const ast = parse('echo "héllo" # note\n')

test('binary wire round-trips the full tree', () => {
  expect(decodeAST(encodeAST(ast))).toEqual(ast)
})

test('binary wire rejects invalid output values', () => {
  const invalid = structuredClone(ast) as unknown as { type: string; start: number }
  invalid.start = -1
  expect(() => encodeAST(invalid as never)).toThrow(TypeError)

  const wrongRoot = structuredClone(ast) as unknown as { type: string }
  wrongRoot.type = 'Nope'
  expect(() => encodeAST(wrongRoot as never)).toThrow(TypeError)

  const wrongNode = structuredClone(ast) as unknown as {
    stmts: { cmd: { type: string } }[]
  }
  wrongNode.stmts[0]!.cmd.type = 'Nope'
  expect(() => encodeAST(wrongNode as never)).toThrow(TypeError)

  const invalidRecord = structuredClone(ast) as unknown as { stmts: unknown[] }
  invalidRecord.stmts[0] = 42
  expect(() => encodeAST(invalidRecord as never)).toThrow(TypeError)
})

test('binary wire grows for large payloads and preserves unicode', () => {
  const text = `echo '${'é'.repeat(4096)}'\n`
  const large = parse(text)
  expect(decodeAST(encodeAST(large))).toEqual(large)
})

test('binary wire rejects malformed payloads', () => {
  expect(() => decodeAST(new Uint8Array())).toThrow()
  expect(() => decodeAST(new Uint8Array([0xff]))).toThrow()
  expect(() => decodeAST(new Uint8Array([1, 0]))).toThrow()
  expect(() => decodeAST(new Uint8Array([21, 0, 0]))).toThrow()
  expect(() => decodeAST(new Uint8Array([21, 0, 0, 1]))).toThrow()
  expect(() => decodeAST(new Uint8Array([21, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0]))).toThrow()
})

test('binary wire rejects unknown ids and truncated strings', () => {
  const bytes = encodeAST(ast)
  expect(() => decodeAST(bytes.subarray(0, bytes.length - 1))).toThrow()
  expect(() => decodeAST(new Uint8Array([0]))).toThrow()
})

test('binary wire rejects overflow and malformed counts', () => {
  const invalid = structuredClone(ast) as unknown as { start: number }
  invalid.start = Number.MAX_SAFE_INTEGER + 1
  expect(() => encodeAST(invalid as never)).toThrow(TypeError)

  const nullCmd = structuredClone(ast) as unknown as { stmts: { cmd: unknown }[] }
  nullCmd.stmts[0]!.cmd = null
  expect(decodeAST(encodeAST(nullCmd as never))).toBeDefined()

  expect(() =>
    decodeAST(new Uint8Array([0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80])),
  ).toThrow()
  expect(() => decodeAST(new Uint8Array([21, 0, 0, 0, 0xff]))).toThrow()
  expect(() => decodeAST(new Uint8Array([255]))).toThrow()
})

test('binary wire handles nullable refs and operator fields', () => {
  const assign = parse('a=1\n')
  const command = assign.stmts[0]!.cmd
  if (command?.type !== 'CallExpr' || command.assigns[0]?.name == null) {
    throw new Error('expected assign')
  }
  ;(command.assigns[0] as { name: unknown }).name = null
  expect(decodeAST(encodeAST(assign))).toEqual(assign)

  const redirect = parse('echo hi >out\n')
  expect(decodeAST(encodeAST(redirect))).toEqual(redirect)
})

test('binary wire handles auxiliary syntax records', () => {
  const arithmetic = parse('echo $((1 + 2))\n')
  expect(decodeAST(encodeAST(arithmetic))).toEqual(arithmetic)
  const parameter = parse('echo ${x:1:2}\n')
  expect(decodeAST(encodeAST(parameter))).toEqual(parameter)
  const array = parse('a=(1 2)\n')
  expect(decodeAST(encodeAST(array))).toEqual(array)
})

test('binary wire rejects malformed counters and unsafe varints', () => {
  expect(() =>
    decodeAST(new Uint8Array([0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x7f])),
  ).toThrow()
  expect(() => decodeAST(new Uint8Array([21, 0, 0, 0, 0, 0xff]))).toThrow()
})

test('binary wire rejects invalid auxiliary records', () => {
  const parameter = parse('echo ${x:1:2}\n') as unknown as {
    stmts: { cmd: { args: { parts: { exp?: unknown }[] }[] } }[]
  }
  parameter.stmts[0]!.cmd.args[1]!.parts[0]!.exp = 42
  expect(() => encodeAST(parameter as never)).toThrow(TypeError)
})

test('binary wire rejects an unknown root id', () => {
  expect(() => decodeAST(new Uint8Array([100]))).toThrow('unknown wire node id')
})

test('binary wire fills missing scalar fields', () => {
  const partial = structuredClone(ast) as unknown as {
    start?: number
    end?: number
    name?: unknown
    stmts: {
      position?: unknown
      redirs?: unknown
      cmd?: { type?: string; args?: { parts?: unknown }[] }
    }[]
  }
  partial.start = undefined
  partial.end = undefined
  partial.name = 42
  partial.stmts[0]!.position = null
  partial.stmts[0]!.redirs = null
  expect(decodeAST(encodeAST(partial as never))).toBeDefined()
})

test('binary wire covers boolean, operator, and recovered positions', () => {
  expect(decodeAST(encodeAST(parse('! echo hi\n')))).toBeDefined()
  const redirect = parse('echo hi >out\n') as unknown as {
    stmts: { redirs: { op: unknown }[] }[]
  }
  redirect.stmts[0]!.redirs[0]!.op = null
  expect(decodeAST(encodeAST(redirect as never))).toBeDefined()
  const recovered = structuredClone(ast) as unknown as {
    stmts: { position: { recovered: boolean } }[]
  }
  recovered.stmts[0]!.position.recovered = true
  expect(decodeAST(encodeAST(recovered as never))).toBeDefined()
})

test('binary wire preserves a leading BOM in strings', () => {
  const source = "echo '\u{FEFF}value'\n"
  expect(decodeAST(encodeAST(parse(source)))).toEqual(parse(source))
})
