import {
  LangVariant,
  ParseError,
  debugPrint,
  isIncomplete,
  walk,
  parseSync,
  printSync,
} from 'sh-syntax'
import type { Word } from 'sh-syntax'

test('sync parser returns the full typed tree', () => {
  const ast = parseSync('echo hi # note\n', {
    keepComments: true,
    filepath: 'test.sh',
  })

  expect(ast.type).toBe('File')
  expect(ast.start).toBe(0)
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
  walk(ast, node => {
    types.push(node.type)
    return true
  })
  expect(types).toContain('CallExpr')
  expect(types).toContain('Comment')
  expect(types).toContain('Lit')
})

test('rejects non-text input', () => {
  expect(() => parseSync(null as never)).toThrow(TypeError)
})

test('print(ast, { originalText }) ignores the AST', () => {
  const ast = parseSync('echo old\n')
  const call = ast.stmts[0].cmd as unknown as { args: Word[] }
  const literal = call.args[0].parts[0] as unknown as { value: string }
  literal.value = 'new'

  expect(printSync(ast, { originalText: 'echo  old\n' })).toBe('echo old\n')
  expect(() => printSync(ast, {} as never)).toThrow(TypeError)
})

test('print formats text', () => {
  expect(printSync('echo  old\n')).toBe('echo old\n')
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
  const ast = parseSync('echo hi\n')
  const types: string[] = []
  walk(ast, node => {
    types.push(node.type)
    return node !== ast
  })
  expect(types).toEqual(['File'])

  const log = vi.spyOn(console, 'log').mockImplementation(() => 0)
  debugPrint(ast)
  expect(log).toHaveBeenCalled()
  log.mockRestore()

  expect(isIncomplete(new ParseError({ incomplete: true, text: 'x' }))).toBe(
    true,
  )
  expect(isIncomplete(null)).toBe(false)
})
