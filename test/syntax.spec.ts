import {
  DebugPrint,
  IsIncomplete,
  LangVariant,
  NodeType,
  ParseError,
  Walk,
  parseSync,
  printSync,
  processor,
} from 'sh-syntax'
import type { File, Word } from 'sh-syntax'

test('sync parser returns the full typed tree', () => {
  const ast = parseSync('echo hi # note\n', {
    keepComments: true,
    filepath: 'test.sh',
  })

  expect(NodeType(ast)).toBe('File')
  expect(ast.start).toBe(0)
  expect(ast.type).toBe('File')
  expect(ast.stmts).toHaveLength(1)
  expect(ast.stmts[0].position.offset).toBe(0)
  expect(ast.stmts[0].comments[0].text).toBe(' note')

  const call = ast.stmts[0].cmd as unknown as { args: Word[] }
  const literal = call.args[0].parts[0] as unknown as {
    value?: string
  }
  expect(literal.value).toBe('echo')
  expect(call.args[0].start).toBe(0)

  const types: string[] = []
  Walk(ast, node => {
    types.push(NodeType(node))
    return true
  })
  expect(types).toContain('CallExpr')
  expect(types).toContain('Comment')
  expect(types).toContain('Lit')
})

test('sync printer prints a mutated AST', () => {
  const ast = parseSync('echo old\n')
  const call = ast.stmts[0].cmd as unknown as { args: Word[] }
  const literal = call.args[1].parts[0] as unknown as { value: string }
  literal.value = 'new'

  expect(printSync(ast)).toBe('echo new\n')
  expect(printSync('echo  old\n')).toBe('echo old\n')
})

test('printer options are applied to an AST', () => {
  const ast = parseSync('if true;then echo hi >out;fi\n')
  const defaults = {
    binaryNextLine: false,
    switchCaseIndent: false,
    spaceRedirects: false,
  }

  expect(printSync(ast, defaults)).toBe('if true; then echo hi >out; fi\n')
  expect(printSync(ast, { ...defaults, spaceRedirects: true })).toBe(
    'if true; then echo hi > out; fi\n',
  )
})

test('parse errors expose position and incompleteness', () => {
  const parseError = (() => {
    try {
      parseSync('echo )')
    } catch (error) {
      return error as ParseError
    }
    throw new Error('expected parseSync to throw')
  })()

  expect(parseError).toBeInstanceOf(ParseError)
  expect(parseError.message.length).toBeGreaterThan(0)
  expect(parseError.pos?.offset).toBe(5)
  expect(parseError.incomplete).toBe(false)
})

test('lang variants are exported', () => {
  expect(LangVariant.LangBash).toBe(1)
  expect(LangVariant.LangPOSIX).toBe(2)
  // eslint-disable-next-line @typescript-eslint/no-magic-numbers -- public enum value
  expect(LangVariant.LangMirBSDKorn).toBe(4)
})

test('tree helpers handle edge cases', () => {
  expect(NodeType(null)).toBe('nil')
  expect(
    NodeType({ type: 'File' } as unknown as Parameters<typeof NodeType>[0]),
  ).toBe('File')
  expect(NodeType({} as unknown as Parameters<typeof NodeType>[0])).toBe('')

  const ast = parseSync('echo hi\n')
  const types: string[] = []
  Walk(ast, node => {
    types.push(NodeType(node))
    return node !== ast
  })
  expect(types).toEqual(['File'])

  const log = vi.spyOn(console, 'log').mockImplementation(() => 0)
  DebugPrint(ast)
  expect(log).toHaveBeenCalled()
  log.mockRestore()

  expect(IsIncomplete(new ParseError({ incomplete: true, text: 'x' }))).toBe(
    true,
  )
  expect(IsIncomplete(null)).toBe(false)
})

test('prints non-File roots and rejects originalText', async () => {
  const ast = parseSync('echo old\n')
  const stmt = ast.stmts[0] as unknown as File
  expect(printSync(stmt)).toBe('echo old')

  expect(() => printSync({} as File)).toThrow(SyntaxError)
  await expect(
    processor(ast, { originalText: 'echo old\n' } as never),
  ).rejects.toThrow(TypeError)
  expect(() => printSync(ast, { originalText: 'echo old\n' } as never)).toThrow(
    TypeError,
  )
})
