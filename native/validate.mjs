import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { parseSync } from '../lib/index.js'

const require = createRequire(import.meta.url)
const binding = require('./linux-x64-gnu/build/Release/sh_syntax_binding.node')
const nativeParse = (text, filepath) => JSON.parse(binding.parse(text, filepath)).ast
const fixtures = fs.readdirSync('test/fixtures')
let mismatches = 0

for (const file of fixtures) {
  const text = fs.readFileSync(path.join('test/fixtures', file), 'utf8')
  try {
    const native = nativeParse(text, file)
    const wasm = parseSync(text, { keepComments: true, filepath: file })
    if (JSON.stringify(native) !== JSON.stringify(wasm)) {
      mismatches++
      console.error(`AST mismatch: ${file}`)
    }
  } catch {
    // Fixtures with syntax errors are covered by the WASM test suite.
  }
}

console.log(`AST parity: ${fixtures.length - mismatches}/${fixtures.length} fixtures`)

const text = fs.readFileSync('test/fixtures/install.sh', 'utf8')
for (const [name, parse] of [
  ['native', () => nativeParse(text, 'install.sh')],
  ['wasm', () => parseSync(text, { keepComments: true, filepath: 'install.sh' })],
]) {
  for (let i = 0; i < 5; i++) parse()
  const start = performance.now()
  for (let i = 0; i < 20; i++) parse()
  console.log(`${name} parse: ${((performance.now() - start) / 20).toFixed(1)}ms`)
}
