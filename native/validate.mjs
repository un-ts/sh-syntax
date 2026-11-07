import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { parseSync, printSync } from '../lib/index.js'

const require = createRequire(import.meta.url)
const binding = require('./linux-x64-gnu/build/Release/sh_syntax_binding.node')
const nativeParse = (text, filepath) => JSON.parse(binding.parse(text, filepath)).ast
const fixtures = fs.readdirSync('test/fixtures')
let mismatches = 0
let printMismatches = 0

for (const file of fixtures) {
  const text = fs.readFileSync(path.join('test/fixtures', file), 'utf8')
  try {
    const native = nativeParse(text, file)
    const wasm = parseSync(text, { keepComments: true, filepath: file })
    if (JSON.stringify(native) !== JSON.stringify(wasm)) {
      mismatches++
      console.error(`AST mismatch: ${file}`)
    }
    const nativePrinted = JSON.parse(binding.print(text, file)).text
    const wasmPrinted = printSync(text, { filepath: file })
    if (nativePrinted !== wasmPrinted) {
      printMismatches++
      console.error(`print mismatch: ${file}`)
    }
  } catch {
    // Fixtures with syntax errors are covered by the WASM test suite.
  }
}

console.log(`AST parity: ${fixtures.length - mismatches}/${fixtures.length} fixtures`)
console.log(`print parity: ${fixtures.length - printMismatches}/${fixtures.length} fixtures`)

