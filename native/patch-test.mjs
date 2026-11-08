import assert from 'node:assert/strict'

import { dispose, parse, print } from './patch.mjs'

const ast = parse('echo hi\n', 'x.sh')
assert.equal(print(ast), 'echo hi\n')

ast.stmts[0].cmd.args[0].parts[0].patch('value', 'bye')
assert.equal(print(ast), 'bye hi\n')

ast.stmts[0].patch('negated', true)
assert.equal(print(ast), '! bye hi\n')

dispose(ast)
console.log('patch POC ok')
