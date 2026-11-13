import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const esmSync = await import('../lib/sync/index.js')
const cjsSync = require('../lib/sync/index.cjs')
for (const api of [esmSync, cjsSync]) {
  const ast = api.parse('echo hi\n')
  if (api.print(ast) !== 'echo hi\n') {
    throw new Error('built sync entry failed')
  }
}

const esmAsync = await import('../lib/index.js')
const ast = await esmAsync.parse('echo hi\n')
if ((await esmAsync.print(ast)) !== 'echo hi\n') {
  throw new Error('built async entry failed')
}

console.log('built ESM/CJS smoke test passed')
