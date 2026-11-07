import assert from 'node:assert/strict'

import { dispose, parse, print } from './daemon-patch.mjs'

const ast = await parse('echo hi\n', 'x.sh')
assert.equal(await print(ast), 'echo hi\n')

ast.stmts[0].cmd.args[0].parts[0].patch('value', 'bye')
assert.equal(await print(ast), 'bye hi\n')

await dispose(ast)
console.log('daemon patch POC ok')
