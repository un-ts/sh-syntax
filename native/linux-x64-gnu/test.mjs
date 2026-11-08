import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const binding = require('./build/Release/sh_syntax_binding.node')

const result = JSON.parse(binding.parse('echo hi\n', 'test.sh'))
assert.equal(result.ok, true)
assert.equal(result.ast.type, 'File')
assert.equal(result.ast.stmts[0].cmd.type, 'CallExpr')
result.ast.stmts[0].cmd.args[0].parts[0].value = 'bye'

const printed = JSON.parse(binding.printAst(JSON.stringify(result.ast)))
assert.equal(printed.ok, true)
assert.equal(printed.text, 'bye hi\n')

console.log('native addon parse/printAst ok:', printed.text.trim())
