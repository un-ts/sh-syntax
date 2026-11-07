import {
  LangVariant,
  ParNamesOperator,
  ParseError,
  RedirOperator,
  isIncomplete,
  parse,
  parseSync,
  print,
  printSync,
  processor,
  walk,
} from 'sh-syntax'

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

  const call = ast.stmts[0].cmd
  expect(call?.type).toBe('CallExpr')
  if (call?.type !== 'CallExpr') {
    throw new Error('expected a call expression')
  }
  const literal = call.args[0].parts[0]
  expect(literal.type).toBe('Lit')
  if (literal.type !== 'Lit') {
    throw new Error('expected a literal')
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

test('print(ast, { originalText }) ignores the AST', async () => {
  const ast = parseSync('echo old\n')
  const call = ast.stmts[0].cmd
  if (call?.type !== 'CallExpr') {
    throw new Error('expected a call expression')
  }
  const literal = call.args[0].parts[0]
  if (literal.type !== 'Lit') {
    throw new Error('expected a literal')
  }
  literal.value = 'new'

  expect(printSync(ast, { originalText: 'echo  old\n' })).toBe('echo old\n')
  await expect(print(ast, { originalText: 'echo  old\n' })).resolves.toBe(
    'echo old\n',
  )
  expect(() => printSync(ast, {} as never)).toThrow(TypeError)
})

test('processor(ast, { originalText }) ignores the AST', async () => {
  const ast = parseSync('echo old\n')
  await expect(processor(ast, { originalText: 'echo  old\n' })).resolves.toBe(
    'echo old\n',
  )
  await expect(processor(ast, {} as never)).rejects.toThrow(TypeError)
})

test('ParNamesOperator has a zero value', () => {
  const ast = parseSync('echo $foo\n')
  const command = ast.stmts[0].cmd
  if (command?.type !== 'CallExpr') {
    throw new Error('expected a call expression')
  }
  const part = command.args[1].parts[0]
  if (part.type !== 'ParamExp') {
    throw new Error('expected a parameter expansion')
  }
  expect(part.names).toBe(ParNamesOperator.None)
})

test('operator constants match the AST', () => {
  const ast = parseSync('echo hi > out\n')
  expect(ast.stmts[0].redirs[0]?.op).toBe(RedirOperator.RdrOut)
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

test('language errors become SyntaxError', async () => {
  await expect(
    parse('foo <<<input', { variant: LangVariant.LangPOSIX }),
  ).rejects.toBeInstanceOf(SyntaxError)
})

test('recoverErrors marks recovered positions', () => {
  const ast = parseSync('(foo |\n', { recoverErrors: 2 })
  expect(JSON.stringify(ast)).toContain('"recovered":true')
})

test('unsupported variants are rejected', () => {
  expect(() => parseSync('echo hi', { variant: LangVariant.LangAuto })).toThrow(
    TypeError,
  )
  expect(() => parseSync('echo hi', { variant: 0 })).toThrow(TypeError)
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

  expect(isIncomplete(new ParseError({ incomplete: true, text: 'x' }))).toBe(
    true,
  )
  expect(isIncomplete(null)).toBe(false)
})
