import fs from 'node:fs'

import * as daemon from './daemon-patch.mjs'
import * as napi from './patch.mjs'

const text = fs.readFileSync('test/fixtures/install.sh', 'utf8')
const firstLit = value => {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = firstLit(item)
      if (found) {
        return found
      }
    }
  } else if (value && typeof value === 'object') {
    if (value.type === 'Lit') {
      return value
    }
    for (const child of Object.values(value)) {
      const found = firstLit(child)
      if (found) {
        return found
      }
    }
  }
  return null
}

const run = async (name, parse, print, dispose) => {
  const ast = await parse(text, 'bench.sh')
  const lit = firstLit(ast)
  for (let i = 0; i < 3; i++) {
    lit.patch('value', i % 2 === 0 ? 'x' : 'y')
    await print(ast)
  }
  const start = performance.now()
  for (let i = 0; i < 10; i++) {
    lit.patch('value', i % 2 === 0 ? 'x' : 'y')
    await print(ast)
  }
  console.log(`${name}: ${((performance.now() - start) / 10).toFixed(1)}ms`)
  await dispose(ast)
}

await run('napi-patch-print', napi.parse, napi.print, napi.dispose)
await run('daemon-patch-print', daemon.parse, daemon.print, daemon.dispose)
